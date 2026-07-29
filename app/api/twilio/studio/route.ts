import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrdersByPhone, getNextOrderId, getAllOrders, saveOrder, getAdminSettings, saveVoicemail, logCallEvent, getAdminState, saveAdminState, clearAdminState, logSmsMessage, getAllCalls, getRecentCalls, getRecentSmsMessages, getTwilioBalance, saveDeliveryRequest } from "@/lib/db";
import { triggerOutboundCall, sendSms, triggerCallBridge } from "@/lib/twilioCall";
import { findChatSessionByShortId, addChatMessage } from "@/lib/liveChat";
import nodemailer from "nodemailer";

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

// Helper to translate status to friendly Hebrew
function translateStatus(status: string): string {
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

// Helper to translate status to friendly English
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

// Helper to check and generate a unique order ID by appending -2, -3 etc. if needed
async function getUniqueOrderId(baseId: string): Promise<string> {
  const cleanBaseId = baseId.trim();
  let finalId = cleanBaseId;
  let existing = await getOrderById(finalId);
  if (existing) {
    let counter = 2;
    while (await getOrderById(`${cleanBaseId}-${counter}`)) {
      counter++;
    }
    finalId = `${cleanBaseId}-${counter}`;
  }
  return finalId;
}

// Global CORS or response headers if needed, but since it's an API, simple JSON response is fine.
function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return jsonResponse({ success: true });
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

async function handleRequest(req: NextRequest) {
  try {
    const url = new URL(req.url);
    
    // Parse body parameters safely (can be urlencoded from Twilio or JSON)
    let body: any = {};
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        formData.forEach((value, key) => {
          body[key] = value;
        });
      } else if (contentType.includes("application/json")) {
        body = await req.json();
      }
    }
    
    // Fallback to query params if not in body
    const rawAction = (body.action || url.searchParams.get("action") || "").trim();
    
    // Auto-detect action if there's any recording-related parameter
    let action = rawAction;
    const hasRecordingParam = !!(
      body.recordingUrl || body.RecordingUrl || body.recording_url ||
      body.RecordingSid || body.recordingSid || body.recording_sid ||
      url.searchParams.get("recordingUrl") || url.searchParams.get("RecordingUrl") || url.searchParams.get("recording_url") ||
      url.searchParams.get("RecordingSid") || url.searchParams.get("recordingSid") || url.searchParams.get("recording_sid")
    );
    if (!action && hasRecordingParam) {
      action = "voicemail";
      console.log(`[Twilio Studio API] Auto-detected action as "voicemail" due to recording parameters`);
    }

    const getParam = (name: string) => {
      const lowerName = name.trim().toLowerCase();
      for (const [key, value] of Object.entries(body)) {
        if (key.trim().toLowerCase() === lowerName) return (typeof value === "string" ? value : "").trim();
      }
      for (const [key, value] of Array.from(url.searchParams.entries())) {
        if (key.trim().toLowerCase() === lowerName) return value.trim();
      }
      return "";
    };

    const query = getParam("query");
    const phone = getParam("phone") || getParam("From") || getParam("Caller") || "";
    const pin = getParam("pin");
    const callSid = getParam("CallSid") || getParam("callSid") || getParam("call_sid") || getParam("FromSid") || "";
    
    console.log(`[Twilio Studio API] Action: "${action}" (Raw: "${rawAction}"), Query: "${query}", Phone: "${phone}", PIN: "${pin}", CallSid: "${callSid}"`);

    // ─── GLOBAL LIVE CHAT SMS REPLY INTERCEPTION ───
    const incomingSmsText = getParam("msg") || getParam("Body") || getParam("body") || getParam("message") || getParam("text") || getParam("SpeechResult") || "";
    const incomingSmsPhone = getParam("phone") || getParam("From") || getParam("from") || getParam("Caller") || "";
    const trimmedSmsText = incomingSmsText.trim();

    if (trimmedSmsText) {
      const chatMatch = trimmedSmsText.match(/^(?:#|\b)(\d{3,5})\b[:\s,.-]*([\s\S]*)/);
      if (chatMatch) {
        const targetShortId = chatMatch[1];
        let replyText = chatMatch[2].trim();
        if (!replyText) replyText = trimmedSmsText;

        const chatSession = await findChatSessionByShortId(targetShortId);
        if (chatSession && replyText) {
          console.log(`[Twilio Studio API Global Intercept] Adding reply to Live Chat session #${chatSession.shortId}: "${replyText}"`);
          await addChatMessage(chatSession.sessionId, "admin", replyText);
          if (incomingSmsPhone) {
            await logSmsMessage(incomingSmsPhone, trimmedSmsText, "inbound");
            await logCallEvent(undefined, incomingSmsPhone, `Live Chat SMS Reply: "${replyText}"`, "completed");
          }
          return jsonResponse({ success: true, replyMessage: "" });
        }
      }
    }

    // ─── 0.0 LOG CALL START ───
    if (action === "log_call_start") {
      console.log(`[Twilio Studio API] Logging call start for CallSid: ${callSid}, Phone: ${phone}`);
      await logCallEvent(callSid, phone, "Call started", "active");
      return jsonResponse({ success: true });
    }

    // ─── 0.1 LOG MENU KEYPRESS ───
    if (action === "log_keypress") {
      const digit = getParam("digit");
      console.log(`[Twilio Studio API] Logging keypress for CallSid: ${callSid}, Phone: ${phone}, Digit: ${digit}`);
      
      const labelMap: Record<string, string> = {
        "1": "Pressed Option 1 (Garment Dropoff)",
        "2": "Pressed Option 2 (Check Order Status)",
        "3": "Pressed Option 3 (Special Services)",
        "4": "Pressed Option 4 (Leave Voicemail)",
        "5": "Pressed Option 5 (Delivery Services)",
        "9": "Pressed Option 9 (Admin Access Request)",
        "0": "Requested Representative"
      };

      const logLabel = labelMap[digit] || `Pressed Option ${digit}`;
      await logCallEvent(callSid, phone, logLabel);
      return jsonResponse({ success: true });
    }

    // ─── 0. CHECK BUSINESS HOURS ───
    if (action === "check_hours") {
      const settings = await getAdminSettings();
      
      await logCallEvent(callSid, phone, "Requested Representative");

      if (settings.holidayModeActive) {
        console.log(`[Twilio Studio API] check_hours - Holiday Mode Active. Routing to Voicemail.`);
        await logCallEvent(callSid, phone, "Redirected to Voicemail (Holiday Mode)", "voicemail");
        const holEn = settings.ivrHolidayMsgEn || "Our office is currently closed for the holidays. Please leave a message after the beep.";
        const holHe = settings.ivrHolidayMsgHe || "המשרד סגור כעת לרגל החג. אנא השאירו הודעה לאחר הצפצוף.";
        return jsonResponse({
          isWithinHours: false,
          forwardingNumber: "",
          callerId: "",
          messageEn: holEn,
          messageHe: holHe
        });
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

      const num = settings.forwardingNumber || "8457092022";
      const formatDialNumber = (n: string) => {
        const clean = n.replace(/\D/g, "");
        if (clean.length === 10) return `+1${clean}`;
        if (clean.length === 11 && clean.startsWith("1")) return `+${clean}`;
        if (clean.length > 0) return `+${clean}`;
        return `+18457092022`;
      };
      const formattedNum = formatDialNumber(num);

      // Determine Caller ID to use for forwarding
      const callerIdType = settings.callerIdType || "caller";
      let callerId = phone; // default is customer's phone number
      if (callerIdType === "twilio" && settings.twilioPhoneNumber) {
        callerId = settings.twilioPhoneNumber;
      }
      if (!callerId) {
        callerId = getParam("From") || settings.twilioPhoneNumber || "";
      }

      console.log(`[Twilio Studio API] check_hours: isWithinHours=${isWithinHours}, forwardingTo=${formattedNum}, callerId=${callerId}, currentNYTime=${nyTime.toISOString()}`);

      if (isWithinHours) {
        await logCallEvent(callSid, phone || callerId, "Forwarded to Representative", "completed");
      } else {
        await logCallEvent(callSid, phone || callerId, "Redirected to Voicemail (Outside Hours)", "voicemail");
      }

      return jsonResponse({
        isWithinHours,
        forwardingNumber: formattedNum,
        callerId,
        messageEn: "Our office is currently closed. Please leave a message after the beep, and we will get back to you.",
        messageHe: "המשרד סגור כעת. אנא השאירו הודעה לאחר הצפצוף, ונחזור אליכם בהקדם."
      });
    }

    // ─── DEBUG DIAGNOSTICS ───
    if (action === "debug") {
      let dbError: string | null = null;
      let settings: any = null;
      try {
        settings = await getAdminSettings();
      } catch (err: any) {
        dbError = err.message || String(err);
      }
      return jsonResponse({
        timestamp: Date.now(),
        settings,
        dbError
      });
    }

    // ─── 10. SAVE DELIVERY REQUEST (STUDIO FLOW ACTION) ───
    if (action === "save_delivery") {
      const speechResult = getParam("SpeechResult") || "";
      console.log(`[Twilio Studio API] Saving delivery request for CallSid: ${callSid}, Phone: ${phone}, SpeechResult: "${speechResult}"`);
      
      await logCallEvent(callSid, phone, `Confirmed Delivery Request - Stated address: "${speechResult}"`);

      // Try to look up customer name from existing orders with the same phone
      let customerName = "Unknown Caller";
      if (phone) {
        const cleanPhone = phone.replace(/\D/g, "");
        const searchPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1") ? cleanPhone.substring(1) : cleanPhone;
        const phoneOrders = await getOrdersByPhone(searchPhone);
        const found = phoneOrders.find(o => o.customerName);
        if (found) customerName = found.customerName;
      }

      const deliveryReq = {
        id: callSid || `del_${Date.now()}`,
        phone: phone || "",
        customerName,
        timestamp: Date.now(),
        status: "pending" as const,
        createdAt: new Date().toISOString(),
        notes: speechResult
      };

      await saveDeliveryRequest(deliveryReq);

      // Send SMS notification to the admin
      const settings = await getAdminSettings();
      const adminPhone = settings.forwardingNumber || "8455524744";
      const smsMessage = `New pickup & delivery request from: ${phone}. Address stated: "${speechResult}". Please check the admin panel to arrange.`;
      try {
        await sendSms(adminPhone, smsMessage);
        console.log(`[Twilio Studio API] Admin SMS notification sent to ${adminPhone}`);
      } catch (smsErr) {
        console.error("[Twilio Studio API] Failed to send Admin SMS notification:", smsErr);
      }

      return jsonResponse({ success: true });
    }

    // ─── 1. CALLER LOOKUP BY PHONE ───
    if (action === "caller_lookup") {
      if (!phone) {
        return jsonResponse({
          found: false,
          ordersCount: 0,
          messageEn: "No phone number detected.",
          messageHe: "No phone number detected."
        });
      }

      // Clean caller phone to match normalized DB phone numbers
      const cleanPhone = phone.replace(/\D/g, "");
      const searchPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1") ? cleanPhone.substring(1) : cleanPhone;
      
      console.log(`[Twilio Studio API] Performing Caller Lookup for: "${searchPhone}"`);
      await logCallEvent(callSid, phone, "Auto Caller Lookup");
      const rawOrders = await getOrdersByPhone(searchPhone);
      const orders = rawOrders.filter(o => !o.archived);

      if (orders.length === 0) {
        return jsonResponse({
          found: false,
          ordersCount: 0,
          messageEn: `No orders found for phone number ${phone.split("").join(" ")}.`,
          messageHe: `No orders found for phone number ${phone.split("").join(" ")}.`
        }, 404);
      }

      const latestOrder = orders[0];
      const safeId = String(latestOrder.id).split("").join(" ");
      const enStatus = translateStatusEn(latestOrder.status || "received");
      
      let enMsg = `Your latest order ${safeId} is ${enStatus}. `;
      
      if (latestOrder.result) {
        enMsg += `Test result is: ${latestOrder.result}. `;
      } else {
        enMsg += `Test result is: not available yet. `;
      }

      if (latestOrder.status === "ready") {
        const locEn = latestOrder.location || "14 Buchanan Rd";
        enMsg += `Please pick up at ${locEn}. `;
      }

      enMsg += "Thank you for calling The Shatnez Lab. Goodbye.";

      return jsonResponse({
        found: true,
        ordersCount: 1,
        messageEn: enMsg.trim(),
        messageHe: enMsg.trim()
      });
    }

    // ─── 2. MANUAL LOOKUP (BY ORDER ID OR PHONE) ───
    if (action === "manual_lookup") {
      if (!query) {
        return jsonResponse({
          found: false,
          messageEn: "Please enter an order number or phone number.",
          messageHe: "Please enter an order number or phone number."
        });
      }

      console.log(`[Twilio Studio API] Performing Manual Lookup for: "${query}"`);
      await logCallEvent(callSid, phone || "Unknown", `Typed status check: ${query}`);
      
      // Try Order ID first
      let order = await getOrderById(query);
      if (order && order.archived) {
        order = null;
      }
      
      // If not found, check if it looks like a phone number to search by phone
      if (!order && query.replace(/\D/g, "").length >= 7) {
        const allByPhone = await getOrdersByPhone(query);
        const byPhone = allByPhone.filter(o => !o.archived);
        if (byPhone.length > 0) {
          order = byPhone[0];
        }
      }

      if (!order) {
        return jsonResponse({
          found: false,
          messageEn: `We could not find any order with number ${query.split("").join(" ")}.`,
          messageHe: `We could not find any order with number ${query.split("").join(" ")}.`
        }, 404);
      }

      const enStatus = translateStatusEn(order.status || "received");
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

      enMsg += "Thank you for using The Shatnez Lab. Goodbye.";

      return jsonResponse({
        found: true,
        isMultiple: false,
        messageEn: enMsg.trim(),
        messageHe: enMsg.trim()
      });
    }

    // ─── 3. ADMIN LOGIN / PIN CHECK ───
    if (action === "admin_login") {
      const settings = await getAdminSettings();
      const expectedPin = settings.pin || "1234";
      const authenticated = pin === expectedPin;
      
      console.log(`[Twilio Studio API] Admin Auth attempt. Provided: "${pin}", Success: ${authenticated}`);
      await logCallEvent(callSid, phone, authenticated ? "Admin Logged In (PIN check)" : "Admin PIN Failed");
      return jsonResponse({
        authenticated,
        messageEn: authenticated ? "Access granted." : "Incorrect personal identification number.",
        messageHe: authenticated ? "הגישה אושרה." : "קוד זיהוי אישי שגוי."
      }, authenticated ? 200 : 401);
    }

    // ─── 4. ADMIN GET RECENT ORDERS ───
    if (action === "admin_get_recent") {
      console.log(`[Twilio Studio API] Fetching recent orders for Admin Menu`);
      const orders = await getAllOrders();
      // Sort by createdAt descending, fallback to dateReceived
      orders.sort((a, b) => {
        if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;
        if (a.createdAt) return -1;
        if (b.createdAt) return 1;
        return new Date(b.dateReceived || 0).getTime() - new Date(a.dateReceived || 0).getTime();
      });
      
      const recent = orders.slice(0, 5);
      
      if (recent.length === 0) {
        return jsonResponse({
          hasOrders: false,
          messageEn: "There are no orders in the system.",
          messageHe: "אין הזמנות רשומות במערכת כרגע."
        });
      }

      let enMsg = `Here are the five latest orders. `;
      let heMsg = `להלן חמש ההזמנות האחרונות. `;

      for (const o of recent) {
        const spokenId = String(o.id).split("").join(" ");
        const customer = o.customerName || "No name";
        const enStatus = translateStatusEn(o.status || "received");
        const heStatus = translateStatus(o.status || "received");
        
        const spokenDate = formatSpokenDate(o.dateReceived);
        const dateEn = spokenDate.en ? spokenDate.en : "not set";
        const dateHe = spokenDate.he ? spokenDate.he : "לא מוגדר";
        
        enMsg += `Order number ${spokenId}. Customer name is ${customer}. Status is ${enStatus}. Date received is ${dateEn}. `;
        heMsg += `הזמנה מספר ${spokenId}. שם הלקוח הוא ${customer}. הסטטוס הוא ${heStatus}. יום ההזנה הוא ${dateHe}. `;
      }

      return jsonResponse({
        hasOrders: true,
        messageEn: enMsg.trim(),
        messageHe: heMsg.trim()
      });
    }

    // ─── 5. ADMIN ADD NEW ORDER ───
    if (action === "admin_add_order") {
      let customerPhone = getParam("customerPhone") || getParam("orderId");
      let locationDigit = getParam("locationDigit");
      
      console.log(`[Twilio Studio API] Admin adding new order, Phone: "${customerPhone}", LocationDigit: "${locationDigit}"`);
      
      if (!customerPhone) {
        return jsonResponse({
          success: false,
          messageEn: "System error: No phone number was received from Twilio.",
          messageHe: "תקלה במערכת: לא התקבל מספר טלפון מהטלפון."
        });
      }

      const cleanCustomerPhone = customerPhone.replace(/\D/g, "");
      const searchPhone = cleanCustomerPhone.length === 11 && cleanCustomerPhone.startsWith("1") ? cleanCustomerPhone.substring(1) : cleanCustomerPhone;

      // Check if this phone number already has orders
      const existingOrders = await getOrdersByPhone(searchPhone);
      let customerName = "Phone Guest";
      if (existingOrders.length > 0) {
        customerName = existingOrders[0].customerName || "Phone Guest";
      }

      // Generate a new sequential ID
      const finalOrderId = await getNextOrderId();

      let selectedLoc = "14 Buchanan Rd";
      if (String(locationDigit).replace(/[^0-9]/g, "") === "2") {
        selectedLoc = "166 Clinton Lane";
      }

      const today = new Date().toISOString().split("T")[0];
      await saveOrder({
        id: finalOrderId,
        customerName: customerName,
        phone: customerPhone,
        status: "received",
        dateReceived: today,
        estimatedCompletion: "",
        notes: "Created via Phone IVR Admin Menu",
        result: "",
        location: selectedLoc,
        createdAt: Date.now()
      });

      const spokenLocation = selectedLoc === "166 Clinton Lane" ? "at 166 Clinton Lane" : "at 14 Buchanan Road";
      const spokenLocationHe = selectedLoc === "166 Clinton Lane" ? "במיקום קלינטון 166" : "במיקום ביוקנן 14";

      const spokenId = finalOrderId.split("").join(" ");

      return jsonResponse({
        success: true,
        messageEn: `<speak>Order number <say-as interpret-as="digits">${spokenId}</say-as> was successfully added ${spokenLocation} for customer ${customerName}.</speak>`,
        messageHe: `הזמנה מספר ${finalOrderId} עבור ${customerName} נוספה בהצלחה למערכת ${spokenLocationHe}.`
      });
    }

    // ─── 5.5 ADMIN CHECK ORDER EXISTS ───
    if (action === "admin_check_order") {
      const orderId = getParam("orderId");
      
      if (!orderId) {
        return jsonResponse({
          success: false,
          messageEn: "Missing order ID.",
          messageHe: "חסר מספר הזמנה."
        });
      }

      let order = await getOrderById(orderId);
      if (!order && orderId.replace(/\D/g, "").length >= 7) {
        const byPhone = await getOrdersByPhone(orderId.replace(/\D/g, ""));
        if (byPhone.length > 0) {
          byPhone.sort((a, b) => {
            if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;
            if (a.createdAt) return -1;
            if (b.createdAt) return 1;
            return new Date(b.dateReceived || 0).getTime() - new Date(a.dateReceived || 0).getTime();
          });
          order = byPhone[0];
        }
      }

      if (!order) {
        return jsonResponse({
          success: false,
          messageEn: `We could not find an order for phone number ${orderId.split("").join(" ")}.`,
          messageHe: `לא מצאנו הזמנה עבור מספר הטלפון ${orderId.split("").join(" ")}.`
        });
      }

      return jsonResponse({
        success: true,
        messageEn: "Order found.",
        messageHe: "הזמנה נמצאה."
      });
    }
    // ─── 6. ADMIN UPDATE ORDER STATUS ───
    if (action === "admin_update_order") {
      const orderId = getParam("orderId");
      const newStatusDigit = getParam("statusDigit");
      const resultSelection = getParam("resultSelection");
      const locationDigit = getParam("locationDigit");
      
      console.log(`[Twilio Studio API] Admin updating order: "${orderId}", statusDigit: "${newStatusDigit}", resultSelection: "${resultSelection}", locationDigit: "${locationDigit}"`);

      if (!orderId) {
        return jsonResponse({
          success: false,
          messageEn: "Missing order ID.",
          messageHe: "חסר מספר הזמנה."
        });
      }

      let order = await getOrderById(orderId);
      if (!order && orderId.replace(/\D/g, "").length >= 7) {
        const byPhone = await getOrdersByPhone(orderId.replace(/\D/g, ""));
        if (byPhone.length > 0) {
          byPhone.sort((a, b) => {
            if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;
            if (a.createdAt) return -1;
            if (b.createdAt) return 1;
            return new Date(b.dateReceived || 0).getTime() - new Date(a.dateReceived || 0).getTime();
          });
          order = byPhone[0];
        }
      }

      if (!order) {
        return jsonResponse({
          success: false,
          messageEn: `We could not find an order for phone number ${orderId.split("").join(" ")}.`,
          messageHe: `לא מצאנו הזמנה עבור מספר הטלפון ${orderId.split("").join(" ")}.`
        });
      }

      // Map digits to status values
      const statusMap: Record<string, "received" | "testing" | "review" | "ready" | "delivered" | "issue"> = {
        "1": "received",
        "2": "testing",
        "3": "review",
        "4": "ready",
        "5": "delivered",
        "6": "issue"
      };
      const oldStatus = order.status;

      const cleanStatusDigit = newStatusDigit.replace(/[^0-9]/g, "");
      const mappedStatus = statusMap[cleanStatusDigit];
      if (mappedStatus) {
        order.status = mappedStatus;
      }

      // Map digits to result values
      const cleanResultSelection = String(resultSelection).replace(/[^0-9]/g, "");
      if (cleanResultSelection === "1") {
        order.result = "Clean / No Shatnez";
      } else if (cleanResultSelection === "2") {
        order.result = "Shatnez Found";
      } else if (cleanResultSelection === "3") {
        order.result = "Call to Discuss";
      } else {
        // Debugging injection to help diagnose the "not updating" issue
        order.notes = (order.notes || "") + `\n[System Debug] Failed to parse resultSelection. Raw body: ${JSON.stringify(body)}. Clean result: '${cleanResultSelection}'`;
      }

      // Map digits to location values
      const cleanLocationDigit = String(locationDigit).replace(/[^0-9]/g, "");
      if (cleanLocationDigit === "1") {
        order.location = "14 Buchanan Rd";
      } else if (cleanLocationDigit === "2") {
        order.location = "166 Clinton Lane";
      }

      const origin = `https://${req.headers.get("host")}`;
      const notifyDigit = getParam("notifyDigit");
      const cleanNotifyDigit = notifyDigit.replace(/[^0-9]/g, "");

      await saveOrder(order);

      if (order.status === "ready" && oldStatus !== "ready" && order.phone) {
        // If notifyDigit is "2", we skip the notification
        if (cleanNotifyDigit !== "2") {
          triggerOutboundCall(order.phone, order.id, origin);
        }
      }

      const friendlyStatusEn = translateStatusEn(order.status);
      const friendlyStatusHe = translateStatus(order.status);
      const friendlyResultEn = order.result || "no result";
      let friendlyResultHe = "ללא תוצאה";
      if (order.result === "Clean / No Shatnez") friendlyResultHe = "נקי משעטנז";
      else if (order.result === "Shatnez Found") friendlyResultHe = "נמצא שעטנז";
      else if (order.result === "Call to Discuss") friendlyResultHe = "להתקשר לבירור";
      else if (order.result) friendlyResultHe = order.result;

      const locationTextEn = order.location ? `. Location is ${order.location}` : "";
      const locationTextHe = order.location ? `. המיקום הוא ${order.location === "166 Clinton Lane" ? "קלינטון 166" : "ביוקנן 14"}` : "";

      return jsonResponse({
        success: true,
        messageEn: `<speak>Phone number <say-as interpret-as="digits">${orderId.split("").join(" ")}</say-as> was successfully updated to ${friendlyStatusEn}. Result is ${friendlyResultEn}${locationTextEn}.</speak>`,
        messageHe: `הזמנה עבור מספר טלפון ${orderId.split("").join(" ")} עודכנה לסטטוס ${friendlyStatusHe}. תוצאה: ${friendlyResultHe}${locationTextHe}.`
      });
    }

    // ─── 7. VOICEMAIL RECORDING TO EMAIL ───
    if (action === "voicemail" || action === "voice") {
      console.log("[Twilio Studio API] Voicemail Body:", JSON.stringify(body));
      console.log("[Twilio Studio API] Voicemail SearchParams:", url.search);
      // Helper function to resolve parameters robustly
      const resolveParam = (possibleKeys: string[], containsKeywords: string[]): string => {
        // 1. Exact or case-insensitive match (stripping special chars)
        const cleanedPossible = possibleKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ""));
        for (const [k, v] of Object.entries(body)) {
          const cleanedK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (cleanedPossible.includes(cleanedK)) return String(v).trim();
        }
        let foundQueryVal = "";
        url.searchParams.forEach((v, k) => {
          const cleanedK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (cleanedPossible.includes(cleanedK)) {
            foundQueryVal = v.trim();
          }
        });
        if (foundQueryVal) return foundQueryVal;

        // 2. Keyword/substring match
        for (const kw of containsKeywords) {
          const lowerKw = kw.toLowerCase();
          for (const [k, v] of Object.entries(body)) {
            if (k.toLowerCase().includes(lowerKw)) return String(v).trim();
          }
          let foundKeywordVal = "";
          url.searchParams.forEach((v, k) => {
            if (k.toLowerCase().includes(lowerKw)) {
              foundKeywordVal = v.trim();
            }
          });
          if (foundKeywordVal) return foundKeywordVal;
        }
        return "";
      };

      let recordingUrl = resolveParam(["recordingurl", "recording_url"], ["url", "recor"]);
      let recordingDuration = resolveParam(["recordingduration", "recording_duration"], ["duration", "dur"]);
      let callerPhone = resolveParam(["phone", "from", "phonenumber", "phone_number"], ["phone", "from", "number"]);

      // ─── EXTRA BULLETPROOF FALLBACK FOR URL ───
      if (!recordingUrl) {
        for (const [k, v] of Object.entries(body)) {
          const valStr = String(v).trim();
          if (valStr.startsWith("http") || valStr.includes("twilio.com")) {
            recordingUrl = valStr;
            console.log(`[Twilio Studio API] Fallback matched recordingUrl from key "${k}": ${recordingUrl}`);
            break;
          }
        }
        if (!recordingUrl) {
          url.searchParams.forEach((v, k) => {
            const valStr = v.trim();
            if ((valStr.startsWith("http") || valStr.includes("twilio.com")) && !recordingUrl) {
              recordingUrl = valStr;
              console.log(`[Twilio Studio API] Fallback matched recordingUrl from key "${k}" in searchParams: ${recordingUrl}`);
            }
          });
        }
      }

      // If duration is still empty, try to find a number that isn't the phone number
      if (!recordingDuration) {
        for (const [k, v] of Object.entries(body)) {
          const valStr = String(v).trim();
          if (/^\d+$/.test(valStr) && valStr !== callerPhone.replace(/\D/g, "")) {
            recordingDuration = valStr;
            console.log(`[Twilio Studio API] Fallback matched recordingDuration from key "${k}": ${recordingDuration}`);
            break;
          }
        }
      }

      console.log(`[Twilio Studio API] Voicemail received from ${callerPhone}. Duration: ${recordingDuration}s, URL: ${recordingUrl}`);

      if (!recordingUrl) {
        return jsonResponse({
          success: false,
          messageEn: "No recording URL provided.",
          messageHe: "לא התקבלה הקלטת שמע."
        });
      }

      // ── SAVE TO DATABASE FIRST ──
      const vmId = Date.now().toString();
      try {
        await saveVoicemail({
          id: vmId,
          phone: callerPhone,
          duration: recordingDuration || "Unknown",
          url: recordingUrl,
          timestamp: Date.now(),
          read: false,
        });
        console.log(`[Twilio Studio API] Voicemail ${vmId} saved to database.`);
        await logCallEvent(callSid, callerPhone, `Voicemail Left (${recordingDuration}s)`, "voicemail", recordingDuration);
      } catch (err) {
        console.error("Failed to save voicemail to db:", err);
      }

      const settings = await getAdminSettings();
      const toEmail = settings.voicemailEmail;
      
      if (!toEmail) {
        console.warn("No voicemailEmail configured in admin settings.");
        return jsonResponse({
          success: false,
          messageEn: "Voicemail email notifications are not configured.",
          messageHe: "קבלת הודעות באימייל אינה מוגדרת."
        });
      }

      const host = settings.smtpHost || "smtp.gmail.com";
      const port = parseInt(String(settings.smtpPort || "465").trim(), 10);
      const user = settings.smtpUser;
      const pass = settings.smtpPass;

      if (!user || !pass) {
        console.error("SMTP User or Password is not configured in Admin Settings.");
        return jsonResponse({
          success: false,
          messageEn: "Voicemail email SMTP is not configured.",
          messageHe: "שרת הדואר היוצא אינו מוגדר."
        });
      }

      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user,
            pass,
          },
        });

        const mailOptions = {
          from: `"Shatnez Lab IVR" <${user}>`,
          to: toEmail,
          subject: `New Voicemail from ${callerPhone} - Shatnez Lab IVR`,
          text: `You have received a new voice message on the Shatnez Lab IVR system.\n\n` +
                `Caller: ${callerPhone}\n` +
                `Duration: ${recordingDuration} seconds\n` +
                `Recording Link: ${recordingUrl}\n\n` +
                `Please click the link above to listen to the message.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
              <h2 style="color: #1e3a5f; margin-bottom: 20px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">🔬 Shatnez Lab IVR Notification</h2>
              <p style="font-size: 16px; color: #0d1b2a;">You have received a new voicemail/message from a caller.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f1f5f9;">
                  <td style="padding: 10px; font-weight: bold; color: #475569;">Caller Phone:</td>
                  <td style="padding: 10px; color: #0d1b2a; font-family: monospace; font-size: 15px;">${callerPhone}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold; color: #475569;">Duration:</td>
                  <td style="padding: 10px; color: #0d1b2a;">${recordingDuration} seconds</td>
                </tr>
                <tr style="background-color: #f1f5f9;">
                  <td style="padding: 10px; font-weight: bold; color: #475569;">Recording:</td>
                  <td style="padding: 10px;">
                    <a href="${recordingUrl}" target="_blank" style="color: #d4af37; font-weight: bold; text-decoration: underline;">Listen to Recording</a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; text-align: center;">This is an automated notification from your Shatnez Lab Telephony System.</p>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Twilio Studio API] Voicemail email sent successfully to ${toEmail}`);
      } catch (mailErr) {
        console.error("[Twilio Studio API] Failed to send voicemail email:", mailErr);
      }

      return jsonResponse({
        success: true,
        messageEn: "Voicemail recorded successfully.",
        messageHe: "הודעת הקלטה נשמרה בהצלחה."
      });
    }

    // ─── 8. INCOMING SMS HANDLER ───
    const globalJsonResponse = jsonResponse;
    if (action === "incoming_sms") {
      const fromPhone = getParam("phone") || getParam("From") || getParam("from") || getParam("Caller") || "";
      const msgBody = getParam("msg") || getParam("Body") || getParam("body") || getParam("message") || getParam("text") || getParam("SpeechResult") || "";
      
      console.log(`[Twilio Studio API] Incoming SMS from: "${fromPhone}", body: "${msgBody}"`);

      // Log the incoming SMS message immediately in database
      await logSmsMessage(fromPhone, msgBody, "inbound");
      await logCallEvent(undefined, fromPhone, `SMS: "${msgBody}"`, "completed");

      // ─── LIVE CHAT SMS REPLY INTERCEPTION ───
      const trimmedMsg = msgBody.trim();
      const chatMatch = trimmedMsg.match(/^(?:#|\b)(\d{3,5})\b[:\s,.-]*([\s\S]*)/);
      if (chatMatch) {
        const targetShortId = chatMatch[1];
        const replyText = chatMatch[2].trim();
        const chatSession = await findChatSessionByShortId(targetShortId);
        if (chatSession) {
          console.log(`[Twilio Studio SMS] Intercepted live chat reply for session #${chatSession.shortId}: "${replyText}"`);
          if (replyText) {
            await addChatMessage(chatSession.sessionId, "admin", replyText);
          }
          return globalJsonResponse({ success: true, replyMessage: "" });
        }
      }

      // Shadow the jsonResponse function for the scope of incoming_sms to log all replies
      const jsonResponse = (data: any, status = 200) => {
        if (data && data.replyMessage) {
          logSmsMessage(fromPhone, data.replyMessage, "outbound").catch(e => {
            console.error("Error logging outbound SMS reply:", e);
          });
          logCallEvent(undefined, fromPhone, `SMS Outbound: "${data.replyMessage}"`, "completed").catch(e => {
            console.error("Error logging call event for outbound SMS reply:", e);
          });

          const isAdminPhone = fromPhone === "+18455524744" || fromPhone === "+18457092022";
          const isPinProvided = /^\d{4}(\s|$)/.test(msgBody.trim());

          if (isAdminPhone || isPinProvided) {
            // Clean emojis, markdown, and bot tags to prevent carrier filtering
            const cleanText = data.replyMessage
              .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
              .replace(/[\u2600-\u27BF]/g, "")
              .replace(/\[💬 SMS\]/g, "")
              .replace(/\[📞 Call\]/g, "")
              .replace(/`/g, "")
              .trim();

            console.log(`[Twilio Studio SMS Admin Cleaned Reply]: "${cleanText}"`);
            return globalJsonResponse({ ...data, replyMessage: cleanText }, status);
          }
        }
        return globalJsonResponse(data, status);
      };
      
      // ─── ADMIN SMS COMMANDS CHECK ───
      const settings = await getAdminSettings();
      const pin = settings.pin || "1234";
      
      const isAdminPhone = fromPhone === "+18455524744" || fromPhone === "+18457092022";
      const isPinProvided = msgBody.startsWith(pin + " ") || msgBody.trim() === pin;
      
      const partsRaw = msgBody.trim().split(/\s+/);
      const firstWord = partsRaw[0].toLowerCase();
      const validCommands = [
        "recent", "אחרונים", "אחרונות", 
        "add", "הוסף", "הזן", "חדש", 
        "update", "עדכן", "ערוך", 
        "sms", "send", "text", "שלח", "מסרון",
        "admin", "help", "היי", "hi", "עזרה", "מנהל",
        "cancel", "ביטול", "exit"
      ];
      const isCommandWithoutPin = isAdminPhone && validCommands.includes(firstWord);

      let activeState = isAdminPhone ? await getAdminState(fromPhone) : null;

      if (isAdminPhone || isPinProvided || activeState) {
        let parts = partsRaw;
        // Normalize parts array so command is always the first element in parts
        if (isPinProvided) {
          parts = partsRaw.slice(1);
          if (parts.length === 0) {
            parts = [""];
          }
        }
        
        const inputMsg = parts.join(" ").trim();
        const inputWord = parts[0]?.toLowerCase() || "";

        // If user entered a fresh command word, clear any active state to let it fall through
        const overrideCommands = ["add", "הוסף", "הזן", "חדש", "update", "עדכן", "ערוך", "recent", "אחרונים", "אחרונות", "sms", "send", "text", "שלח", "מסרון", "cancel", "ביטול", "exit", "help", "עזרה", "call", "dial", "חייג", "התקשר", "צלצל"];
        if (activeState && overrideCommands.includes(inputWord)) {
          await clearAdminState(fromPhone);
          activeState = null;
        }

        // Check for cancel command
        if (inputWord === "cancel" || inputWord === "ביטול" || inputWord === "exit") {
          await clearAdminState(fromPhone);
          return jsonResponse({
            success: true,
            replyMessage: "Process cancelled."
          });
        }

        let adminReply = isAdminPhone && !activeState ? "Hey Boss!\n" : "";

        // If there is an active state, process it as a step in the state machine
        if (activeState) {
          if (activeState.action === "add") {
            if (activeState.step === 1) {
              // Received Customer Phone
              const customerPhone = inputMsg.trim();
              if (!customerPhone) {
                return jsonResponse({
                  success: true,
                  replyMessage: "Invalid phone. Enter customer phone number:"
                });
              }

              const cleanPhone = customerPhone.replace(/\D/g, "");
              const searchPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1") ? cleanPhone.substring(1) : cleanPhone;
              const existingOrders = await getOrdersByPhone(searchPhone);
              
              const finalId = await getNextOrderId();
              
              if (existingOrders.length > 0) {
                const existingName = existingOrders[0].customerName || "SMS Admin";
                activeState.tempData.orderId = finalId;
                activeState.tempData.customerPhone = customerPhone;
                activeState.tempData.customerName = existingName;
                activeState.step = 3; // Skip name entry and go straight to location
                activeState.lastUpdated = Date.now();
                await saveAdminState(fromPhone, activeState);
                return jsonResponse({
                  success: true,
                  replyMessage: `Customer "${existingName}" found.\nSelect pickup location:\n1: 14 Buchanan Rd\n2: 166 Clinton Lane`
                });
              } else {
                activeState.tempData.orderId = finalId;
                activeState.tempData.customerPhone = customerPhone;
                activeState.step = 2;
                activeState.lastUpdated = Date.now();
                await saveAdminState(fromPhone, activeState);
                return jsonResponse({
                  success: true,
                  replyMessage: `Enter customer name (optional - reply 'no', 'skip', or '0' to skip):`
                });
              }
            }

            if (activeState.step === 2) {
              // Received Optional Customer Name
              const nameInput = inputMsg.trim();
              const skipWords = ["no", "skip", "0", "none", "לא", "בלי", "no name"];
              const isSkip = skipWords.includes(nameInput.toLowerCase());
              
              activeState.tempData.customerName = isSkip ? "SMS Admin" : nameInput;
              activeState.step = 3;
              activeState.lastUpdated = Date.now();
              await saveAdminState(fromPhone, activeState);
              return jsonResponse({
                success: true,
                replyMessage: "Select pickup location:\n1: 14 Buchanan Rd\n2: 166 Clinton Lane"
              });
            }
            
            if (activeState.step === 3) {
              // Received Location Digit
              const locationDigit = inputMsg.replace(/[^0-9]/g, "");
              let selectedLoc = "";
              if (locationDigit === "1") {
                selectedLoc = "14 Buchanan Rd";
              } else if (locationDigit === "2") {
                selectedLoc = "166 Clinton Lane";
              } else {
                return jsonResponse({
                  success: true,
                  replyMessage: "Invalid choice. Reply 1 for Buchanan, 2 for Clinton:"
                });
              }

              const today = new Date().toISOString().split("T")[0];
              const orderId = activeState.tempData.orderId!;
              const phoneNum = activeState.tempData.customerPhone || "";
              const customerName = activeState.tempData.customerName || "SMS Admin";
              
              await saveOrder({
                id: orderId,
                customerName: customerName,
                phone: phoneNum,
                status: "received",
                dateReceived: today,
                estimatedCompletion: "",
                notes: "Created via interactive SMS Admin",
                result: "",
                location: selectedLoc,
                createdAt: Date.now()
              });

              await clearAdminState(fromPhone);
              const nameMessage = customerName !== "SMS Admin" ? `, Name: ${customerName}` : "";
              return jsonResponse({
                success: true,
                replyMessage: `Order added! ID: ${orderId}${nameMessage}, Location: ${selectedLoc}`
              });
            }
          }

          if (activeState.action === "update") {
            if (activeState.step === 1) {
              // Received Order ID or Phone query to search
              let queryStr = inputMsg.trim();
              const noiseWords = ["order", "id", "את", "ההזמנה", "הזמנה", "new", "חדש", "חדשה", "לקוח", "לקוחה"];
              const queryParts = queryStr.split(/\s+/);
              if (queryParts.length > 1 && noiseWords.includes(queryParts[0].toLowerCase())) {
                queryStr = queryParts.slice(1).join(" ").trim();
              }
              let order = await getOrderById(queryStr);
              if (!order && queryStr.replace(/\D/g, "").length >= 7) {
                const byPhone = await getOrdersByPhone(queryStr);
                if (byPhone.length === 1) {
                  order = byPhone[0];
                } else if (byPhone.length > 1) {
                  let reply = "Multiple found. Reply exact ID:\n";
                  for (const o of byPhone) {
                    reply += `- ${o.id} (${o.status})\n`;
                  }
                  return jsonResponse({
                    success: true,
                    replyMessage: reply
                  });
                }
              }

              if (!order) {
                return jsonResponse({
                  success: true,
                  replyMessage: "Order not found. Enter valid Order ID to update:"
                });
              }

              activeState.tempData.orderId = order.id;
              activeState.step = 2;
              activeState.lastUpdated = Date.now();
              await saveAdminState(fromPhone, activeState);
              return jsonResponse({
                success: true,
                replyMessage: `Order ${order.id} found. Select status:\n1:Received 2:Testing 3:Review 4:Ready 5:Delivered 6:Issue`
              });
            }

            if (activeState.step === 2) {
              // Received Status Digit
              const statusDigit = inputMsg.replace(/[^0-9]/g, "");
              const statusMap: Record<string, string> = { "1": "received", "2": "testing", "3": "review", "4": "ready", "5": "delivered", "6": "issue" };
              if (!statusMap[statusDigit]) {
                return jsonResponse({
                  success: true,
                  replyMessage: "Invalid choice. Select status (1-6):\n1:Received 2:Testing 3:Review 4:Ready 5:Delivered 6:Issue"
                });
              }
              activeState.tempData.statusDigit = statusDigit;
              activeState.step = 3;
              activeState.lastUpdated = Date.now();
              await saveAdminState(fromPhone, activeState);
              return jsonResponse({
                success: true,
                replyMessage: "Select test result:\n1:Clean 2:Shatnez Found 3:Call to Discuss 4:No Change"
              });
            }

            if (activeState.step === 3) {
              // Received Result Digit
              const resultDigit = inputMsg.replace(/[^0-9]/g, "");
              if (!["1", "2", "3", "4"].includes(resultDigit)) {
                return jsonResponse({
                  success: true,
                  replyMessage: "Invalid choice. Select result (1-4):\n1:Clean 2:Shatnez Found 3:Call to Discuss 4:No Change"
                });
              }
              activeState.tempData.resultDigit = resultDigit;
              activeState.step = 4;
              activeState.lastUpdated = Date.now();
              await saveAdminState(fromPhone, activeState);
              return jsonResponse({
                success: true,
                replyMessage: "Select pickup location:\n1: 14 Buchanan 2: 166 Clinton 3: No Change"
              });
            }

            if (activeState.step === 4) {
              // Received Location Digit
              const locationDigit = inputMsg.replace(/[^0-9]/g, "");
              if (!["1", "2", "3"].includes(locationDigit)) {
                return jsonResponse({
                  success: true,
                  replyMessage: "Invalid choice. Select location (1-3):\n1: 14 Buchanan 2: 166 Clinton 3: No Change"
                });
              }
              activeState.tempData.locationDigit = locationDigit;
              activeState.step = 5;
              activeState.lastUpdated = Date.now();
              await saveAdminState(fromPhone, activeState);
              return jsonResponse({
                success: true,
                replyMessage: "Trigger customer robocall?\n1: Yes\n2: No"
              });
            }

            if (activeState.step === 5) {
              // Received Notify Digit
              const notifyDigit = inputMsg.replace(/[^0-9]/g, "");
              if (!["1", "2"].includes(notifyDigit)) {
                return jsonResponse({
                  success: true,
                  replyMessage: "Invalid choice. Reply 1 for Yes or 2 for No:"
                });
              }

              const orderId = activeState.tempData.orderId!;
              const order = await getOrderById(orderId);
              if (!order) {
                await clearAdminState(fromPhone);
                return jsonResponse({
                  success: true,
                  replyMessage: "Order not found in system. Process aborted."
                });
              }

              const statusMap: Record<string, "received" | "testing" | "review" | "ready" | "delivered" | "issue"> = {
                "1": "received", "2": "testing", "3": "review", "4": "ready", "5": "delivered", "6": "issue"
              };
              const oldStatus = order.status;
              const mappedStatus = statusMap[activeState.tempData.statusDigit!];
              if (mappedStatus) order.status = mappedStatus;

              const resultDigit = activeState.tempData.resultDigit!;
              if (resultDigit === "1") order.result = "Clean / No Shatnez";
              else if (resultDigit === "2") order.result = "Shatnez Found";
              else if (resultDigit === "3") order.result = "Call to Discuss";

              const locationDigit = activeState.tempData.locationDigit!;
              if (locationDigit === "1") order.location = "14 Buchanan Rd";
              else if (locationDigit === "2") order.location = "166 Clinton Lane";

              await saveOrder(order);

              // Notification call
              let callTriggered = false;
              if (order.status === "ready" && oldStatus !== "ready" && order.phone && notifyDigit !== "2") {
                const origin = `https://${req.headers.get("host")}`;
                triggerOutboundCall(order.phone, order.id, origin);
                callTriggered = true;
              }

              await clearAdminState(fromPhone);

              const friendlyStatusEn = translateStatusEn(order.status);
              const friendlyResultEn = order.result || "N/A";
              const locEn = order.location || "N/A";
              
              return jsonResponse({
                success: true,
                replyMessage: `Order ${orderId} updated!\nStatus: ${friendlyStatusEn}\nResult: ${friendlyResultEn}\nLocation: ${locEn}\nCall: ${callTriggered ? 'Yes' : 'No'}`
              });
            }
          }
        }

        // Process top-level commands (not in activeState)
        let cmd = inputWord;
        if (["אחרונים", "אחרונות"].includes(cmd)) cmd = "recent";
        else if (["הוסף", "הזן", "חדש"].includes(cmd)) cmd = "add";
        else if (["עדכן", "ערוך"].includes(cmd)) cmd = "update";
        else if (["send", "text", "שלח", "מסרון"].includes(cmd)) cmd = "sms";
        else if (["עזרה", "מנהל", "היי", "hi"].includes(cmd)) cmd = "help";

        if (cmd === "recent") {
          const secondWord = parts[1]?.toLowerCase() || "";
          if (secondWord === "orders" || secondWord === "הזמנות") {
            const orders = await getAllOrders();
            // Sort by createdAt descending, fallback to dateReceived
            orders.sort((a, b) => {
              if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;
              if (a.createdAt) return -1;
              if (b.createdAt) return 1;
              return new Date(b.dateReceived || 0).getTime() - new Date(a.dateReceived || 0).getTime();
            });
            const recent = orders.slice(0, 5);
            if (recent.length === 0) {
              adminReply += "No recent orders found.";
            } else {
              adminReply += "Recent Orders:\n";
              for (let i = 0; i < recent.length; i++) {
                const o = recent[i];
                const customer = o.customerName || "No name";
                const status = translateStatusEn(o.status || "received");
                adminReply += `${i + 1}. ID: ${o.id} | ${customer} | Status: ${status} | Date: ${o.dateReceived}\n`;
              }
            }
          } else {
            const calls = await getAllCalls();
            const uniqueCallers: { phone: string; timestamp: number; isSms: boolean }[] = [];
            const seen = new Set<string>();
            for (const c of calls) {
              if (c.phone) {
                const cleanPhone = c.phone.trim();
                if (cleanPhone && !seen.has(cleanPhone)) {
                  seen.add(cleanPhone);
                  const isSms = c.actions.some(act => act.trim().startsWith("SMS:") || act.includes("SMS:"));
                  uniqueCallers.push({ phone: cleanPhone, timestamp: c.timestamp, isSms });
                  if (uniqueCallers.length >= 5) break;
                }
              }
            }

            if (uniqueCallers.length === 0) {
              adminReply += "No recent callers found.";
            } else {
              adminReply += "Recent Callers:\n";
              for (let i = 0; i < uniqueCallers.length; i++) {
                const item = uniqueCallers[i];
                let formattedTime = "";
                try {
                  formattedTime = new Intl.DateTimeFormat("en-US", {
                    timeZone: "America/New_York",
                    month: "numeric",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true
                  }).format(new Date(item.timestamp));
                } catch (e) {
                  formattedTime = new Date(item.timestamp).toLocaleString();
                }
                const typeTag = item.isSms ? "[💬 SMS]" : "[📞 Call]";
                adminReply += `${i + 1}. ${item.phone} (${formattedTime}) ${typeTag}\n`;
              }
            }
          }
          return jsonResponse({ success: true, replyMessage: adminReply });
        }

        if (cmd === "sms") {
          // Syntax: sms [phone] [message...]
          let args = parts.slice(1);
          const targetPhone = args[0];
          const smsBody = args.slice(1).join(" ").trim();

          if (!targetPhone || !smsBody) {
            return jsonResponse({
              success: true,
              replyMessage: "Syntax: sms [phone] [message]\nExample: sms 8455551234 Hello customer!"
            });
          }

          // Clean phone number
          const cleanPhone = targetPhone.replace(/\D/g, "");
          if (cleanPhone.length < 7) {
            return jsonResponse({
              success: true,
              replyMessage: `Invalid phone number: ${targetPhone}`
            });
          }

          // Call sendSms
          const result = await sendSms(targetPhone, smsBody);
          if (result.success) {
            // Log it in database
            await logSmsMessage(targetPhone, smsBody, "outbound", result.sid);
            await logCallEvent(undefined, targetPhone, `SMS Outbound (via Admin command): "${smsBody}"`, "completed");
            return jsonResponse({
              success: true,
              replyMessage: `SMS sent successfully to ${targetPhone}!`
            });
          } else {
            return jsonResponse({
              success: true,
              replyMessage: `Failed to send SMS: ${result.error || "Unknown error"}`
            });
          }
        }
        
        if (cmd === "add") {
          // Syntax: 
          // - add -> guided flow (Step 1: Phone)
          // - add [Phone] -> guided flow (Step 2: Name)
          // - add [Name] [Phone] -> guided flow (Step 3: Location)
          // - add [Phone] [Name] -> guided flow (Step 3: Location)
          // - add [Phone] [LocationDigit] -> one-shot
          // - add [Name] [Phone] [LocationDigit] -> one-shot
          // - add [Phone] [Name] [LocationDigit] -> one-shot
          
          let args = parts.slice(1);
          const noiseWords = ["order", "id", "את", "ההזמנה", "הזמנה", "new", "חדש", "חדשה", "לקוח", "לקוחה"];
          if (args.length > 0 && noiseWords.includes(args[0].toLowerCase())) {
            args = args.slice(1);
          }

          if (args.length === 0) {
            // Interactive ADD start - Enter customer phone
            await saveAdminState(fromPhone, {
              action: "add",
              step: 1,
              tempData: {},
              lastUpdated: Date.now()
            });
            return jsonResponse({
              success: true,
              replyMessage: "Enter customer phone number:"
            });
          }

          // Check if last word is a valid location digit
          const lastWord = args[args.length - 1];
          const hasLocation = args.length > 1 && (lastWord === "1" || lastWord === "2");
          const locationDigit = hasLocation ? lastWord : undefined;
          const remainingArgs = hasLocation ? args.slice(0, args.length - 1) : args;

          // Find phone number among remaining arguments
          // A phone number has at least 7 digits when non-digits are removed
          const phoneIdx = remainingArgs.findIndex(word => word.replace(/\D/g, "").length >= 7);
          
          if (phoneIdx === -1) {
            // No phone number found in input. Start at Step 1.
            await saveAdminState(fromPhone, {
              action: "add",
              step: 1,
              tempData: {},
              lastUpdated: Date.now()
            });
            return jsonResponse({
              success: true,
              replyMessage: "Enter customer phone number:"
            });
          }

          const customerPhone = remainingArgs[phoneIdx];
          
          // Clean phone and check if customer already exists to reuse name
          const cleanPhone = customerPhone.replace(/\D/g, "");
          const searchPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1") ? cleanPhone.substring(1) : cleanPhone;
          const existingOrders = await getOrdersByPhone(searchPhone);
          
          // Name parts from input
          const nameParts = [
            ...remainingArgs.slice(0, phoneIdx),
            ...remainingArgs.slice(phoneIdx + 1)
          ];
          const customerName = nameParts.length > 0 ? nameParts.join(" ") : "";
          
          let resolvedName = customerName;
          let isReusedName = false;
          if (existingOrders.length > 0 && !resolvedName) {
            resolvedName = existingOrders[0].customerName || "SMS Admin";
            isReusedName = true;
          }

          const finalId = await getNextOrderId();

          if (hasLocation) {
            // One-shot ADD
            const selectedLoc = locationDigit === "1" ? "14 Buchanan Rd" : "166 Clinton Lane";
            const finalName = resolvedName || "SMS Admin";
            
            const today = new Date().toISOString().split("T")[0];
            await saveOrder({
              id: finalId,
              customerName: finalName,
              phone: customerPhone,
              status: "received",
              dateReceived: today,
              estimatedCompletion: "",
              notes: "Created via SMS Admin (One-shot)",
              result: "",
              location: selectedLoc,
              createdAt: Date.now()
            });

            const nameMessage = finalName !== "SMS Admin" ? `, Name: ${finalName}` : "";
            adminReply += `Order added! ID: ${finalId}${nameMessage}, Location: ${selectedLoc}`;
            return jsonResponse({ success: true, replyMessage: adminReply });
          } else {
            // Guided flow / shortcut
            if (!resolvedName) {
              // Only phone provided -> guide to Step 2 (Optional Name)
              await saveAdminState(fromPhone, {
                action: "add",
                step: 2,
                tempData: { orderId: finalId, customerPhone },
                lastUpdated: Date.now()
              });
              return jsonResponse({
                success: true,
                replyMessage: `Enter customer name (optional - reply 'no', 'skip', or '0' to skip):`
              });
            } else {
              // Phone and Name provided (or name resolved from DB), missing Location -> guide to Step 3
              await saveAdminState(fromPhone, {
                action: "add",
                step: 3,
                tempData: { orderId: finalId, customerPhone, customerName: resolvedName },
                lastUpdated: Date.now()
              });
              return jsonResponse({
                success: true,
                replyMessage: isReusedName 
                  ? `Customer "${resolvedName}" found. Select pickup location:\n1: 14 Buchanan Rd\n2: 166 Clinton Lane`
                  : `Select pickup location:\n1: 14 Buchanan Rd\n2: 166 Clinton Lane`
              });
            }
          }
        }
        
        if (cmd === "update") {
          // Syntax: update [orderId] [statusDigit] [resultDigit] [locationDigit] [notifyDigit]
          let args = parts.slice(1);
          const noiseWords = ["order", "id", "את", "ההזמנה", "הזמנה", "new", "חדש", "חדשה", "לקוח", "לקוחה"];
          if (args.length > 0 && noiseWords.includes(args[0].toLowerCase())) {
            args = args.slice(1);
          }

          const orderId = args[0];
          const statusDigit = args[1];
          const resultDigit = args[2];
          const locationDigit = args[3];
          const notifyDigit = args[4];

          if (!orderId) {
            // Interactive UPDATE start from beginning
            await saveAdminState(fromPhone, {
              action: "update",
              step: 1,
              tempData: {},
              lastUpdated: Date.now()
            });
            return jsonResponse({
              success: true,
              replyMessage: "Enter Order ID to update:"
            });
          }

          // We have orderId, let's lookup the order
          let order = await getOrderById(orderId);
          if (!order && orderId.replace(/\D/g, "").length >= 7) {
            const byPhone = await getOrdersByPhone(orderId);
            if (byPhone.length === 1) {
              order = byPhone[0];
            } else if (byPhone.length > 1) {
              let reply = "Multiple found. Reply exact ID:\n";
              for (const o of byPhone) {
                reply += `- ${o.id} (${o.status})\n`;
              }
              await saveAdminState(fromPhone, {
                action: "update",
                step: 1,
                tempData: {},
                lastUpdated: Date.now()
              });
              return jsonResponse({ success: true, replyMessage: reply });
            }
          }

          // Check for natural language words in the input message
          let detectedStatus: "received" | "testing" | "review" | "ready" | "delivered" | "issue" | null = null;
          if (/(ready|pickup|מוכן|איסוף)/i.test(inputMsg)) detectedStatus = "ready";
          else if (/(received|התקבל|קיבלנו)/i.test(inputMsg)) detectedStatus = "received";
          else if (/(testing|בבדיקה|נבדק)/i.test(inputMsg)) detectedStatus = "testing";
          else if (/(review|עיון)/i.test(inputMsg)) detectedStatus = "review";
          else if (/(delivered|נמסר|נלקח)/i.test(inputMsg)) detectedStatus = "delivered";
          else if (/(issue|בעיה|תקלה)/i.test(inputMsg)) detectedStatus = "issue";

          let detectedResult: string | null = null;
          if (/(clean|נקי|no\s*shatnez|resolts|results)/i.test(inputMsg) && !/(shatnez\s*found|found\s*shatnez|נמצא\s*שעטנז)/i.test(inputMsg)) {
            detectedResult = "Clean / No Shatnez";
          } else if (/(shatnez|found|שעטנז|נמצא)/i.test(inputMsg)) {
            detectedResult = "Shatnez Found";
          } else if (/(discuss|call\s*to\s*discuss|לדבר|להתקשר)/i.test(inputMsg)) {
            detectedResult = "Call to Discuss";
          }

          let detectedLocation: string | null = null;
          if (/(buchanan|בוכנן)/i.test(inputMsg)) detectedLocation = "14 Buchanan Rd";
          else if (/(clinton|קלינטון)/i.test(inputMsg)) detectedLocation = "166 Clinton Lane";

          if (order && (detectedStatus || detectedResult || detectedLocation)) {
            const oldStatus = order.status;
            if (detectedStatus) order.status = detectedStatus;
            if (detectedResult) order.result = detectedResult;
            if (detectedLocation) order.location = detectedLocation;

            await saveOrder(order);

            let callTriggered = false;
            if (order.status === "ready" && oldStatus !== "ready" && order.phone) {
              const origin = `https://${req.headers.get("host")}`;
              triggerOutboundCall(order.phone, order.id, origin);
              callTriggered = true;
            }

            adminReply += `Order ${order.id} updated! Status: ${order.status}, Result: ${order.result || "N/A"}, Loc: ${order.location || "N/A"}, Call: ${callTriggered ? 'Yes' : 'No'}`;
            return jsonResponse({ success: true, replyMessage: adminReply });
          }

          // If Gemini apiKey is configured, and any of the provided parameters are not digit-based,
          // let's fall through to Gemini instead of failing with "Invalid status/result/etc."
          const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
          const isNumeric = (str: string) => /^\d+$/.test(str);
          const hasNonDigitArgs = (orderId && !isNumeric(orderId)) ||
                                  (statusDigit && !isNumeric(statusDigit)) ||
                                  (resultDigit && !isNumeric(resultDigit)) ||
                                  (locationDigit && !isNumeric(locationDigit)) ||
                                  (notifyDigit && !isNumeric(notifyDigit));

          if (apiKey && hasNonDigitArgs) {
            console.log(`[Twilio Studio SMS] "update" command has non-digit arguments and Gemini is configured. Falling through to Gemini AI.`);
          } else {
            if (!order) {
              // Order not found
              await saveAdminState(fromPhone, {
                action: "update",
                step: 1,
                tempData: {},
                lastUpdated: Date.now()
              });
              return jsonResponse({
                success: true,
                replyMessage: "Order not found. Enter valid ID to update:"
              });
            }

            // Order found. Check which arguments are missing.
            const statusMap: Record<string, "received" | "testing" | "review" | "ready" | "delivered" | "issue"> = {
              "1": "received", "2": "testing", "3": "review", "4": "ready", "5": "delivered", "6": "issue"
            };

            if (!statusDigit) {
              // Missing status -> start guided at Step 2
              await saveAdminState(fromPhone, {
                action: "update",
                step: 2,
                tempData: { orderId: order.id },
                lastUpdated: Date.now()
              });

              return jsonResponse({
                success: true,
                replyMessage: `Order ${order.id} found. Continue?\nSelect status:\n1:Received 2:Testing 3:Review 4:Ready 5:Delivered 6:Issue`
              });
            }

            // Validate statusDigit
            const cleanStatus = statusDigit.replace(/[^0-9]/g, "");
            const mappedStatus = statusMap[cleanStatus];
            if (!mappedStatus) {
              return jsonResponse({
                success: true,
                replyMessage: `Invalid status (${statusDigit}). Enter 1 to 6.`
              });
            }

            if (!resultDigit) {
              // Missing result -> start guided at Step 3
              await saveAdminState(fromPhone, {
                action: "update",
                step: 3,
                tempData: { orderId: order.id, statusDigit: cleanStatus },
                lastUpdated: Date.now()
              });

              const friendlyStatusEn = translateStatusEn(mappedStatus);

              return jsonResponse({
                success: true,
                replyMessage: `Status set to: ${friendlyStatusEn}.\nSelect test result:\n1:Clean 2:Shatnez Found 3:Call to Discuss 4:No Change`
              });
            }

            // Validate resultDigit
            const cleanResult = resultDigit.replace(/[^0-9]/g, "");
            if (!["1", "2", "3", "4"].includes(cleanResult)) {
              return jsonResponse({
                success: true,
                replyMessage: `Invalid result (${resultDigit}). Enter 1 to 4.`
              });
            }

            if (!locationDigit) {
              // Missing location -> start guided at Step 4
              await saveAdminState(fromPhone, {
                action: "update",
                step: 4,
                tempData: { orderId: order.id, statusDigit: cleanStatus, resultDigit: cleanResult },
                lastUpdated: Date.now()
              });

              const friendlyStatusEn = translateStatusEn(mappedStatus);
              const resultNamesEn = { "1": "Clean / No Shatnez", "2": "Shatnez Found", "3": "Call to Discuss", "4": "No Change" };
              const friendlyResultEn = resultNamesEn[cleanResult as keyof typeof resultNamesEn] || "No Change";

              return jsonResponse({
                success: true,
                replyMessage: `Status: ${friendlyStatusEn}, Result: ${friendlyResultEn}.\nSelect location:\n1: 14 Buchanan 2: 166 Clinton 3: No Change`
              });
            }

            // Validate locationDigit
            const cleanLoc = locationDigit.replace(/[^0-9]/g, "");
            if (!["1", "2", "3"].includes(cleanLoc)) {
              return jsonResponse({
                success: true,
                replyMessage: `Invalid location (${locationDigit}). Enter 1 to 3.`
              });
            }

            if (!notifyDigit) {
              // Missing notify -> start guided at Step 5
              await saveAdminState(fromPhone, {
                action: "update",
                step: 5,
                tempData: { orderId: order.id, statusDigit: cleanStatus, resultDigit: cleanResult, locationDigit: cleanLoc },
                lastUpdated: Date.now()
              });

              const friendlyStatusEn = translateStatusEn(mappedStatus);
              const resultNamesEn = { "1": "Clean / No Shatnez", "2": "Shatnez Found", "3": "Call to Discuss", "4": "No Change" };
              const friendlyResultEn = resultNamesEn[cleanResult as keyof typeof resultNamesEn] || "No Change";
              const locNamesEn = { "1": "14 Buchanan Rd", "2": "166 Clinton Lane", "3": "No Change" };
              const friendlyLocEn = locNamesEn[cleanLoc as keyof typeof locNamesEn] || "No Change";

              return jsonResponse({
                success: true,
                replyMessage: `Status: ${friendlyStatusEn}, Result: ${friendlyResultEn}, Location: ${friendlyLocEn}.\nTrigger customer robocall?\n1: Yes\n2: No`
              });
            }

            // Validate notifyDigit
            const cleanNotify = notifyDigit.replace(/[^0-9]/g, "");
            if (!["1", "2"].includes(cleanNotify)) {
              return jsonResponse({
                success: true,
                replyMessage: `Invalid notify digit (${notifyDigit}). Enter 1 or 2.`
              });
            }

            // All 5 provided -> One-shot UPDATE
            const oldStatus = order.status;
            order.status = mappedStatus;

            if (cleanResult === "1") order.result = "Clean / No Shatnez";
            else if (cleanResult === "2") order.result = "Shatnez Found";
            else if (cleanResult === "3") order.result = "Call to Discuss";

            if (cleanLoc === "1") order.location = "14 Buchanan Rd";
            else if (cleanLoc === "2") order.location = "166 Clinton Lane";

            await saveOrder(order);

            let callTriggered = false;
            if (order.status === "ready" && oldStatus !== "ready" && order.phone && cleanNotify !== "2") {
              const origin = `https://${req.headers.get("host")}`;
              triggerOutboundCall(order.phone, order.id, origin);
              callTriggered = true;
            }
            
            adminReply += `Order ${order.id} updated! Status: ${order.status}, Result: ${order.result || "N/A"}, Loc: ${order.location || "N/A"}, Call: ${callTriggered ? 'Yes' : 'No'}`;
            return jsonResponse({ success: true, replyMessage: adminReply });
          }
        }

        // Try Gemini AI if API Key is configured
        const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
        if (apiKey) {
          try {
            console.log(`[Twilio Studio SMS AI] Invoking Google Gemini API for message: "${inputMsg}"`);
            const ordersList = await getAllOrders();
            const activeOrders = ordersList.filter(o => !o.archived);
            const callsList = await getRecentCalls(30);
            const smsList = await getRecentSmsMessages(20);
            const balanceData = await getTwilioBalance();
            const balanceStr = balanceData ? `${balanceData.balance} ${balanceData.currency}` : "Unavailable";
            
            // Format recent calls context (first 10 unique callers with actions)
            const uniqueCallers: { phone: string; timestamp: string; isSms: boolean; direction: string; actions: string[] }[] = [];
            const seenCallers = new Set<string>();
            for (const c of callsList) {
              if (c.phone) {
                const cleanPhone = c.phone.trim();
                if (cleanPhone && !seenCallers.has(cleanPhone)) {
                  seenCallers.add(cleanPhone);
                  const isSms = c.actions.some(act => act.trim().startsWith("SMS:") || act.includes("SMS:"));
                  let timeStr = "";
                  try {
                    timeStr = new Intl.DateTimeFormat("en-US", {
                      timeZone: "America/New_York",
                      month: "numeric",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true
                    }).format(new Date(c.timestamp));
                  } catch {
                    timeStr = new Date(c.timestamp).toLocaleString();
                  }
                  uniqueCallers.push({ phone: cleanPhone, timestamp: timeStr, isSms, direction: c.direction || "inbound", actions: c.actions || [] });
                  if (uniqueCallers.length >= 10) break;
                }
              }
            }

            const prompt = `You are a helpful admin assistant for The Shatnez Lab (a clothing testing laboratory).
Your task is to analyze the admin's text message and determine their intent.

Current Date/Time (NY): ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}
Twilio Account Balance: ${balanceStr} (If the admin asks for the Twilio balance, billing info, or account funds, look at this value to answer their question).
Available Locations: "14 Buchanan Rd", "166 Clinton Lane"
Available Statuses: "received", "testing", "review", "ready", "delivered", "issue"
Available Results: "Clean / No Shatnez", "Shatnez Found", "Call to Discuss"

Here is the current list of active orders in the system:
${JSON.stringify(activeOrders.map(o => ({ id: o.id, name: o.customerName, phone: o.phone, status: o.status, result: o.result, location: o.location, dateReceived: o.dateReceived })))}

Here are the recent callers:
${JSON.stringify(uniqueCallers)}

Here is the list of recent SMS messages (last 20 messages, most recent first):
${JSON.stringify(smsList.map(s => {
  let timeStr = "";
  try {
    timeStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(new Date(s.timestamp));
  } catch {
    timeStr = new Date(s.timestamp).toLocaleString();
  }
  return { phone: s.phone, direction: s.direction, body: s.body, time: timeStr };
}))}

The admin's message: "${inputMsg}"

You must respond with a JSON object ONLY, matching this schema:
{
  "action": "update_order" | "add_order" | "send_sms" | "bridge_call" | "none",
  "orderId": string (if updating/finding/associating an order),
  "status": "received" | "testing" | "review" | "ready" | "delivered" | "issue" (if updating/adding),
  "result": "Clean / No Shatnez" | "Shatnez Found" | "Call to Discuss" (if updating),
  "location": "14 Buchanan Rd" | "166 Clinton Lane" (if updating/adding),
  "customerPhone": string (for add_order, send_sms, or bridge_call),
  "customerName": string (for add_order or bridge_call),
  "message": string (message body to send to customer if action is send_sms),
  "adminReply": string (friendly response back to the admin via SMS in Hebrew or English depending on their language choice. If the action is none, answer their question or explain why you couldn't process it. If performing an action, describe what you did)
}

Guidelines:
1. If the admin is asking a question (e.g. "who called me?", "how many orders are ready?", "did order 102 get tested?"), analyze the data and set action="none" and put the detailed answer in "adminReply" (preferably in the language they asked, Hebrew or English).
2. If they want to update an order (e.g. "set order 102 to ready", "102 clean", "עדכן את 105 לנמסר"), identify the order ID, set action="update_order", and set the relevant fields. Keep fields null if not mentioned or unchanged.
3. If they want to send a message to a customer (e.g. "tell 8455551212 that we need the payment"), set action="send_sms", set customerPhone, and set message.
4. If they want to add a new order, set action="add_order", customerPhone, customerName (if provided), and location (default to 14 Buchanan Rd if not specified).
5. If the admin wants to make a call, dial, or contact a customer/phone number (e.g., "call 845-376-6452", "dial 8453766452", "צלצל ל-8453766452", "התקשר לגליק", "חייג אל 845-376-6452"), set action="bridge_call", set customerPhone (find it from orders or recent callers if they specify a customer name like "גליק"), and optionally set customerName and orderId if associated with a matched order.
6. If the intent is ambiguous, set action="none" and ask clarifying questions in "adminReply".
7. Do NOT include markdown code blocks or any extra text. Return ONLY the JSON object.
8. Never write raw contiguous phone numbers (like 18457092022 or +18457092022) in the adminReply. Always format them with dashes (e.g., 845-709-2022) or omit the country code, as raw contiguous numbers can be blocked by carrier spam filters.
9. If the admin asks about the key press options or IVR menu selections of recent callers/calls, look at the "actions" field in the recent callers data. If the actions array has no menu press events (e.g. only "Call started", "Call ended"), tell the admin that the caller did not press any menu keys during the call. Do NOT state that you do not have access to keypress options, because you do.
10. When listing recent calls in the adminReply, always specify whether each call was incoming (inbound) or outgoing (outbound). You can use clear indicators or terms like "(Incoming)" / "(נכנס)" or "(Outgoing)" / "(יוצא)".`;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const geminiResponse = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
              })
            });

            if (geminiResponse.ok) {
              const resData = await geminiResponse.json();
              let aiText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
              
              // Clean code blocks
              aiText = aiText.replace(/```json/i, "").replace(/```/g, "").trim();
              
              try {
                const aiJson = JSON.parse(aiText);
                console.log(`[Twilio Studio SMS AI] Gemini interpreted action:`, JSON.stringify(aiJson));

                if (aiJson.action === "update_order" && aiJson.orderId) {
                  let order = await getOrderById(aiJson.orderId);
                  if (!order && aiJson.orderId.replace(/\D/g, "").length >= 7) {
                    const byPhone = await getOrdersByPhone(aiJson.orderId.replace(/\D/g, ""));
                    if (byPhone.length > 0) {
                      byPhone.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                      order = byPhone[0];
                    }
                  }

                  if (order) {
                    const oldStatus = order.status;
                    if (aiJson.status) order.status = aiJson.status;
                    if (aiJson.result) order.result = aiJson.result;
                    if (aiJson.location) order.location = aiJson.location;
                    await saveOrder(order);
                    
                    let callTriggered = false;
                    if (order.status === "ready" && oldStatus !== "ready" && order.phone) {
                      const origin = `https://${req.headers.get("host")}`;
                      triggerOutboundCall(order.phone, order.id, origin);
                      callTriggered = true;
                    }
                    
                    return jsonResponse({
                      success: true,
                      replyMessage: aiJson.adminReply || `Order ${order.id} updated! Status: ${order.status}, Result: ${order.result || "N/A"}${callTriggered ? ' (Robocall triggered)' : ''}`
                    });
                  }
                } else if (aiJson.action === "add_order" && aiJson.customerPhone) {
                  const newId = await getNextOrderId();
                  await saveOrder({
                    id: newId,
                    customerName: aiJson.customerName || "Phone Guest",
                    phone: aiJson.customerPhone,
                    status: aiJson.status || "received",
                    dateReceived: new Date().toISOString().split("T")[0],
                    estimatedCompletion: "",
                    notes: "Created via Gemini SMS Assistant",
                    result: aiJson.result || "",
                    location: aiJson.location || "14 Buchanan Rd",
                    createdAt: Date.now()
                  });
                  
                  return jsonResponse({
                    success: true,
                    replyMessage: aiJson.adminReply || `Order created! ID: ${newId}`
                  });
                } else if (aiJson.action === "send_sms" && aiJson.customerPhone && aiJson.message) {
                  const smsResult = await sendSms(aiJson.customerPhone, aiJson.message);
                  if (smsResult.success) {
                    await logSmsMessage(aiJson.customerPhone, aiJson.message, "outbound", smsResult.sid);
                    await logCallEvent(undefined, aiJson.customerPhone, `SMS Outbound (via Gemini): "${aiJson.message}"`, "completed");
                    return jsonResponse({
                      success: true,
                      replyMessage: aiJson.adminReply || `SMS sent to ${aiJson.customerPhone}!`
                    });
                  } else {
                    return jsonResponse({
                      success: true,
                      replyMessage: `Failed to send SMS: ${smsResult.error || "Unknown error"}`
                    });
                  }
                } else if (aiJson.action === "bridge_call" && aiJson.customerPhone) {
                  const origin = `https://${req.headers.get("host")}`;
                  const bridgeResult = await triggerCallBridge(
                    aiJson.customerPhone,
                    fromPhone,
                    origin,
                    aiJson.customerName,
                    aiJson.orderId
                  );
                  if (bridgeResult.success) {
                    return jsonResponse({
                      success: true,
                      replyMessage: aiJson.adminReply || `Initiating outbound bridge call. We will dial your admin phone number first, and connect you with ${aiJson.customerName || aiJson.customerPhone}.`
                    });
                  } else {
                    return jsonResponse({
                      success: true,
                      replyMessage: `Failed to initiate bridge call: ${bridgeResult.error || "Unknown error"}`
                    });
                  }
                } else if (aiJson.adminReply) {
                  return jsonResponse({
                    success: true,
                    replyMessage: aiJson.adminReply
                  });
                }
              } catch (parseErr) {
                console.error("[Twilio Studio SMS AI] JSON parse failed on Gemini response:", parseErr, "Text:", aiText);
              }
            } else {
              console.error("[Twilio Studio SMS AI] Gemini API call failed:", geminiResponse.status, await geminiResponse.text());
            }
          } catch (geminiErr) {
            console.error("[Twilio Studio SMS AI] Error calling Gemini API:", geminiErr);
          }
        }

        // Help menu response (fallback)
        const prefix = isPinProvided ? pin + " " : "";
        adminReply += `Admin SMS Menu:\n\n` +
          `1. guided add: ${prefix}add\n` +
          `2. guided update: ${prefix}update\n` +
          `3. cancel flow: cancel\n\n` +
          `One-shot commands:\n` +
          `- ${prefix}recent calls (recent callers)\n` +
          `- ${prefix}recent orders (recent orders)\n` +
          `- ${prefix}sms [Phone] [Message]\n` +
          `- ${prefix}add [ID] [Phone] [Loc 1-2]\n` +
          `- ${prefix}update [ID] [Stat 1-6] [Res 1-3] [Loc 1-2] [Call 1-2]`;

        return jsonResponse({
          success: true,
          replyMessage: adminReply
        });
      }

      // ─── NORMAL CUSTOMER FLOW ───
      const msgClean = msgBody.trim().toLowerCase();
      const isCustomerMsg = msgClean.startsWith("message ") || 
                            msgClean.startsWith("msg ") || 
                            msgClean.startsWith("הודעה ") || 
                            msgClean === "message" || 
                            msgClean === "msg" || 
                            msgClean === "הודעה";
      
      if (isCustomerMsg) {
        let customerContent = "";
        if (msgClean.startsWith("message ")) {
          customerContent = msgBody.trim().substring(8).trim();
        } else if (msgClean.startsWith("msg ")) {
          customerContent = msgBody.trim().substring(4).trim();
        } else if (msgClean.startsWith("הודעה ")) {
          customerContent = msgBody.trim().substring(6).trim();
        }
        
        if (!customerContent) {
          return jsonResponse({
            success: true,
            replyMessage: "נא לכתוב את הודעתך לאחר המילה 'הודעה' (לדוגמה: הודעה מתי המעבדה פתוחה?). Please write your message after the word 'message' (e.g., message when are you open?)."
          });
        }
        
        return jsonResponse({
          success: true,
          replyMessage: "תודה, הודעתך התקבלה במעבדה. נחזור אליך בהקדם. Thank you, your message has been received. We will get back to you shortly."
        });
      }

      // Try to find by msgBody if it looks like an order ID or phone
      const cleanMsg = msgBody.replace(/\D/g, "");
      let foundOrder = null;
      let multipleOrders: any[] = [];

      if (cleanMsg.length >= 7) {
        // Try as order ID
        foundOrder = await getOrderById(cleanMsg);
        if (!foundOrder) {
          // Try as phone
          const byPhone = await getOrdersByPhone(cleanMsg);
          if (byPhone.length === 1) {
            foundOrder = byPhone[0];
          } else if (byPhone.length > 1) {
            multipleOrders = byPhone;
          }
        }
      }

      // If not found by body, try by fromPhone
      if (!foundOrder && multipleOrders.length === 0 && fromPhone) {
        const cleanPhone = fromPhone.replace(/\D/g, "");
        const searchPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1") ? cleanPhone.substring(1) : cleanPhone;
        const byPhone = await getOrdersByPhone(searchPhone);
        if (byPhone.length === 1) {
          foundOrder = byPhone[0];
        } else if (byPhone.length > 1) {
          multipleOrders = byPhone;
        }
      }

      let reply = "ברוכים הבאים למעבדת שעטנז! Welcome to the Shatnez Lab.\n\n";
      
      if (foundOrder) {
        const heStatus = translateStatus(foundOrder.status || "received");
        const enStatus = translateStatusEn(foundOrder.status || "received");
        reply += `הזמנה / Order ${foundOrder.id}:\n`;
        reply += `סטטוס: ${heStatus}\n`;
        reply += `Status: ${enStatus}\n`;
        if (foundOrder.result) {
            const translatedResult = foundOrder.result === "Clean / No Shatnez" ? "נקי משעטנז" : foundOrder.result === "Shatnez Found" ? "נמצא שעטנז" : foundOrder.result === "Call to Discuss" ? "להתקשר לבירור" : foundOrder.result;
            reply += `תוצאה: ${translatedResult}\n`;
            reply += `Result: ${foundOrder.result}\n`;
        }
      } else if (multipleOrders.length > 0) {
        reply += `נמצאו ${multipleOrders.length} הזמנות במספר זה. We found ${multipleOrders.length} orders for this number.\n\n`;
        for (const o of multipleOrders.slice(0, 3)) {
          const heStatus = translateStatus(o.status || "received");
          const enStatus = translateStatusEn(o.status || "received");
          reply += `הזמנה ${o.id}: ${heStatus} / ${enStatus}\n`;
        }
        if (multipleOrders.length > 3) reply += "...\n";
      } else {
        reply += "לא מצאנו הזמנה התואמת לפרטים אלו. הקלד מספר הזמנה כדי לבדוק סטטוס.\n";
        reply += "We could not find an order. Please reply with your order number to check status.\n\n";
        reply += "כדי להשאיר הודעה למעבדה, שלח הודעה המתחילה במילה 'הודעה' (לדוגמה: הודעה מתי המעבדה פתוחה?).\n";
        reply += "To leave a message for the lab, reply starting with the word 'message' (e.g., message when are you open?).";
      }

      return jsonResponse({
        success: true,
        replyMessage: reply.trim()
      });
    }

    // Default response if no action matches
    return jsonResponse({
      success: false,
      messageEn: "Invalid studio action requested.",
      messageHe: "התקבלה פעולה לא תקינה מהשרת."
    });

  } catch (error: any) {
    console.error("[Twilio Studio API] Server Error:", error);
    return jsonResponse({
      success: false,
      error: error.message,
      messageEn: "A server error occurred. Please contact the administrator.",
      messageHe: "אירעה שגיאת שרת. אנא פנה למנהל המערכת."
    });
  }
}
