import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrdersByPhone, getAllOrders, saveOrder, getAdminSettings, logCallEvent } from "@/lib/db";
import { triggerOutboundCall } from "@/lib/twilioCall";

function formatSpokenDate(dateStr: string): { he: string; en: string } {
  if (!dateStr) return { he: "", en: "" };
  try {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return { he: "", en: "" };
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-based
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return { he: "", en: "" };

    const daysHe = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    const monthsHe = [
      "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", 
      "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
    ];
    const monthsEn = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const dayOfWeekHe = daysHe[date.getDay()];
    const dayOfWeekEn = daysEn[date.getDay()];
    
    const monthHe = monthsHe[month];
    const monthEn = monthsEn[month];

    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) suffix = "st";
    else if (day === 2 || day === 22) suffix = "nd";
    else if (day === 3 || day === 23) suffix = "rd";

    return {
      he: `ביום ${dayOfWeekHe}, ${day} ב${monthHe}`,
      en: `on ${dayOfWeekEn}, ${monthEn} the ${day}${suffix}`
    };
  } catch {
    return { he: "", en: "" };
  }
}

function say(en: string, he: string) {
  // Using Polly.Matthew (premium English male voice)
  // Using Google.he-IL-Wavenet-C (high-quality neural female voice for Hebrew)
  const safeEn = en.replace(/&/g, "&amp;");
  const safeHe = he.replace(/&/g, "&amp;");
  return `<Say voice="Polly.Matthew" language="en-US">${safeEn}</Say>` +
         `<Say voice="Google.he-IL-Wavenet-C" language="he-IL">${safeHe}</Say>`;
}

function sayEn(en: string) {
  const safeEn = en.replace(/&/g, "&amp;");
  return `<Say voice="Polly.Matthew" language="en-US">${safeEn}</Say>`;
}

function gather(action: string, numDigits: number | string, timeout = 10, innerXml: string) {
  const escapedAction = action.replace(/&/g, "&amp;");
  return `<Gather action="${escapedAction}" method="POST" numDigits="${numDigits}" timeout="${timeout}">${innerXml}</Gather>`;
}

function gatherSpeechAndDtmf(action: string, numDigits: number | string, timeout = 10, language = "en-US", innerXml: string) {
  const escapedAction = action.replace(/&/g, "&amp;");
  return `<Gather action="${escapedAction}" method="POST" input="dtmf speech" numDigits="${numDigits}" timeout="${timeout}" language="${language}" speechModel="numbers_and_commands" speechTimeout="auto" enhanced="true" hints="update, add, status, result, clean, shatnez, ready, testing, review, issue, delivered, order, yes, no, call, dial, contact, connect, customer">${innerXml}</Gather>`;
}

function replaceNumberWords(text: string): string {
  const numberWords: Record<string, string> = {
    zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", oh: "0"
  };
  let result = text;
  for (const [word, digit] of Object.entries(numberWords)) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, digit);
  }
  // Replace standalone "o" or "O", or when adjacent to digits
  result = result.replace(/\b[oO]\b/g, "0");
  result = result.replace(/(\d)[oO]\b/g, "$10");
  result = result.replace(/\b[oO](\d)/g, "0$1");
  return result;
}

function parseSpeechCommand(text: string): {
  action?: "add" | "update" | "call";
  orderId?: string;
  phone?: string;
  status?: "received" | "testing" | "review" | "ready" | "delivered" | "issue";
  result?: "Clean / No Shatnez" | "Shatnez Found" | "Call to Discuss";
  location?: "14 Buchanan Rd" | "166 Clinton Lane";
} {
  const cleanText = text.toLowerCase().trim();
  
  // Merge spaced digits to handle individual digit recognition (e.g. "1 0 2" -> "102")
  let mergedText = cleanText.replace(/(\d)[\s-]+(?=\d)/g, "$1");
  
  // Replace spoken numbers
  mergedText = replaceNumberWords(mergedText);
  
  // Merge again in case replacing number words introduced space-separated digits (e.g. "one zero two" -> "1 0 2" -> "102")
  mergedText = mergedText.replace(/(\d)[\s-]+(?=\d)/g, "$1");

  // 1. Detect Action (Prioritize call, then update, and handle Hebrew phonetic approximations)
  let action: "add" | "update" | "call" | undefined;
  if (
    /\b(call|dial|ring|contact|bridge|צלצל|התקשר|טלפן|חייג|חיוג)\b/i.test(mergedText)
  ) {
    action = "call";
  } else if (
    /\b(update|change|set|modify|edit|up\s*date|עדכן|עדכון|לעדכן|שנה|עדכני|שנוי|החלף)\b/i.test(mergedText) ||
    /\b(add\s*(coin|can|ken|again|corner|con)|let\s*can|led\s*can|lead\s*can|lid\s*can|id\s*cone|it\s*cone)\b/i.test(mergedText)
  ) {
    action = "update";
  } else if (
    /\b(add|new|create|insert|make|הוסף|הוספה|חדש|צור|להוסיף)\b/i.test(mergedText)
  ) {
    action = "add";
  }

  // 2. Extract digits (Order ID vs. Phone Number)
  const digitsMatches = mergedText.match(/\d+/g) || [];
  
  let orderId: string | undefined;
  let phone: string | undefined;
  
  // Identify phone number (7+ digits)
  for (const match of digitsMatches) {
    if (match.length >= 7) {
      phone = match;
    }
  }

  // Identify order ID (1-6 digits)
  // First, check context: a number following keywords like "order", "number", "no", "id"
  const contextMatch = mergedText.match(/\b(order|number|no|id|ord)\s*#?\s*(\d{1,6})\b/i);
  if (contextMatch) {
    orderId = contextMatch[2];
  } else {
    // Pick the first digit sequence of length 2-6 (to avoid stage/status 1-digit numbers like stage 4)
    const orderIdMatch = digitsMatches.find(m => m.length >= 2 && m.length <= 6);
    if (orderIdMatch) {
      orderId = orderIdMatch;
    } else {
      // Fallback to first 1-6 digit sequence
      const fallbackOrderIdMatch = digitsMatches.find(m => m.length >= 1 && m.length <= 6);
      if (fallbackOrderIdMatch) {
        orderId = fallbackOrderIdMatch;
      }
    }
  }

  // 3. Detect Status (Including Hebrew words and English phonetic approximations of Hebrew words)
  let status: "received" | "testing" | "review" | "ready" | "delivered" | "issue" | undefined;
  if (/\b(received|logged|received and logged|received & logged|step 1|stage 1|התקבל|התקבלה)\b/i.test(mergedText)) {
    status = "received";
  } else if (/\b(testing|in testing|test|stage 2|step 2|בבדיקה|בדיקה|bebdika|badica|babdika)\b/i.test(mergedText)) {
    status = "testing";
  } else if (/\b(review|under review|quality review|stage 3|step 3|בקרת|ביקורת|בקורת|בביקורת)\b/i.test(mergedText)) {
    status = "review";
  } else if (/\b(ready|pickup|ready for pickup|completed|finished|stage 4|step 4|מוכן|לאיסוף|moohan|move on|mukan|mocha|mukhan)\b/i.test(mergedText)) {
    status = "ready";
  } else if (/\b(delivered|received by customer|stage 5|step 5|נמסר|נמסרה|nimsar)\b/i.test(mergedText)) {
    status = "delivered";
  } else if (/\b(issue|attention|needs attention|needs repair|problem|attention needed|stage 6|step 6|בעיה|טיפול|דרוש טיפול)\b/i.test(mergedText)) {
    status = "issue";
  }

  // 4. Detect Result (Including Hebrew words and English phonetic approximations of Hebrew words)
  let result: "Clean / No Shatnez" | "Shatnez Found" | "Call to Discuss" | undefined;
  if (/\b(clean|kosher|passed|no shatnez|נקי|כשר|naki|knocky|lucky)\b/i.test(mergedText)) {
    result = "Clean / No Shatnez";
  } else if (/\b(shatnez|shatnez found|failed|not kosher|found shatnez|found|שעטנז|נמצא שעטנז|shotness|shotnez|shatness|sharpness)\b/i.test(mergedText)) {
    result = "Shatnez Found";
  } else if (/\b(discuss|call to discuss|ask|review result|לדבר|שיחה|discuss)\b/i.test(mergedText)) {
    result = "Call to Discuss";
  }

  // 5. Detect Location
  let location: "14 Buchanan Rd" | "166 Clinton Lane" | undefined;
  if (/\b(clinton|clinton lane|clinton ln|קלינטון|קלינטן)\b/i.test(mergedText)) {
    location = "166 Clinton Lane";
  } else if (/\b(buchanan|buchanan rd|buchanan road|ביוקנן)\b/i.test(mergedText)) {
    location = "14 Buchanan Rd";
  }

  // 6. Deduce action if not explicitly stated
  if (!action) {
    if (status || result || orderId || location) {
      action = "update";
    } else if (phone) {
      action = "add";
    }
  }

  return { action, orderId, phone, status, result, location };
}


function redirect(action: string) {
  const escapedAction = action.replace(/&/g, "&amp;");
  return `<Redirect method="POST">${escapedAction}</Redirect>`;
}

function xmlResponse(inner: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

function translateStatus(status: string) {
  const map: Record<string, string> = {
    received: "התקבל",
    testing: "בבדיקה",
    review: "בביקורת",
    ready: "מוכן לאיסוף",
    delivered: "נמסר",
    issue: "דרוש טיפול",
  };
  return map[status] || status;
}

function translateStatusEn(status: string): string {
  const map: Record<string, string> = {
    received: "received and logged",
    testing: "currently in testing",
    review: "under quality review",
    ready: "ready for pickup",
    delivered: "successfully delivered",
    issue: "needs attention",
  };
  return map[status] || status;
}

function formatDialNumber(num: string) {
  const clean = num.replace(/\D/g, ""); // Keep only digits
  if (clean.length === 10) {
    return `+1${clean}`;
  }
  if (clean.length === 11 && clean.startsWith("1")) {
    return `+${clean}`;
  }
  if (clean.length > 0) {
    return `+${clean}`;
  }
  return `+18455524744`; // Safe fallback
}

function generateOrderIdForPhone(phone: string, existingOrders: any[]): string {
  const rawPhone = phone.replace(/\D/g, "");
  const cleanPhone = rawPhone.length === 11 && rawPhone.startsWith("1") ? rawPhone.substring(1) : rawPhone;
  
  if (!cleanPhone) {
    return `order_${Date.now()}`;
  }
  
  // Check if [cleanPhone] is already an order ID
  const hasBaseId = existingOrders.some(o => String(o.id) === cleanPhone);
  if (!hasBaseId) {
    return cleanPhone;
  }
  
  // Find all existing IDs that start with [cleanPhone]-
  const prefix = `${cleanPhone}-`;
  const matchingSuffixes = existingOrders
    .filter(o => String(o.id).startsWith(prefix))
    .map(o => {
      const suffixStr = String(o.id).substring(prefix.length);
      const val = parseInt(suffixStr, 10);
      return isNaN(val) ? 1 : val;
    });
  
  const maxSuffix = matchingSuffixes.length > 0 ? Math.max(...matchingSuffixes) : 1;
  const nextSuffix = maxSuffix + 1;
  return `${cleanPhone}-${nextSuffix}`;
}

export async function POST(req: NextRequest) {
  const origin = `https://${req.headers.get("host")}`;
  try {
    let digits = "";
    let speechResult = "";
    let toPhoneNumber = "";
    let fromPhoneNumber = "";
    let callSid = "";
    const url = new URL(req.url);
    const step = url.searchParams.get("step") || "menu";
    const clearFlag = url.searchParams.get("clear") === "true";

    try {
      const form = await req.formData();
      digits = clearFlag ? "" : ((form.get("Digits") as string) || "");
      speechResult = (form.get("SpeechResult") as string) || "";
      toPhoneNumber = (form.get("To") as string) || "";
      fromPhoneNumber = (form.get("From") as string) || "";
      callSid = (form.get("CallSid") as string) || "";
    } catch (e) {
      digits = clearFlag ? "" : (url.searchParams.get("Digits") || "");
      speechResult = url.searchParams.get("SpeechResult") || "";
      toPhoneNumber = url.searchParams.get("To") || "";
      fromPhoneNumber = url.searchParams.get("From") || "";
      callSid = url.searchParams.get("CallSid") || "";
    }
    

    // Clean fromPhoneNumber to extract raw local 10 digits
    const rawPhone = fromPhoneNumber.replace(/\D/g, "");
    const cleanPhone = rawPhone.length === 11 && rawPhone.startsWith("1") ? rawPhone.substring(1) : rawPhone;

    console.log(`[Twilio IVR Log] Step: ${step}, Digits: "${digits}", SpeechResult: "${speechResult}", From: "${fromPhoneNumber}" (clean: "${cleanPhone}"), To: "${toPhoneNumber}"`);

    // Global Key Check: If they press * at any step, instantly return to the main menu!
    // But if we are in an authenticated admin step, return to the admin menu instead.
    const cleanDigits = digits.replace(/[^0-9*]/g, "");
    if (cleanDigits === "*" || cleanDigits === "*#" || cleanDigits.includes("*")) {
      const isAdminStep = (step.startsWith("admin_") && step !== "admin_pin") || step.startsWith("status_update_") || step === "lookup_by_phone";
      console.log(`[Twilio IVR Log] Global * detected. Redirecting. Admin step? ${isAdminStep}`);
      return xmlResponse(redirect(isAdminStep ? `${origin}/api/twilio/gather?step=admin_menu&clear=true` : `${origin}/api/twilio/voice`));
    }

    const settings = await getAdminSettings();
    const ADMIN_PIN = settings.pin || "1234";

    // ── Main Menu ──
    if (step === "menu") {
      if (cleanDigits === "1") {
        console.log(`[Twilio IVR Log] Main Menu: Option 1 played.`);
        await logCallEvent(callSid, fromPhoneNumber, "Pressed Option 1 (Garment Dropoff)");
        const generalEn = settings.ivrGeneralEn || "To have your garments checked, please drop them off at 14 Buchanan, North Square, New York. Once dropped off, you can call our 24/7 automated line at any time to hear your order status. When the status is completed, you may come pick up your garment. Please place the testing payment in the designated slot or envelope with the garment. Our prices are 5 dollars for a simple garment, and 10 dollars for any lined garment, such as a suit or a coat. Thank you for choosing The Shatnez Lab.";
        const generalHe = settings.ivrGeneralHe || "לבדיקת בגדים, אנא מסרו אותם בכתובת 14 Buchanan, North Square, ניו יורק. לאחר המסירה, תוכלו להתקשר לקו הטלפוני שלנו הפעיל 24 שעות ביממה, 7 ימים בשבוע כדי לשמוע את סטטוס ההזמנה. כאשר הבדיקה תושלם, תוכלו לבוא לאסוף את הבגד. אנא הניחו את התשלום במעטפה או בחריץ המיועד יחד עם הבגד. המחירים שלנו הם 5 דולרים עבור בגד פשוט, ו-10 דולרים עבור בגד עם בטנה, כגון חליפה או מעיל. תודה שבחרתם במעבדת השעטנז.";
        return xmlResponse(
          gather(`${origin}/api/twilio/gather?step=menu`, 1, 2, say(generalEn, generalHe)) +
          redirect(`${origin}/api/twilio/voice?clear=true`)
        );
      }
      if (cleanDigits === "2") {
        console.log(`[Twilio IVR Log] Main Menu: Option 2 requested. Clean Caller Phone: "${cleanPhone}"`);
        await logCallEvent(callSid, fromPhoneNumber, "Pressed Option 2 (Check Order Status)");
        if (cleanPhone && cleanPhone.length >= 7) {
          const spacedPhone = cleanPhone.split("").join(" ");
          return xmlResponse(
            gather(
              `${origin}/api/twilio/gather?step=caller_id_confirm&callerPhone=${cleanPhone}`,
              1,
              15,
              say(
                `We see you are calling from, ${spacedPhone}. Press 1 to search for orders with this number. Press 2 to enter a different number.`,
                `אנו רואים שאתה מתקשר ממספר, ${spacedPhone}. הקש 1 לחיפוש הזמנות עם מספר זה. הקש 2 להזנת מספר אחר.`
              )
            )
          );
        } else {
          // Fallback if caller ID is not available
          return xmlResponse(
            gather(
              `${origin}/api/twilio/gather?step=order_lookup`,
              10,
              15,
              say(
                "Please enter your order number, or your ten digit phone number, followed by pound.",
                "אנא הקש את מספר ההזמנה, או את מספר הטלפון שלך בן עשר ספרות, ולאחר מכן סולמית."
              )
            )
          );
        }
      }
      if (cleanDigits === "3") {
        console.log(`[Twilio IVR Log] Main Menu: Option 3 played.`);
        await logCallEvent(callSid, fromPhoneNumber, "Pressed Option 3 (Special Services)");
        const specialEn = settings.ivrSpecialEn || "We offer premium special services, including VIP home testing visits for an additional fee, as well as on-site testing for clothing stores and warehouses to ensure the entire inventory is certified clean of shatnez. Please speak to a representative for details and pricing.";
        const specialHe = settings.ivrSpecialHe || "אנו מציעים שירותים מיוחדים מובחרים, כולל ביקורי בית של מומחה לבדיקת VIP בתוספת תשלום, וכן בדיקות מקומיות בחנויות בגדים ומחסנים כדי להבטיח שכל המלאי נקי משעטנז. אנא שוחחו עם נציג לקבלת פרטים ומחירים.";
        return xmlResponse(
          gather(`${origin}/api/twilio/gather?step=menu`, 1, 2, say(specialEn, specialHe)) +
          redirect(`${origin}/api/twilio/voice?clear=true`)
        );
      }
      if (cleanDigits === "0") {
        console.log(`[Twilio IVR Log] Main Menu: Option 0 - Checking holiday mode and business hours.`);
        await logCallEvent(callSid, fromPhoneNumber, "Requested Representative");

        if (settings.holidayModeActive) {
          console.log(`[Twilio IVR Log] Main Menu: Option 0 - Holiday Mode Active. Forwarding to voicemail.`);
          await logCallEvent(callSid, fromPhoneNumber, "Redirected to Voicemail (Holiday Mode)", "voicemail");
          const holEn = settings.ivrHolidayMsgEn || "Our office is currently closed for the holidays. Please leave a message after the beep.";
          const holHe = settings.ivrHolidayMsgHe || "המשרד סגור כעת לרגל החג. אנא השאירו הודעה לאחר הצפצוף.";
          return xmlResponse(
            say(holEn, holHe) +
            `<Record action="${origin}/api/twilio/studio?action=voicemail" maxLength="120" playBeep="true" />`
          );
        }

        if (settings.dndActive) {
          console.log(`[Twilio IVR Log] Main Menu: Option 0 - DND Mode Active. Forwarding to voicemail.`);
          await logCallEvent(callSid, fromPhoneNumber, "Redirected to Voicemail (DND Mode)", "voicemail");
          return xmlResponse(
            say(
              "The representative is currently unavailable. Please leave a message after the beep, and we will get back to you.",
              "הנציג אינו זמין כעת. אנא השאירו הודעה לאחר הצפצוף, ונחזור אליכם בהקדם."
            ) +
            `<Record action="${origin}/api/twilio/studio?action=voicemail" maxLength="120" playBeep="true" />`
          );
        }

        const nyTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
        const dayOfWeek = nyTime.getDay(); // 0 is Sunday, 6 is Saturday
        const currentHour = nyTime.getHours();
        const currentMin = nyTime.getMinutes();

        const startStr = settings.forwardingHoursStart || "09:00";
        const endStr = settings.forwardingHoursEnd || "21:00";
        
        const parseTime = (timeStr: string) => {
          const parts = timeStr.split(":");
          if (parts.length !== 2) return { h: 0, m: 0 };
          return { h: parseInt(parts[0], 10), m: parseInt(parts[1], 10) };
        };

        const start = parseTime(startStr);
        const end = parseTime(endStr);

        const currentMinsTotal = currentHour * 60 + currentMin;
        const startMinsTotal = start.h * 60 + start.m;
        const endMinsTotal = end.h * 60 + end.m;

        let isWithinHours = false;
        
        if (dayOfWeek === 6) {
           isWithinHours = false; // Block completely on Shabbat (Saturday)
        } else {
           if (startMinsTotal <= endMinsTotal) {
             isWithinHours = currentMinsTotal >= startMinsTotal && currentMinsTotal <= endMinsTotal;
           } else {
             isWithinHours = currentMinsTotal >= startMinsTotal || currentMinsTotal <= endMinsTotal;
           }
        }

        if (!isWithinHours) {
          console.log(`[Twilio IVR Log] Main Menu: Option 0 - Outside business hours. Forwarding to voicemail.`);
          await logCallEvent(callSid, fromPhoneNumber, "Redirected to Voicemail (Outside Hours)", "voicemail");
          return xmlResponse(
            say(
              "Our office is currently closed. Please leave a message after the beep, and we will get back to you.",
              "המשרד סגור כעת. אנא השאירו הודעה לאחר הצפצוף, ונחזור אליכם בהקדם."
            ) +
            `<Record action="${origin}/api/twilio/studio?action=voicemail" maxLength="120" playBeep="true" />`
          );
        }

        const num = settings.forwardingNumber || "8455524744";
        const formattedNum = formatDialNumber(num);
        console.log(`[Twilio IVR Log] Forwarding to: ${formattedNum} (within business hours)`);
        
        await logCallEvent(callSid, fromPhoneNumber, "Forwarded to Representative", "completed");

        let dialTag = `<Dial>${formattedNum}</Dial>`;
        if (settings.callerIdType === "twilio" && settings.twilioPhoneNumber) {
          dialTag = `<Dial callerId="${settings.twilioPhoneNumber}">${formattedNum}</Dial>`;
        }

        return xmlResponse(
          say("Connecting you to a representative. Please wait.", "מעביר אותך לנציג. אנא המתן.") +
          dialTag
        );
      }
      if (cleanDigits === "9") {
        console.log(`[Twilio IVR Log] Main Menu: Option 9 - Requesting admin PIN.`);
        await logCallEvent(callSid, fromPhoneNumber, "Pressed Option 9 (Admin Access Request)");
        return xmlResponse(
          gather(
            `${origin}/api/twilio/gather?step=admin_pin`,
            4,
            15,
            say("Please enter your 4 digit admin PIN.", "אנא הקש את קוד המנהל בן 4 הספרות.")
          )
        );
      }

      // If they type an order ID directly (exclude star symbol)
      const clean = digits.replace(/#$/, "").trim().toUpperCase();
      if (clean && clean !== "*") {
        console.log(`[Twilio IVR Log] Direct Order ID input from Main Menu: "${clean}"`);
        return await lookupOrder(clean, origin);
      }
      return xmlResponse(
        say("Invalid selection. Returning to main menu.", "בחירה לא תקינה. חוזר לתפריט הראשי.") +
        redirect(`${origin}/api/twilio/voice`)
      );
    }

    // ── Caller ID Confirmation ──
    if (step === "caller_id_confirm") {
      const callerPhone = url.searchParams.get("callerPhone") || "";
      console.log(`[Twilio IVR Log] Caller ID Confirm Digit: "${digits}" for phone: "${callerPhone}"`);
      if (digits === "1") {
        await logCallEvent(callSid, fromPhoneNumber, "Selected search by Caller ID");
        const allOrders = await getOrdersByPhone(callerPhone);
        const orders = allOrders.filter(o => !o.archived);
        if (orders.length === 0) {
          console.log(`[Twilio IVR Log] No orders found for phone: "${callerPhone}". Prompting manual entry.`);
          return xmlResponse(
            gather(
              `${origin}/api/twilio/gather?step=order_lookup`,
              10,
              15,
              say(
                "We could not find any orders associated with this number. Please enter your order number, or another phone number, followed by pound.",
                "לא מצאנו הזמנות המשויכות למספר זה. אנא הקש מספר הזמנה, או מספר טלפון אחר, ולאחריו סולמית."
              )
            )
          );
        }
        
        let enMsg = `Found ${orders.length} order${orders.length > 1 ? "s" : ""}. `;
        let heMsg = `נמצאו ${orders.length} הזמנות. `;
        for (const o of orders) {
          const safeId = String(o.id).replace(/-/g, " dash ");
          const safeIdHe = String(o.id).replace(/-/g, " מקף ");
          const enStatus = o.status === "received" ? "received and logged" : o.status === "testing" ? "in testing" : o.status === "review" ? "under review" : o.status === "ready" ? "ready for pickup" : o.status === "delivered" ? "delivered" : "needs attention";
          const heStatus = translateStatus(o.status || "received");
          
          enMsg += `Order ${safeId} is ${enStatus}. `;
          heMsg += `הזמנה ${safeIdHe} היא ${heStatus}. `;
          if (o.result) {
            const translatedResult = o.result === "Clean / No Shatnez" ? "נקי משעטנז" : o.result === "Shatnez Found" ? "נמצא שעטנז" : o.result;
            enMsg += `Result is: ${o.result}. `;
            heMsg += `התוצאה היא: ${translatedResult}. `;
          } else {
            enMsg += `Test result is: not available yet. `;
            heMsg += `תוצאת הבדיקה היא: טרם התקבלה. `;
          }
        }
        
        return xmlResponse(
          say(enMsg, heMsg) +
          redirect(`${origin}/api/twilio/voice`)
        );
      }
      
      // If they press 2 or anything else, prompt manual lookup
      await logCallEvent(callSid, fromPhoneNumber, "Selected manual order lookup");
      return xmlResponse(
        gather(
          `${origin}/api/twilio/gather?step=order_lookup`,
          10,
          15,
          say(
            "Please enter your order number, or your ten digit phone number, followed by pound.",
            "אנא הקש את מספר ההזמנה, או את מספר הטלפון שלך בן עשר ספרות, ולאחר מכן סולמית."
          )
        )
      );
    }
 
    // ── Order Lookup ──
    if (step === "order_lookup") {
      const clean = digits.replace(/#$/, "").trim().toUpperCase();
      console.log(`[Twilio IVR Log] Order Lookup Input: "${clean}"`);
      if (!clean) {
        return xmlResponse(
          say("No order number entered. Returning to main menu.", "לא הוקש מספר הזמנה. חוזר לתפריט הראשי.") +
          redirect(`${origin}/api/twilio/voice`)
        );
      }
      await logCallEvent(callSid, fromPhoneNumber, `Looked up: "${clean}"`);
      return await lookupOrder(clean, origin);
    }
 
    // ── Admin PIN ──
    if (step === "admin_pin") {
      const cleanPin = digits.replace(/#$/, "").trim();
      console.log(`[Twilio IVR Log] Admin PIN entered: "${cleanPin}" (Expected: "${ADMIN_PIN}")`);
      if (cleanPin === ADMIN_PIN) {
        await logCallEvent(callSid, fromPhoneNumber, "Admin PIN matched - Entering Admin Menu");
        return xmlResponse(
          gather(
            `${origin}/api/twilio/gather?step=admin_menu`,
            1,
            15,
            say(
              "Admin menu. Press 1 to hear recent orders. Press 2 to update an order. Press 3 to lookup by phone. Press 4 to add a new order. Press star to return to main menu.",
              "תפריט מנהל. הקש 1 לשמיעת הזמנות אחרונות. הקש 2 לעדכון הזמנה. הקש 3 לחיפוש לפי טלפון. הקש 4 להוספת הזמנה חדשה. הקש כוכבית לחזרה לתפריט הראשי."
            )
          ) +
          sayEn("No input received.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      await logCallEvent(callSid, fromPhoneNumber, `Admin PIN mismatch: "${cleanPin}"`);
      return xmlResponse(
        say("Incorrect PIN. Returning to main menu.", "קוד שגוי. חוזר לתפריט הראשי.") + 
        redirect(`${origin}/api/twilio/voice`)
      );
    }

    // ── Admin Menu Voice Entry ──
    if (step === "admin_menu_voice_entry") {
      console.log(`[Twilio IVR Log] Entered voice-enabled Admin Menu.`);
      return xmlResponse(
        gatherSpeechAndDtmf(
          `${origin}/api/twilio/gather?step=admin_menu`,
          1,
          15,
          "en-US",
          sayEn(
            "Welcome to the voice admin menu. You can press 1 to hear recent orders, 2 to update, 3 for lookup, or 4 to add. Or simply speak your command, for example: update order 102 to status ready and result clean."
          )
        ) +
        sayEn("No input received.") +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Admin Menu ──
    if (step === "admin_menu") {
      // Prioritize SpeechResult if it exists
      if (speechResult && speechResult.trim()) {
        const parsed = parseSpeechCommand(speechResult);
        console.log(`[Twilio IVR Voice Parser] Speech: "${speechResult}" -> Parsed:`, JSON.stringify(parsed));
        
        // Log voice inputs and parsing to the calls log in Firestore
        await logCallEvent(
          callSid,
          fromPhoneNumber,
          `Voice input: "${speechResult}" (Action: ${parsed.action || "none"}, orderId: ${parsed.orderId || "none"}, status: ${parsed.status || "none"}, result: ${parsed.result || "none"})`
        );
        
        if (parsed.action === "update") {
          let targetOrderId = parsed.orderId || "";
          
          // If orderId is missing but phone is present, lookup the order by phone
          if (!targetOrderId && parsed.phone) {
            const matches = await getOrdersByPhone(parsed.phone);
            const activeMatches = matches.filter(o => !o.archived);
            if (activeMatches.length === 1) {
              targetOrderId = activeMatches[0].id;
            } else if (activeMatches.length > 1) {
              const sorted = activeMatches.sort((a, b) => {
                const aTime = a.createdAt || new Date(a.dateReceived).getTime();
                const bTime = b.createdAt || new Date(b.dateReceived).getTime();
                return bTime - aTime;
              });
              targetOrderId = sorted[0].id;
            }
          }

          if (!targetOrderId) {
            return xmlResponse(
              gatherSpeechAndDtmf(
                `${origin}/api/twilio/gather?step=admin_menu`,
                1,
                15,
                "en-US",
                sayEn("Which order number would you like to update? Please say the order number and the status.")
              )
            );
          }
          if (!parsed.status && !parsed.result) {
            return xmlResponse(
              gatherSpeechAndDtmf(
                `${origin}/api/twilio/gather?step=admin_menu`,
                1,
                15,
                "en-US",
                sayEn(`What status or test result would you like to set for order ${targetOrderId.split("").join(" ")}?`)
              )
            );
          }
          // Redirect to confirmation with query parameters
          const statusParam = parsed.status || "";
          const resultParam = parsed.result || "";
          const locationParam = parsed.location || "";
          return xmlResponse(
            redirect(
              `${origin}/api/twilio/gather?step=admin_speech_confirm&action=update&orderId=${targetOrderId}&status=${statusParam}&result=${encodeURIComponent(resultParam)}&location=${encodeURIComponent(locationParam)}`
            )
          );
        } else if (parsed.action === "add") {
          if (!parsed.phone) {
            return xmlResponse(
              gatherSpeechAndDtmf(
                `${origin}/api/twilio/gather?step=admin_menu`,
                1,
                15,
                "en-US",
                sayEn("What is the customer's phone number for the new order?")
              )
            );
          }
          const locationParam = parsed.location || "";
          return xmlResponse(
            redirect(
              `${origin}/api/twilio/gather?step=admin_speech_confirm&action=add&phone=${parsed.phone}&location=${encodeURIComponent(locationParam)}`
            )
          );
        } else if (parsed.action === "call") {
          let targetOrderId = parsed.orderId || "";
          let targetPhone = parsed.phone || "";
          
          if (!targetOrderId && !targetPhone) {
            return xmlResponse(
              gatherSpeechAndDtmf(
                `${origin}/api/twilio/gather?step=admin_menu`,
                1,
                15,
                "en-US",
                sayEn("Which order number or phone number would you like to call? Please say the order number or phone number.")
              )
            );
          }
          
          return xmlResponse(
            redirect(
              `${origin}/api/twilio/gather?step=admin_speech_confirm&action=call&orderId=${targetOrderId}&phone=${targetPhone}`
            )
          );
        } else {
          // If no explicit add/update action, check for exit or simple navigation words
          const cleanSpeech = speechResult.toLowerCase().trim();
          if (/\b(exit|cancel|main menu|go back|welcome|star)\b/.test(cleanSpeech)) {
            console.log(`[Twilio IVR Log] Voice cancel detected. Redirecting to admin menu.`);
            return xmlResponse(
              sayEn("Returning to the admin menu.") +
              redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
            );
          } else if (/\b(one|recent|list|show)\b/.test(cleanSpeech)) {
            digits = "1";
          } else if (/\b(two|update|change)\b/.test(cleanSpeech)) {
            digits = "2";
          } else if (/\b(three|lookup|phone|search)\b/.test(cleanSpeech)) {
            digits = "3";
          } else if (/\b(four|add|create|new)\b/.test(cleanSpeech)) {
            digits = "4";
          } else {
            return xmlResponse(
              gatherSpeechAndDtmf(
                `${origin}/api/twilio/gather?step=admin_menu`,
                1,
                15,
                "en-US",
                sayEn("I did not understand that command. Please say something like: update order 102 to status ready, or add order for phone 845 555 1234. Or press a menu key.")
              )
            );
          }
        }
      }

      // If speechResult didn't trigger a voice flow, fall back to DTMF / digits processing:
      const menuSelection = (cleanDigits.length === 1 || cleanDigits === "*") ? cleanDigits : "";
      console.log(`[Twilio IVR Log] Admin Menu option entered: "${digits}" (menuSelection: "${menuSelection}")`);
      
      if (menuSelection === "1") {
        await logCallEvent(callSid, fromPhoneNumber, "Admin selection: List recent orders");
        const orders = await getAllOrders();
        const recent = orders.slice(-5).reverse();
        if (recent.length === 0) {
          return xmlResponse(
            sayEn("No orders found.") + 
            redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
          );
        }
        let enMsg = `Here are the five latest orders. `;
        for (const o of recent) {
          const spokenId = String(o.id).split("").join(" ");
          const customer = o.customerName || "No name";
          const enStatus = translateStatusEn(o.status || "received");
          const spokenDate = formatSpokenDate(o.dateReceived);
          const dateEn = spokenDate.en ? spokenDate.en : "not set";

          enMsg += `Order number ${spokenId}. Customer name is ${customer}. Status is ${enStatus}. Date received is ${dateEn}. `;
        }
        return xmlResponse(
          sayEn(enMsg) +
          gatherSpeechAndDtmf(
            `${origin}/api/twilio/gather?step=admin_menu`,
            1,
            10,
            "en-US",
            sayEn("Press any key or speak to return to the admin menu.")
          )
        );
      }
      if (menuSelection === "2") {
        await logCallEvent(callSid, fromPhoneNumber, "Admin selection: Update order status");
        return xmlResponse(
          gatherSpeechAndDtmf(
            `${origin}/api/twilio/gather?step=status_update_ask_id`,
            10,
            10,
            "en-US",
            sayEn("Enter the order number to update, followed by pound. Or simply say: update order 102.")
          ) +
          sayEn("No input received.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      if (menuSelection === "3") {
        await logCallEvent(callSid, fromPhoneNumber, "Admin selection: Phone lookup");
        return xmlResponse(
          gatherSpeechAndDtmf(
            `${origin}/api/twilio/gather?step=lookup_by_phone`,
            10,
            10,
            "en-US",
            sayEn("Enter the phone number, followed by pound. Or say: search phone number 845 555 1234.")
          ) +
          sayEn("No input received.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      if (menuSelection === "4") {
        await logCallEvent(callSid, fromPhoneNumber, "Admin selection: Add new order");
        return xmlResponse(
          gatherSpeechAndDtmf(
            `${origin}/api/twilio/gather?step=admin_add_order`,
            10,
            10,
            "en-US",
            sayEn("Enter the customer phone number for the new order, followed by pound. Or say: add order for phone 845 555 1234.")
          ) +
          sayEn("No input received.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      if (menuSelection === "5") {
        await logCallEvent(callSid, fromPhoneNumber, "Admin selection: Call customer by digits");
        return xmlResponse(
          gatherSpeechAndDtmf(
            `${origin}/api/twilio/gather?step=admin_call_by_digits`,
            10,
            15,
            "en-US",
            sayEn("Enter the order number or phone number you would like to call, followed by pound. Or speak your command.")
          ) +
          sayEn("No input received.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      if (!menuSelection) {
        // Just play the menu options (do not say invalid choice, as it was likely a redirect transition)
        return xmlResponse(
          gatherSpeechAndDtmf(
            `${origin}/api/twilio/gather?step=admin_menu`,
            1,
            15,
            "en-US",
            sayEn(
              "Admin menu. Press 1 to hear recent orders, 2 to update, 3 to lookup, 4 to add, 5 to call a customer. Or speak your command now."
            )
          ) +
          sayEn("No input received.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      return xmlResponse(
        sayEn("Invalid option.") + 
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Admin Call By Digits input step ──
    if (step === "admin_call_by_digits") {
      const cleanInput = digits.replace(/[^0-9*]/g, "").trim();
      
      // If speechResult is provided, parse it as a speech command
      if (speechResult && speechResult.trim()) {
        const parsed = parseSpeechCommand(speechResult);
        let finalAction = parsed.action;
        let finalPhone = parsed.phone;
        let finalOrderId = parsed.orderId;

        // In the "call by digits" step, the intent is ALWAYS to call.
        // If they spoke any number, make sure the action is "call" and extract the number.
        if (finalPhone || finalOrderId) {
          finalAction = "call";
        }

        // Fallback: If action is not recognized (e.g. they just spoke a number), extract digits
        if (!finalAction) {
          const processedSpeech = replaceNumberWords(speechResult.toLowerCase().trim()).replace(/(\d)[\s-]+(?=\d)/g, "$1");
          const digitsMatch = processedSpeech.replace(/[^0-9]/g, "");
          if (digitsMatch) {
            finalAction = "call";
            if (digitsMatch.length >= 7) {
              finalPhone = digitsMatch;
            } else if (digitsMatch.length >= 1 && digitsMatch.length <= 6) {
              finalOrderId = digitsMatch;
            }
          }
        }

        if (finalAction === "call") {
          await logCallEvent(
            callSid, 
            fromPhoneNumber, 
            `Admin input: Call target via speech: "${speechResult}" (Parsed phone: ${finalPhone || "none"}, orderId: ${finalOrderId || "none"})`
          );
          return xmlResponse(
            redirect(
              `${origin}/api/twilio/gather?step=admin_speech_confirm&action=call&orderId=${finalOrderId || ""}&phone=${finalPhone || ""}`
            )
          );
        }
      }

      if (cleanInput) {
        await logCallEvent(callSid, fromPhoneNumber, `Admin input: Call target via digits: "${cleanInput}"`);
        // If cleanInput is short (1-6 digits), treat it as an Order ID
        if (cleanInput.length >= 1 && cleanInput.length <= 6) {
          const order = await getOrderById(cleanInput);
          if (order && order.phone) {
            const formattedPhone = formatDialNumber(order.phone);
            console.log(`[Twilio IVR Voice Call] Bridging admin call directly to customer phone for order ${order.id}: "${formattedPhone}"`);

            await logCallEvent(callSid, fromPhoneNumber, `Outbound Bridged Call to ${formattedPhone} (Order #${order.id})`, "active", undefined, "outbound");

            let dialTag = `<Dial action="${origin}/api/twilio/gather?step=admin_dial_completed&amp;customerPhone=${encodeURIComponent(formattedPhone)}">${formattedPhone}</Dial>`;
            if (settings.callerIdType === "twilio" && settings.twilioPhoneNumber) {
              dialTag = `<Dial callerId="${settings.twilioPhoneNumber}" action="${origin}/api/twilio/gather?step=admin_dial_completed&amp;customerPhone=${encodeURIComponent(formattedPhone)}">${formattedPhone}</Dial>`;
            }

            return xmlResponse(
              sayEn(`Connecting you to the customer for order ${order.id.split("").join(" ")} now.`) +
              dialTag
            );
          } else {
            return xmlResponse(
              sayEn(`Order ${cleanInput.split("").join(" ")} was not found or has no phone number. Returning to admin menu.`) +
              redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
            );
          }
        }
        // If cleanInput is long (7+ digits), treat it as a Phone Number
        if (cleanInput.length >= 7) {
          const formattedPhone = formatDialNumber(cleanInput);
          console.log(`[Twilio IVR Voice Call] Bridging admin call directly to phone: "${formattedPhone}"`);

          await logCallEvent(callSid, fromPhoneNumber, `Outbound Bridged Call to ${formattedPhone}`, "active", undefined, "outbound");

          let dialTag = `<Dial action="${origin}/api/twilio/gather?step=admin_dial_completed&amp;customerPhone=${encodeURIComponent(formattedPhone)}">${formattedPhone}</Dial>`;
          if (settings.callerIdType === "twilio" && settings.twilioPhoneNumber) {
            dialTag = `<Dial callerId="${settings.twilioPhoneNumber}" action="${origin}/api/twilio/gather?step=admin_dial_completed&amp;customerPhone=${encodeURIComponent(formattedPhone)}">${formattedPhone}</Dial>`;
          }

          return xmlResponse(
            sayEn(`Connecting you to the customer now.`) +
            dialTag
          );
        }
      }

      // If no valid input, say so and redirect back to admin menu
      return xmlResponse(
        sayEn("Invalid input received. Returning to the admin menu.") +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Admin Speech Confirmation ──
    if (step === "admin_speech_confirm") {
      const actionParam = url.searchParams.get("action");
      const orderIdParam = url.searchParams.get("orderId") || "";
      const phoneParam = url.searchParams.get("phone") || "";
      const statusParam = url.searchParams.get("status") || "";
      const resultParam = url.searchParams.get("result") || "";
      const locationParam = url.searchParams.get("location") || "";

      let prompt = "";
      if (actionParam === "update") {
        const spokenId = orderIdParam.split("").join(" ");
        const friendlyStatus = statusParam ? translateStatusEn(statusParam) : "keep current status";
        const friendlyResult = resultParam ? resultParam : "keep current result";
        const friendlyLoc = locationParam ? `and location: ${locationParam}` : "";
        prompt = `You want to update order number ${spokenId} to status: ${friendlyStatus}, test result: ${friendlyResult} ${friendlyLoc}. Is this correct? Say yes or press 1 to confirm. Say no or press 2 to cancel.`;
      } else if (actionParam === "add") {
        const spokenPhone = phoneParam.split("").join(" ");
        const friendlyLoc = locationParam ? `at location: ${locationParam}` : "at default location";
        prompt = `You want to add a new order for phone number: ${spokenPhone} ${friendlyLoc}. Is this correct? Say yes or press 1 to confirm. Say no or press 2 to cancel.`;
      } else if (actionParam === "call") {
        if (phoneParam) {
          const spokenPhone = phoneParam.split("").join(" ");
          prompt = `You want to call phone number: ${spokenPhone}. Is this correct? Say yes or press 1 to confirm. Say no or press 2 to cancel.`;
        } else if (orderIdParam) {
          const spokenId = orderIdParam.split("").join(" ");
          prompt = `You want to call the customer for order number: ${spokenId}. Is this correct? Say yes or press 1 to confirm. Say no or press 2 to cancel.`;
        } else {
          return xmlResponse(redirect(`${origin}/api/twilio/gather?step=admin_menu`));
        }
      } else {
        return xmlResponse(redirect(`${origin}/api/twilio/gather?step=admin_menu`));
      }

      const queryParams = new URLSearchParams();
      queryParams.append("step", "admin_speech_confirm_process");
      queryParams.append("action", actionParam || "");
      if (orderIdParam) queryParams.append("orderId", orderIdParam);
      if (phoneParam) queryParams.append("phone", phoneParam);
      if (statusParam) queryParams.append("status", statusParam);
      if (resultParam) queryParams.append("result", resultParam);
      if (locationParam) queryParams.append("location", locationParam);

      return xmlResponse(
        gatherSpeechAndDtmf(
          `${origin}/api/twilio/gather?${queryParams.toString()}`,
          1,
          15,
          "en-US",
          sayEn(prompt)
        ) +
        sayEn("No input received. Returning to the admin menu.") +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Admin Speech Confirm Process ──
    if (step === "admin_speech_confirm_process") {
      const actionParam = url.searchParams.get("action");
      const orderIdParam = url.searchParams.get("orderId") || "";
      const phoneParam = url.searchParams.get("phone") || "";
      const statusParam = url.searchParams.get("status") || "";
      const resultParam = url.searchParams.get("result") || "";
      const locationParam = url.searchParams.get("location") || "";

      const cleanSpeech = speechResult.toLowerCase().trim();
      const isConfirmed = /\b(yes|correct|confirm|true|yeah|yup|ok|okay|sure|1)\b/.test(cleanSpeech) || cleanDigits === "1";
      const isCancelled = /\b(no|incorrect|cancel|false|nope|nah|2)\b/.test(cleanSpeech) || cleanDigits === "2";

      if (isConfirmed) {
        if (actionParam === "update") {
          const order = await getOrderById(orderIdParam);
          if (!order) {
            return xmlResponse(
              sayEn(`Order ${orderIdParam.split("").join(" ")} was not found. Returning to admin menu.`) +
              redirect(`${origin}/api/twilio/gather?step=admin_menu`)
            );
          }
          const oldStatus = order.status;
          if (statusParam) order.status = statusParam as any;
          if (resultParam) order.result = resultParam;
          if (locationParam) order.location = locationParam;

          await saveOrder(order);
          await logCallEvent(callSid, fromPhoneNumber, `Admin completed update: Order #${order.id} set to Status: ${order.status}, Result: ${order.result || "none"}, Location: ${order.location}`);

          if (order.status === "ready" && oldStatus !== "ready" && order.phone) {
            return xmlResponse(
              redirect(`${origin}/api/twilio/gather?step=admin_ask_notify&orderId=${order.id}&phone=${order.phone}`)
            );
          }

          const friendlyStatus = order.status ? translateStatusEn(order.status) : "not set";
          return xmlResponse(
            gatherSpeechAndDtmf(
              `${origin}/api/twilio/gather?step=admin_menu`,
              1,
              2,
              "en-US",
              sayEn(`Order ${orderIdParam.split("").join(" ")} successfully updated to status ${friendlyStatus}. Returning to the admin menu.`)
            ) +
            redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
          );
        } else if (actionParam === "add") {
          const orders = await getAllOrders();
          const newId = generateOrderIdForPhone(phoneParam, orders);

          await saveOrder({
            id: newId,
            customerName: "Phone Customer",
            phone: phoneParam,
            status: "received",
            dateReceived: new Date().toISOString().split("T")[0],
            estimatedCompletion: "",
            notes: "Added via voice command",
            result: "",
            createdAt: Date.now(),
            location: locationParam || "14 Buchanan Rd"
          });
          await logCallEvent(callSid, fromPhoneNumber, `Admin completed add: Order #${newId} for Phone: ${phoneParam}, Location: ${locationParam || "14 Buchanan Rd"}`);

          return xmlResponse(
            gatherSpeechAndDtmf(
              `${origin}/api/twilio/gather?step=admin_menu`,
              1,
              2,
              "en-US",
              sayEn(`Order successfully created with order number ${newId.split("").join(" ")}. Returning to the admin menu.`)
            ) +
            redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
          );
        } else if (actionParam === "call") {
          let customerPhone = phoneParam;
          if (!customerPhone && orderIdParam) {
            const order = await getOrderById(orderIdParam);
            if (order && order.phone) {
              customerPhone = order.phone;
            } else {
              return xmlResponse(
                sayEn(`Order ${orderIdParam.split("").join(" ")} was not found or has no phone number. Returning to admin menu.`) +
                redirect(`${origin}/api/twilio/gather?step=admin_menu`)
              );
            }
          }

          if (!customerPhone) {
            return xmlResponse(
              sayEn(`No phone number was specified. Returning to admin menu.`) +
              redirect(`${origin}/api/twilio/gather?step=admin_menu`)
            );
          }

          const formattedPhone = formatDialNumber(customerPhone);
          console.log(`[Twilio IVR Voice Call] Bridging admin call directly to customer phone: "${formattedPhone}"`);

          // Log call start event in DB for outbound
          await logCallEvent(callSid, fromPhoneNumber, `Outbound Bridged Call to ${formattedPhone}`, "active", undefined, "outbound");

          let dialTag = `<Dial action="${origin}/api/twilio/gather?step=admin_dial_completed&amp;customerPhone=${encodeURIComponent(formattedPhone)}">${formattedPhone}</Dial>`;
          if (settings.callerIdType === "twilio" && settings.twilioPhoneNumber) {
            dialTag = `<Dial callerId="${settings.twilioPhoneNumber}" action="${origin}/api/twilio/gather?step=admin_dial_completed&amp;customerPhone=${encodeURIComponent(formattedPhone)}">${formattedPhone}</Dial>`;
          }

          return xmlResponse(
            sayEn(`Connecting you to the customer now. Please hold.`) +
            dialTag
          );
        }
      } else if (isCancelled) {
        return xmlResponse(
          gatherSpeechAndDtmf(
            `${origin}/api/twilio/gather?step=admin_menu`,
            1,
            2,
            "en-US",
            sayEn("Action cancelled. Returning to the admin menu.")
          ) +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      } else {
        // Repeat confirmation request
        const queryParams = new URLSearchParams();
        queryParams.append("step", "admin_speech_confirm");
        queryParams.append("action", actionParam || "");
        if (orderIdParam) queryParams.append("orderId", orderIdParam);
        if (phoneParam) queryParams.append("phone", phoneParam);
        if (statusParam) queryParams.append("status", statusParam);
        if (resultParam) queryParams.append("result", resultParam);
        if (locationParam) queryParams.append("location", locationParam);

        return xmlResponse(
          sayEn("I did not understand your response. Please say yes or press 1 to confirm, or say no or press 2 to cancel.") +
          redirect(`${origin}/api/twilio/gather?${queryParams.toString()}`)
        );
      }
    }

    // ── Admin: Ask for Outbound Notification Call ──
    if (step === "admin_ask_notify") {
      const orderId = url.searchParams.get("orderId") || "";
      const phone = url.searchParams.get("phone") || "";
      
      const spokenPhone = phone.split("").join(" ");
      const spokenId = orderId.replace(/-/g, " dash ").split("").join(" ");
      const spokenIdHe = orderId.replace(/-/g, " מקף ").split("").join(" ");
      
      return xmlResponse(
        gatherSpeechAndDtmf(
          `${origin}/api/twilio/gather?step=admin_notify_process&orderId=${orderId}&phone=${phone}`,
          1,
          15,
          "en-US",
          say(
            `Order ${spokenId} is ready. Would you like to notify the customer by phone? Say yes or press 1 to confirm. Say no or press 2 to cancel.`,
            `הזמנה מספר ${spokenIdHe} עודכנה למוכן. האם ברצונך לשלוח הודעה טלפונית ללקוח? אמור כן או הקש 1 לאישור. אמור לא או הקש 2 לביטול.`
          )
        ) +
        say(
          "No input received. Notification skipped. Returning to the admin menu.",
          "לא התקבל קלט. שליחת ההודעה בוטלה. חוזר לתפריט המנהל."
        ) +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Admin: Process Outbound Notification Call ──
    if (step === "admin_notify_process") {
      const orderId = url.searchParams.get("orderId") || "";
      const phone = url.searchParams.get("phone") || "";
      
      const cleanSpeech = speechResult.toLowerCase().trim();
      const isConfirmed = /\b(yes|correct|confirm|true|yeah|yup|ok|okay|sure|1)\b/.test(cleanSpeech) || cleanDigits === "1";
      const isCancelled = /\b(no|incorrect|cancel|false|nope|nah|2)\b/.test(cleanSpeech) || cleanDigits === "2";
      
      if (isConfirmed) {
        const success = await triggerOutboundCall(phone, orderId, origin);
        if (success) {
          return xmlResponse(
            gather(`${origin}/api/twilio/gather?step=admin_menu`, 1, 2, say(
              "Outbound notification call successfully queued and initiated. Returning to admin menu.",
              "הודעה טלפונית ללקוח נשלחה בהצלחה. חוזר לתפריט המנהל."
            )) +
            redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
          );
        } else {
          return xmlResponse(
            gather(`${origin}/api/twilio/gather?step=admin_menu`, 1, 2, say(
              "Failed to trigger outbound call. Please check your Twilio credentials. Returning to admin menu.",
              "שגיאה בשליחת השיחה. אנא בדוק את הגדרות המערכת. חוזר לתפריט המנהל."
            )) +
            redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
          );
        }
      } else {
        return xmlResponse(
          say("Notification cancelled. Returning to admin menu.", "שליחת ההודעה בוטלה. חוזר לתפריט המנהל.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
    }

    // ── Status Update: Ask for Order ID ──
    if (step === "status_update_ask_id") {
      const clean = digits.replace(/#$/, "").trim().toUpperCase();
      console.log(`[Twilio IVR Log] Admin Status Ask Order ID: "${clean}"`);
      await logCallEvent(callSid, fromPhoneNumber, `Admin selected status update for Order #${clean}`);
      const order = await getOrderById(clean);
      if (!order) {
        return xmlResponse(
          say("Order not found.", "הזמנה לא נמצאה.") + 
          redirect(`${origin}/api/twilio/gather?step=admin_menu`)
        );
      }
      const safeId = String(order.id).replace(/-/g, " dash ");
      const safeIdHe = String(order.id).replace(/-/g, " מקף ");
      return xmlResponse(
        say(
          `Order ${safeId} is currently ${translateStatusEn(order.status || "received")}.`,
          `הזמנה ${safeIdHe} היא כרגע במצב ${translateStatus(order.status || "received")}.`
        ) +
        gather(
          `${origin}/api/twilio/gather?step=status_update_set&orderId=${order.id}`,
          1,
          15,
          say(
            "Press 1 for received. 2 for in testing. 3 for under review. 4 for ready for pickup. 5 for delivered. 6 for attention needed. Star to cancel.",
            "הקש 1 עבור התקבל. 2 עבור בבדיקה. 3 עבור בביקורת. 4 עבור מוכן לאיסוף. 5 עבור נמסר. 6 עבור דרוש טיפול. כוכבית לביטול."
          )
        ) +
        say("No input received. Returning to the admin menu.", "לא התקבל קלט. חוזר לתפריט המנהל.") +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Status Update: Set New Status ──
    if (step === "status_update_set") {
      const orderId = url.searchParams.get("orderId");
      console.log(`[Twilio IVR Log] Admin Status Set digit: "${digits}" for order ID: "${orderId}"`);
      const statusMap: Record<string, string> = {
        "1": "received", "2": "testing", "3": "review", "4": "ready", "5": "delivered", "6": "issue",
      };
      const newStatus = statusMap[cleanDigits];
      if (!newStatus || !orderId) {
        return xmlResponse(
          say("Invalid option.", "אפשרות לא תקינה.") + 
          redirect(`${origin}/api/twilio/gather?step=admin_menu`)
        );
      }
      
      return xmlResponse(
        gather(
          `${origin}/api/twilio/gather?step=status_update_result_set&orderId=${orderId}&newStatus=${newStatus}`,
          1,
          15,
          say(
            "Status noted. Now update the test result. Press 1 for clean, 2 for shatnez found, or star to keep existing result.",
            "הסטטוס נרשם. כעת בחר תוצאה. הקש 1 עבור נקי משעטנז, 2 עבור נמצא שעטנז, או כוכבית כדי להשאיר את התוצאה הנוכחית."
          )
        ) +
        say("No input received. Returning to the admin menu.", "לא התקבל קלט. חוזר לתפריט המנהל.") +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Status Update: Set Test Result ──
    if (step === "status_update_result_set") {
      const orderId = url.searchParams.get("orderId");
      const newStatus = url.searchParams.get("newStatus");
      console.log(`[Twilio IVR Log] Admin Status Result Set digit: "${digits}" for order ID: "${orderId}" and status: "${newStatus}"`);
      
      if (!orderId || !newStatus) {
        return xmlResponse(
          say("Missing parameters. Returning to admin menu.", "פרמטרים חסרים. חוזר לתפריט המנהל.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu`)
        );
      }

      const order = await getOrderById(orderId);
      if (!order) {
        return xmlResponse(
          say("Order not found.", "הזמנה לא נמצאה.") + 
          redirect(`${origin}/api/twilio/gather?step=admin_menu`)
        );
      }

      let newResult = order.result || "";
      if (cleanDigits === "1") {
        newResult = "Clean / No Shatnez";
      } else if (cleanDigits === "2") {
        newResult = "Shatnez Found";
      }

      return xmlResponse(
        gather(
          `${origin}/api/twilio/gather?step=status_update_location_set&orderId=${orderId}&newStatus=${newStatus}&newResult=${encodeURIComponent(newResult)}`,
          1,
          15,
          say(
            "Test result noted. Now update the location. Press 1 for 14 Buchanan Road. Press 2 for 166 Clinton Lane. Or press star to keep the current location.",
            "תוצאת הבדיקה נשמרה. כעת בחר מיקום. הקש 1 עבור ביוקנן 14. הקש 2 עבור קלינטון 166. או הקש כוכבית כדי להשאיר את המיקום הנוכחי."
          )
        ) +
        say("No input received. Saving with current location.", "לא התקבל קלט. שומר עם המיקום הנוכחי.") +
        redirect(`${origin}/api/twilio/gather?step=status_update_location_set&orderId=${orderId}&newStatus=${newStatus}&newResult=${encodeURIComponent(newResult)}&Digits=*`)
      );
    }

    // ── Status Update: Set Location ──
    if (step === "status_update_location_set") {
      const orderId = url.searchParams.get("orderId");
      const newStatus = url.searchParams.get("newStatus");
      const newResult = url.searchParams.get("newResult") || "";
      console.log(`[Twilio IVR Log] Admin Status Location Set digit: "${digits}" for order ID: "${orderId}"`);

      if (!orderId || !newStatus) {
        return xmlResponse(
          say("Missing parameters. Returning to admin menu.", "פרמטרים חסרים. חוזר לתפריט המנהל.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu`)
        );
      }

      const order = await getOrderById(orderId);
      if (!order) {
        return xmlResponse(
          say("Order not found.", "הזמנה לא נמצאה.") + 
          redirect(`${origin}/api/twilio/gather?step=admin_menu`)
        );
      }

      let selectedLoc = order.location || "14 Buchanan Rd";
      if (cleanDigits === "1") {
        selectedLoc = "14 Buchanan Rd";
      } else if (cleanDigits === "2") {
        selectedLoc = "166 Clinton Lane";
      }

      const oldStatus = order.status;

      await saveOrder({
        ...order,
        status: newStatus as any,
        result: newResult,
        location: selectedLoc
      });
      await logCallEvent(callSid, fromPhoneNumber, `Admin completed update: Order #${orderId} set to Status: ${newStatus}, Result: ${newResult || "none"}, Location: ${selectedLoc}`);

      if (newStatus === "ready" && oldStatus !== "ready" && order.phone) {
        return xmlResponse(
          redirect(`${origin}/api/twilio/gather?step=admin_ask_notify&orderId=${order.id}&phone=${order.phone}`)
        );
      }

      const friendlyLocEn = selectedLoc;
      const friendlyLocHe = selectedLoc === "166 Clinton Lane" ? "קלינטון 166" : "ביוקנן 14";

      return xmlResponse(
        gather(`${origin}/api/twilio/gather?step=admin_menu`, 1, 2, say(
          `Order successfully updated. Location is ${friendlyLocEn}. Returning to admin menu.`,
          `ההזמנה עודכנה בהצלחה. המיקום הוא ${friendlyLocHe}. חוזר לתפריט המנהל.`
        )) +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Lookup by Phone ──
    if (step === "lookup_by_phone") {
      const clean = digits.replace(/#$/, "").trim();
      console.log(`[Twilio IVR Log] Admin Lookup by phone: "${clean}"`);
      await logCallEvent(callSid, fromPhoneNumber, `Admin lookup by phone: "${clean}"`);
      const orders = await getOrdersByPhone(clean);
      if (orders.length === 0) {
        return xmlResponse(
          say("No orders found for that phone number.", "לא נמצאו הזמנות עבור מספר הטלפון הזה.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      let enMsg = `Found ${orders.length} order${orders.length > 1 ? "s" : ""}. `;
      let heMsg = `נמצאו ${orders.length} הזמנות. `;
      for (const o of orders) {
        const safeId = String(o.id).replace(/-/g, " dash ");
        const safeIdHe = String(o.id).replace(/-/g, " מקף ");
        enMsg += `Order ${safeId}, ${o.customerName || "Customer"}, status ${o.status || "received"}. `;
        heMsg += `הזמנה ${safeIdHe}, ${o.customerName || "לקוח"}, סטטוס ${translateStatus(o.status || "received")}. `;
      }
      return xmlResponse(
        say(enMsg, heMsg) +
        gather(
          `${origin}/api/twilio/gather?step=admin_menu`,
          1,
          10,
          say("Press any key to return to admin menu, or star for main menu.", "הקש על מקש כלשהו לחזרה לתפריט המנהל, או כוכבית לתפריט הראשי.")
        ) +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Admin: Add Order ──
    if (step === "admin_add_order") {
      const phone = digits.replace(/#$/, "").trim();
      console.log(`[Twilio IVR Log] Admin Add Order phone: "${phone}"`);
      if (!phone) {
        return xmlResponse(
          say("No phone number entered.", "לא הוקש מספר טלפון.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      await logCallEvent(callSid, fromPhoneNumber, `Admin selected add order for Phone: ${phone}`);
      return xmlResponse(
        gather(
          `${origin}/api/twilio/gather?step=admin_add_order_location&phone=${phone}`,
          1,
          15,
          say(
            "Please select drop-off location. Press 1 for 14 Buchanan Road. Press 2 for 166 Clinton Lane.",
            "אנא בחר מיקום מסירה. הקש 1 עבור ביוקנן 14. הקש 2 עבור קלינטון 166."
          )
        ) +
        say("No input received. Returning to the admin menu.", "לא התקבל קלט. חוזר לתפריט המנהל.") +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Admin: Add Order Location ──
    if (step === "admin_add_order_location") {
      const phone = url.searchParams.get("phone") || "";
      console.log(`[Twilio IVR Log] Admin Add Order Location digit: "${digits}" for phone: "${phone}"`);
      if (!phone) {
        return xmlResponse(
          say("Error: missing phone number.", "שגיאה: חסר מספר טלפון.") +
          redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }

      let selectedLoc = "14 Buchanan Rd";
      if (cleanDigits === "2") {
        selectedLoc = "166 Clinton Lane";
      }

      const orders = await getAllOrders();
      const newId = generateOrderIdForPhone(phone, orders);
      
      await saveOrder({
        id: newId, customerName: "Phone Customer", phone: phone, status: "received",
        dateReceived: new Date().toISOString().split("T")[0], estimatedCompletion: "",
        notes: "Added via phone system", result: "", location: selectedLoc,
        createdAt: Date.now()
      });
      await logCallEvent(callSid, fromPhoneNumber, `Admin completed add: Order #${newId} for Phone: ${phone}, Location: ${selectedLoc}`);
      return xmlResponse(
        gather(`${origin}/api/twilio/gather?step=admin_menu`, 1, 2, say(
          `Order created successfully. The order ID is ${newId.split("").join(" ")}.`,
          `ההזמנה נוצרה בהצלחה. מספר ההזמנה הוא ${newId.split("").join(" ")}.`
        )) +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Admin Dial Completed ──
    if (step === "admin_dial_completed") {
      let dialStatus = "";
      let dialDuration = "";
      try {
        const form = await req.formData();
        dialStatus = (form.get("DialCallStatus") as string) || "";
        dialDuration = (form.get("DialCallDuration") as string) || "";
      } catch (e) {
        dialStatus = url.searchParams.get("DialCallStatus") || "";
        dialDuration = url.searchParams.get("DialCallDuration") || "";
      }
      const customerPhone = url.searchParams.get("customerPhone") || "Customer";
      console.log(`[Twilio IVR Log] Admin Bridged Call completed to customer: "${customerPhone}". Status: ${dialStatus}, Duration: ${dialDuration}s`);
      
      await logCallEvent(
        callSid,
        fromPhoneNumber,
        `Bridged Call to ${customerPhone} ended (${dialStatus})`,
        "completed",
        dialDuration ? `${dialDuration}s` : undefined,
        "outbound"
      );

      return xmlResponse(
        sayEn(`The call has ended. Returning to the admin menu.`) +
        redirect(`${origin}/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Dashboard Dial Completed ──
    if (step === "dashboard_dial_completed") {
      let dialStatus = "";
      let dialDuration = "";
      try {
        const form = await req.formData();
        dialStatus = (form.get("DialCallStatus") as string) || "";
        dialDuration = (form.get("DialCallDuration") as string) || "";
      } catch (e) {
        dialStatus = url.searchParams.get("DialCallStatus") || "";
        dialDuration = url.searchParams.get("DialCallDuration") || "";
      }
      const customerPhone = url.searchParams.get("customerPhone") || "Customer";
      console.log(`[Twilio IVR Log] Dashboard Bridged Call completed to customer: "${customerPhone}". Status: ${dialStatus}, Duration: ${dialDuration}s`);
      
      await logCallEvent(
        callSid,
        customerPhone,
        `Bridged Call ended (${dialStatus})`,
        "completed",
        dialDuration ? `${dialDuration}s` : undefined,
        "outbound"
      );

      return xmlResponse(`<Hangup />`);
    }

    const isAdminStep = (step.startsWith("admin_") && step !== "admin_pin") || step.startsWith("status_update_") || step === "lookup_by_phone";
    return xmlResponse(redirect(isAdminStep ? `${origin}/api/twilio/gather?step=admin_menu&clear=true` : `${origin}/api/twilio/voice`));
  } catch (error) {
    console.error("IVR Error:", error);
    const url = new URL(req.url);
    const step = url.searchParams.get("step") || "menu";
    const isAdminStep = (step.startsWith("admin_") && step !== "admin_pin") || step.startsWith("status_update_") || step === "lookup_by_phone";
    return xmlResponse(
      say("An error occurred. Returning to menu.", "אירעה שגיאה. חוזר לתפריט.") +
      redirect(isAdminStep ? `${origin}/api/twilio/gather?step=admin_menu&clear=true` : `${origin}/api/twilio/voice`)
    );
  }
}

async function lookupOrder(input: string, origin: string) {
  try {
    let order = await getOrderById(input);
    if (order && order.archived) {
      order = null;
    }
    if (!order && input.replace(/\D/g, "").length >= 7) {
      const allByPhone = await getOrdersByPhone(input);
      const byPhone = allByPhone.filter(o => !o.archived);
      if (byPhone.length === 1) {
        order = byPhone[0];
      } else if (byPhone.length > 1) {
        let enMsg = `Found ${byPhone.length} orders. `;
        let heMsg = `נמצאו ${byPhone.length} הזמנות. `;
        for (const o of byPhone) {
          const safeId = String(o.id).replace(/-/g, " dash ");
          const safeIdHe = String(o.id).replace(/-/g, " מקף ");
          enMsg += `Order ${safeId}, status ${o.status || "received"}. `;
          heMsg += `הזמנה ${safeIdHe}, סטטוס ${translateStatus(o.status || "received")}. `;
        }
        return xmlResponse(
          say(enMsg, heMsg) +
          gather(
            `${origin}/api/twilio/gather?step=menu`,
            1,
            10,
            say("Press 1 to return to main menu.", "הקש 1 לחזרה לתפריט הראשי.")
          )
        );
      }
    }

    if (!order) {
      console.log(`[Twilio IVR Log] lookupOrder: Order not found for input "${input}". Returning to main menu.`);
      return xmlResponse(
        say(
          "We could not find an order with that number. Returning to the main menu.",
          "לא מצאנו הזמנה עם המספר הזה. חוזר לתפריט הראשי."
        ) +
        redirect(`${origin}/api/twilio/voice`)
      );
    }

    console.log(`[Twilio IVR Log] lookupOrder: Found order ID: "${order.id}", status: "${order.status}", result: "${order.result}"`);

    const enStatus = order.status === "received" ? "received and logged" : order.status === "testing" ? "in testing" : order.status === "review" ? "under review" : order.status === "ready" ? "ready for pickup" : order.status === "delivered" ? "delivered" : "needs attention";
    const safeId = String(order.id).replace(/-/g, " dash ");
    
    let enMsg = `Order ${safeId} is currently ${enStatus}. `;
    if (order.estimatedCompletion) {
      enMsg += `Estimated completion is ${order.estimatedCompletion}. `;
    }
    
    if (order.result) {
      enMsg += `Test result is: ${order.result}. `;
    } else {
      enMsg += `Test result is: not available yet. `;
    }

    if (order.status === "ready") {
      const locEn = order.location || "14 Buchanan Rd";
      enMsg += `Please pick up at ${locEn}. `;
    }

    enMsg += "Thank you for using The Shatnez Lab automated tracking service. Goodbye.";
    
    return xmlResponse(
      gather(`${origin}/api/twilio/gather?step=menu`, 1, 5, sayEn(enMsg)) +
      redirect(`${origin}/api/twilio/voice?clear=true`)
    );
  } catch (error) {
    console.error("Lookup Error:", error);
    return xmlResponse(
      say("Error looking up order. Returning to main menu.", "שגיאה בחיפוש ההזמנה. חוזר לתפריט הראשי.") +
      redirect(`${origin}/api/twilio/voice`)
    );
  }
}
