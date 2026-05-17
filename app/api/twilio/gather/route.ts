import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrdersByPhone, getAllOrders, saveOrder, getAdminSettings } from "@/lib/db";

function say(en: string, he: string) {
  // Using Polly.Joey (premium, extremely friendly and natural male voice for English)
  // Using Polly.Madi (premium female voice for Hebrew)
  const safeEn = en.replace(/&/g, "&amp;");
  const safeHe = he.replace(/&/g, "&amp;");
  return `<Say voice="Polly.Joey" language="en-US">${safeEn}</Say>` +
         `<Say voice="Polly.Madi" language="he-IL">${safeHe}</Say>`;
}

function gather(action: string, numDigits: number | string, timeout = 10, innerXml: string) {
  const escapedAction = action.replace(/&/g, "&amp;");
  return `<Gather action="${escapedAction}" method="POST" numDigits="${numDigits}" timeout="${timeout}">${innerXml}</Gather>`;
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
  return `+18457092022`; // Safe fallback
}

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  try {
    let digits = "";
    let toPhoneNumber = "";
    let fromPhoneNumber = "";
    const url = new URL(req.url);
    const step = url.searchParams.get("step") || "menu";
    const clearFlag = url.searchParams.get("clear") === "true";

    try {
      const form = await req.formData();
      digits = clearFlag ? "" : ((form.get("Digits") as string) || "");
      toPhoneNumber = (form.get("To") as string) || "";
      fromPhoneNumber = (form.get("From") as string) || "";
    } catch (e) {
      digits = clearFlag ? "" : (url.searchParams.get("Digits") || "");
      toPhoneNumber = url.searchParams.get("To") || "";
      fromPhoneNumber = url.searchParams.get("From") || "";
    }
    

    // Clean fromPhoneNumber to extract raw local 10 digits
    const rawPhone = fromPhoneNumber.replace(/\D/g, "");
    const cleanPhone = rawPhone.length === 11 && rawPhone.startsWith("1") ? rawPhone.substring(1) : rawPhone;

    console.log(`[Twilio IVR Log] Step: ${step}, Digits: "${digits}", From: "${fromPhoneNumber}" (clean: "${cleanPhone}"), To: "${toPhoneNumber}"`);

    // Global Key Check: If they press * at any step, instantly return to the main menu!
    const cleanDigits = digits.replace(/#$/, "").trim();
    if (cleanDigits === "*" || cleanDigits === "*#" || cleanDigits.includes("*")) {
      console.log(`[Twilio IVR Log] Global * detected. Redirecting to welcome menu.`);
      return xmlResponse(redirect(`/api/twilio/voice`));
    }

    const settings = await getAdminSettings();
    const ADMIN_PIN = settings.pin || "1234";

    // ── Main Menu ──
    if (step === "menu") {
      if (cleanDigits === "1") {
        console.log(`[Twilio IVR Log] Main Menu: Option 1 played.`);
        const generalEn = settings.ivrGeneralEn || "To have your garments checked, please drop them off at 14 Buchanan, North Square, New York. Once dropped off, you can call our 24/7 automated line at any time to hear your order status. When the status is completed, you may come pick up your garment. Please place the testing payment in the designated slot or envelope with the garment. Our prices are 5 dollars for a simple garment, and 10 dollars for any lined garment, such as a suit or a coat. Thank you for choosing The Shatnez Lab.";
        const generalHe = settings.ivrGeneralHe || "לבדיקת בגדים, אנא מסרו אותם בכתובת 14 Buchanan, North Square, ניו יורק. לאחר המסירה, תוכלו להתקשר לקו הטלפוני שלנו הפעיל 24 שעות ביממה, 7 ימים בשבוע כדי לשמוע את סטטוס ההזמנה. כאשר הבדיקה תושלם, תוכלו לבוא לאסוף את הבגד. אנא הניחו את התשלום במעטפה או בחריץ המיועד יחד עם הבגד. המחירים שלנו הם 5 דולרים עבור בגד פשוט, ו-10 דולרים עבור בגד עם בטנה, כגון חליפה או מעיל. תודה שבחרתם במעבדת השעטנז.";
        return xmlResponse(
          gather(`/api/twilio/gather?step=menu`, 1, 2, say(generalEn, generalHe)) +
          redirect(`/api/twilio/voice?clear=true`)
        );
      }
      if (cleanDigits === "2") {
        console.log(`[Twilio IVR Log] Main Menu: Option 2 requested. Clean Caller Phone: "${cleanPhone}"`);
        if (cleanPhone && cleanPhone.length >= 7) {
          const spacedPhone = cleanPhone.split("").join(" ");
          return xmlResponse(
            gather(
              `/api/twilio/gather?step=caller_id_confirm&callerPhone=${cleanPhone}`,
              1,
              10,
              say(
                `We see you are calling from, ${spacedPhone}. Press 1 to search for orders with this number. Press 2 to enter a different number.`,
                `אנו רואים שאתה מתקשר ממספר, ${spacedPhone}. הקש 1 לחיפוש הזמנות עם מספר זה. הקש 2 להזנת מספר אחר.`
              )
            ) +
            say("No input received. Returning to main menu.", "לא התקבל קלט. חוזר לתפריט הראשי.") +
            redirect(`/api/twilio/voice`)
          );
        } else {
          // Fallback if caller ID is not available
          return xmlResponse(
            gather(
              `/api/twilio/gather?step=order_lookup`,
              10,
              10,
              say(
                "Please enter your order number, or your ten digit phone number, followed by pound.",
                "אנא הקש את מספר ההזמנה, או את מספר הטלפון שלך בן עשר ספרות, ולאחר מכן סולמית."
              )
            ) +
            say("No input received. Returning to main menu.", "לא התקבל קלט. חוזר לתפריט הראשי.") +
            redirect(`/api/twilio/voice`)
          );
        }
      }
      if (cleanDigits === "3") {
        console.log(`[Twilio IVR Log] Main Menu: Option 3 played.`);
        const specialEn = settings.ivrSpecialEn || "We offer premium special services, including VIP home testing visits for an additional fee, as well as on-site testing for clothing stores and warehouses to ensure the entire inventory is certified clean of shatnez. Please speak to a representative for details and pricing.";
        const specialHe = settings.ivrSpecialHe || "אנו מציעים שירותים מיוחדים מובחרים, כולל ביקורי בית של מומחה לבדיקת VIP בתוספת תשלום, וכן בדיקות מקומיות בחנויות בגדים ומחסנים כדי להבטיח שכל המלאי נקי משעטנז. אנא שוחחו עם נציג לקבלת פרטים ומחירים.";
        return xmlResponse(
          gather(`/api/twilio/gather?step=menu`, 1, 2, say(specialEn, specialHe)) +
          redirect(`/api/twilio/voice?clear=true`)
        );
      }
      if (cleanDigits === "0") {
        console.log(`[Twilio IVR Log] Main Menu: Option 0 - Forwarding call to representative.`);
        const num = settings.forwardingNumber || "8457092022";
        const formattedNum = formatDialNumber(num);
        const callerIdAttr = toPhoneNumber ? ` callerId="${toPhoneNumber}"` : "";
        console.log(`[Twilio IVR Log] Forwarding to: ${formattedNum} with Caller ID: ${toPhoneNumber || "default"}`);
        return xmlResponse(
          say("Connecting you to a representative. Please wait.", "מעביר אותך לנציג. אנא המתן.") +
          `<Dial${callerIdAttr}>${formattedNum}</Dial>`
        );
      }
      if (cleanDigits === "9") {
        console.log(`[Twilio IVR Log] Main Menu: Option 9 - Requesting admin PIN.`);
        return xmlResponse(
          gather(
            `/api/twilio/gather?step=admin_pin`,
            4,
            10,
            say("Please enter your 4 digit admin PIN.", "אנא הקש את קוד המנהל בן 4 הספרות.")
          ) +
          say("No input received. Returning to main menu.", "לא התקבל קלט. חוזר לתפריט הראשי.") +
          redirect(`/api/twilio/voice`)
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
        redirect(`/api/twilio/voice`)
      );
    }

    // ── Caller ID Confirmation ──
    if (step === "caller_id_confirm") {
      const callerPhone = url.searchParams.get("callerPhone") || "";
      console.log(`[Twilio IVR Log] Caller ID Confirm Digit: "${digits}" for phone: "${callerPhone}"`);
      if (digits === "1") {
        const orders = await getOrdersByPhone(callerPhone);
        if (orders.length === 0) {
          console.log(`[Twilio IVR Log] No orders found for phone: "${callerPhone}". Prompting manual entry.`);
          return xmlResponse(
            gather(
              `/api/twilio/gather?step=order_lookup`,
              10,
              10,
              say(
                "We could not find any orders associated with this number. Please enter your order number, or another phone number, followed by pound.",
                "לא מצאנו הזמנות המשויכות למספר זה. אנא הקש מספר הזמנה, או מספר טלפון אחר, ולאחריו סולמית."
              )
            ) +
            say("No input received. Returning to main menu.", "לא התקבל קלט. חוזר לתפריט הראשי.") +
            redirect(`/api/twilio/voice`)
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
          }
        }
        
        return xmlResponse(
          say(enMsg, heMsg) +
          redirect(`/api/twilio/voice`)
        );
      }
      
      // If they press 2 or anything else, prompt manual lookup
      return xmlResponse(
        gather(
          `/api/twilio/gather?step=order_lookup`,
          10,
          10,
          say(
            "Please enter your order number, or your ten digit phone number, followed by pound.",
            "אנא הקש את מספר ההזמנה, או את מספר הטלפון שלך בן עשר ספרות, ולאחר מכן סולמית."
          )
        ) +
        say("No input received. Returning to main menu.", "לא התקבל קלט. חוזר לתפריט הראשי.") +
        redirect(`/api/twilio/voice`)
      );
    }

    // ── Order Lookup ──
    if (step === "order_lookup") {
      const clean = digits.replace(/#$/, "").trim().toUpperCase();
      console.log(`[Twilio IVR Log] Order Lookup Input: "${clean}"`);
      if (!clean) {
        return xmlResponse(
          say("No order number entered. Returning to main menu.", "לא הוקש מספר הזמנה. חוזר לתפריט הראשי.") +
          redirect(`/api/twilio/voice`)
        );
      }
      return await lookupOrder(clean, origin);
    }

    // ── Admin PIN ──
    if (step === "admin_pin") {
      const cleanPin = digits.replace(/#$/, "").trim();
      console.log(`[Twilio IVR Log] Admin PIN entered: "${cleanPin}" (Expected: "${ADMIN_PIN}")`);
      if (cleanPin === ADMIN_PIN) {
        return xmlResponse(
          gather(
            `/api/twilio/gather?step=admin_menu`,
            1,
            15,
            say(
              "Admin menu. Press 1 to hear recent orders. Press 2 to update an order. Press 3 to lookup by phone. Press 4 to add a new order. Press star to return to main menu.",
              "תפריט מנהל. הקש 1 לשמיעת הזמנות אחרונות. הקש 2 לעדכון הזמנה. הקש 3 לחיפוש לפי טלפון. הקש 4 להוספת הזמנה חדשה. הקש כוכבית לחזרה לתפריט הראשי."
            )
          ) +
          say("No input received. Goodbye.", "לא התקבל קלט. שלום.")
        );
      }
      return xmlResponse(
        say("Incorrect PIN. Returning to main menu.", "קוד שגוי. חוזר לתפריט הראשי.") + 
        redirect(`/api/twilio/voice`)
      );
    }

    // ── Admin Menu ──
    if (step === "admin_menu") {
      const menuSelection = (cleanDigits.length === 1 || cleanDigits === "*") ? cleanDigits : "";
      console.log(`[Twilio IVR Log] Admin Menu option entered: "${digits}" (menuSelection: "${menuSelection}")`);
      if (menuSelection === "1") {
        const orders = await getAllOrders();
        const recent = orders.slice(-5).reverse();
        if (recent.length === 0) {
          return xmlResponse(
            say("No orders found.", "לא נמצאו הזמנות.") + 
            redirect(`/api/twilio/gather?step=admin_menu&clear=true`)
          );
        }
        let enMsg = `You have ${orders.length} total orders. Here are the latest 5. `;
        let heMsg = `יש לך ${orders.length} הזמנות בסך הכל. הנה ה-5 האחרונות. `;
        for (const o of recent) {
          const safeId = String(o.id).replace(/-/g, " dash ");
          const safeIdHe = String(o.id).replace(/-/g, " מקף ");
          enMsg += `Order ${safeId}, ${o.customerName || "Customer"}, status ${o.status || "received"}. `;
          heMsg += `הזמנה ${safeIdHe}, ${o.customerName || "לקוח"}, סטטוס ${translateStatus(o.status || "received")}. `;
        }
        return xmlResponse(
          say(enMsg, heMsg) +
          gather(
            `/api/twilio/gather?step=admin_menu`,
            1,
            10,
            say("Press any key to return to admin menu, or star for main menu.", "הקש על מקש כלשהו לחזרה לתפריט המנהל, או כוכבית לתפריט הראשי.")
          )
        );
      }
      if (menuSelection === "2") {
        return xmlResponse(
          gather(
            `/api/twilio/gather?step=status_update_ask_id`,
            10,
            10,
            say("Enter the order number to update, followed by pound.", "הקש את מספר ההזמנה לעדכון, ולאחריו סולמית.")
          ) +
          say("No input received.", "לא התקבל קלט.") +
          redirect(`/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      if (menuSelection === "3") {
        return xmlResponse(
          gather(
            `/api/twilio/gather?step=lookup_by_phone`,
            10,
            10,
            say("Enter the phone number, followed by pound.", "הקש את מספר הטלפון, ולאחריו סולמית.")
          ) +
          say("No input received.", "לא התקבל קלט.") +
          redirect(`/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      if (menuSelection === "4") {
        return xmlResponse(
          gather(
            `/api/twilio/gather?step=admin_add_order`,
            10,
            10,
            say("Enter the customer phone number for the new order, followed by pound.", "הקש את מספר הטלפון של הלקוח עבור ההזמנה החדשה, ולאחריו סולמית.")
          ) +
          say("No input received.", "לא התקבל קלט.") +
          redirect(`/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      if (!menuSelection) {
        // Just play the menu options (do not say invalid choice, as it was likely a redirect transition)
        return xmlResponse(
          gather(
            `/api/twilio/gather?step=admin_menu`,
            1,
            15,
            say(
              "Admin menu. Press 1 to hear recent orders. Press 2 to update an order. Press 3 to lookup by phone. Press 4 to add a new order. Press star to return to main menu.",
              "תפריט מנהל. הקש 1 לשמיעת הזמנות אחרונות. הקש 2 לעדכון הזמנה. הקש 3 לחיפוש לפי טלפון. הקש 4 להוספת הזמנה חדשה. הקש כוכבית לחזרה לתפריט הראשי."
            )
          ) +
          say("No input received. Goodbye.", "לא התקבל קלט. שלום.")
        );
      }
      return xmlResponse(
        say("Invalid option.", "אופציה לא תקינה.") + 
        redirect(`/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Status Update: Ask for Order ID ──
    if (step === "status_update_ask_id") {
      const clean = digits.replace(/#$/, "").trim().toUpperCase();
      console.log(`[Twilio IVR Log] Admin Status Ask Order ID: "${clean}"`);
      const order = await getOrderById(clean);
      if (!order) {
        return xmlResponse(
          say("Order not found.", "הזמנה לא נמצאה.") + 
          redirect(`/api/twilio/gather?step=admin_menu`)
        );
      }
      const safeId = String(order.id).replace(/-/g, " dash ");
      const safeIdHe = String(order.id).replace(/-/g, " מקף ");
      return xmlResponse(
        say(
          `Order ${safeId} is currently ${order.status || "received"}.`,
          `הזמנה ${safeIdHe} כרגע בסטטוס ${translateStatus(order.status || "received")}.`
        ) +
        gather(
          `/api/twilio/gather?step=status_update_set&orderId=${order.id}`,
          1,
          15,
          say(
            "Press 1 for received. 2 for in testing. 3 for under review. 4 for ready for pickup. 5 for delivered. 6 for attention needed. Star to cancel.",
            "הקש 1 עבור התקבל. 2 עבור בבדיקה. 3 עבור בביקורת. 4 עבור מוכן לאיסוף. 5 עבור נמסר. 6 עבור דרוש טיפול. כוכבית לביטול."
          )
        )
      );
    }

    // ── Status Update: Set New Status ──
    if (step === "status_update_set") {
      const orderId = url.searchParams.get("orderId");
      console.log(`[Twilio IVR Log] Admin Status Set digit: "${digits}" for order ID: "${orderId}"`);
      const statusMap: Record<string, string> = {
        "1": "received", "2": "testing", "3": "review", "4": "ready", "5": "delivered", "6": "issue",
      };
      const newStatus = statusMap[digits];
      if (!newStatus || !orderId) {
        return xmlResponse(
          say("Invalid option.", "אופציה לא תקינה.") + 
          redirect(`/api/twilio/gather?step=admin_menu`)
        );
      }
      
      return xmlResponse(
        gather(
          `/api/twilio/gather?step=status_update_result_set&orderId=${orderId}&newStatus=${newStatus}`,
          1,
          15,
          say(
            "Status noted. Now update the test result. Press 1 for clean, 2 for shatnez found, or star to keep existing result.",
            "הסטטוס נקלט. כעת לעדכון תוצאת הבדיקה. הקש 1 עבור נקי משעטנז, 2 עבור נמצא שעטנז, או כוכבית כדי להשאיר את התוצאה הנוכחית."
          )
        )
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
          redirect(`/api/twilio/gather?step=admin_menu`)
        );
      }

      const order = await getOrderById(orderId);
      if (!order) {
        return xmlResponse(
          say("Order not found.", "הזמנה לא נמצאה.") + 
          redirect(`/api/twilio/gather?step=admin_menu`)
        );
      }

      let newResult = order.result || "";
      if (digits === "1") {
        newResult = "Clean / No Shatnez";
      } else if (digits === "2") {
        newResult = "Shatnez Found";
      }

      await saveOrder({
        ...order,
        status: newStatus as any,
        result: newResult
      });

      return xmlResponse(
        gather(`/api/twilio/gather?step=admin_menu`, 1, 2, say(
          `Order successfully updated. Status is ${newStatus}, result is ${newResult || "not set"}. Returning to admin menu.`,
          `ההזמנה עודכנה בהצלחה. הסטטוס הוא ${translateStatus(newStatus)}, התוצאה היא ${newResult === "Clean / No Shatnez" ? "נקי משעטנז" : newResult === "Shatnez Found" ? "נמצא שעטנז" : "לא נקבעה"}. חוזר לתפריט המנהל.`
        )) +
        redirect(`/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    // ── Lookup by Phone ──
    if (step === "lookup_by_phone") {
      const clean = digits.replace(/#$/, "").trim();
      console.log(`[Twilio IVR Log] Admin Lookup by phone: "${clean}"`);
      const orders = await getOrdersByPhone(clean);
      if (orders.length === 0) {
        return xmlResponse(
          say("No orders found for that phone number.", "לא נמצאו הזמנות עבור מספר הטלפון הזה.") +
          redirect(`/api/twilio/gather?step=admin_menu&clear=true`)
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
          `/api/twilio/gather?step=admin_menu`,
          1,
          10,
          say("Press any key to return to admin menu, or star for main menu.", "הקש על מקש כלשהו לחזרה לתפריט המנהל, או כוכבית לתפריט הראשי.")
        )
      );
    }

    // ── Admin: Add Order ──
    if (step === "admin_add_order") {
      const phone = digits.replace(/#$/, "").trim();
      console.log(`[Twilio IVR Log] Admin Add Order phone: "${phone}"`);
      if (!phone) {
        return xmlResponse(
          say("No phone number entered.", "לא הוקש מספר טלפון.") +
          redirect(`/api/twilio/gather?step=admin_menu&clear=true`)
        );
      }
      const orders = await getAllOrders();
      const existingIds = orders.map(o => parseInt(String(o.id).replace(/\D/g, "")) || 0);
      const max = existingIds.length > 0 ? Math.max(...existingIds) : 0;
      const next = max < 100 ? 101 : max + 1;
      const newId = String(next);
      
      await saveOrder({
        id: newId, customerName: "Phone Customer", phone: phone, status: "received",
        dateReceived: new Date().toISOString().split("T")[0], estimatedCompletion: "",
        notes: "Added via phone system", result: ""
      });
      return xmlResponse(
        gather(`/api/twilio/gather?step=admin_menu`, 1, 2, say(
          `Order created successfully. The order ID is ${newId}.`,
          `ההזמנה נוצרה בהצלחה. מספר ההזמנה הוא ${newId}.`
        )) +
        redirect(`/api/twilio/gather?step=admin_menu&clear=true`)
      );
    }

    return xmlResponse(redirect(`/api/twilio/voice`));
  } catch (error) {
    console.error("IVR Error:", error);
    return xmlResponse(
      say("An error occurred. Returning to main menu.", "אירעה שגיאה. חוזר לתפריט הראשי.") +
      redirect(`/api/twilio/voice`)
    );
  }
}

async function lookupOrder(input: string, origin: string) {
  try {
    let order = await getOrderById(input);
    if (!order && input.replace(/\D/g, "").length >= 7) {
      const byPhone = await getOrdersByPhone(input);
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
            `/api/twilio/gather?step=menu`,
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
        redirect(`/api/twilio/voice`)
      );
    }

    console.log(`[Twilio IVR Log] lookupOrder: Found order ID: "${order.id}", status: "${order.status}", result: "${order.result}"`);

    const enStatus = order.status === "received" ? "received and logged" : order.status === "testing" ? "in testing" : order.status === "review" ? "under review" : order.status === "ready" ? "ready for pickup" : order.status === "delivered" ? "delivered" : "needs attention";
    const heStatus = translateStatus(order.status || "received");
    const safeId = String(order.id).replace(/-/g, " dash ");
    const safeIdHe = String(order.id).replace(/-/g, " מקף ");
    
    let enMsg = `Order ${safeId} is currently ${enStatus}. `;
    let heMsg = `הזמנה ${safeIdHe} היא כרגע ${heStatus}. `;
    if (order.estimatedCompletion) {
      enMsg += `Estimated completion is ${order.estimatedCompletion}. `;
      heMsg += `תאריך סיום משוער הוא ${order.estimatedCompletion}. `;
    }
    
    if (order.result) {
      const translatedResult = order.result === "Clean / No Shatnez" ? "נקי משעטנז" : order.result === "Shatnez Found" ? "נמצא שעטנז" : order.result;
      enMsg += `Test result is: ${order.result}. `;
      heMsg += `תוצאת הבדיקה היא: ${translatedResult}. `;
    }
    
    return xmlResponse(
      gather(`/api/twilio/gather?step=menu`, 1, 2, say(enMsg, heMsg)) +
      redirect(`/api/twilio/voice?clear=true`)
    );
  } catch (error) {
    console.error("Lookup Error:", error);
    return xmlResponse(
      say("Error looking up order. Returning to main menu.", "שגיאה בחיפוש ההזמנה. חוזר לתפריט הראשי.") +
      redirect(`/api/twilio/voice`)
    );
  }
}
