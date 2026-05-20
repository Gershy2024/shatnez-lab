import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrdersByPhone, getAllOrders, saveOrder, getAdminSettings } from "@/lib/db";
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
    const action = (body.action || url.searchParams.get("action") || "").trim();
    const query = (body.query || url.searchParams.get("query") || "").trim();
    const phone = (body.phone || url.searchParams.get("phone") || "").trim();
    const pin = (body.pin || url.searchParams.get("pin") || "").trim();
    
    console.log(`[Twilio Studio API] Action: "${action}", Query: "${query}", Phone: "${phone}", PIN: "${pin}"`);

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

    // ─── 1. CALLER LOOKUP BY PHONE ───
    if (action === "caller_lookup") {
      if (!phone) {
        return jsonResponse({
          found: false,
          ordersCount: 0,
          messageEn: "No phone number detected.",
          messageHe: "לא זוהה מספר טלפון."
        });
      }

      // Clean caller phone to match normalized DB phone numbers
      const cleanPhone = phone.replace(/\D/g, "");
      const searchPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1") ? cleanPhone.substring(1) : cleanPhone;
      
      console.log(`[Twilio Studio API] Performing Caller Lookup for: "${searchPhone}"`);
      const orders = await getOrdersByPhone(searchPhone);

      if (orders.length === 0) {
        return jsonResponse({
          found: false,
          ordersCount: 0,
          messageEn: `No orders found for phone number ${phone.split("").join(" ")}.`,
          messageHe: `לא נמצאו הזמנות עבור מספר הטלפון המבוקש.`
        }, 404);
      }

      let enMsg = `We found ${orders.length} order${orders.length > 1 ? "s" : ""}. `;
      let heMsg = `נמצאו ${orders.length} הזמנות עבורך. `;

      for (const o of orders) {
        const safeId = String(o.id).replace(/-/g, " dash ");
        const safeIdHe = String(o.id).replace(/-/g, " מקף ");
        const enStatus = translateStatusEn(o.status || "received");
        const heStatus = translateStatus(o.status || "received");
        
        enMsg += `Order ${safeId} is ${enStatus}. `;
        heMsg += `הזמנה ${safeIdHe} היא ${heStatus}. `;
        
        if (o.result) {
          const translatedResult = o.result === "Clean / No Shatnez" ? "נקי משעטנז" : o.result === "Shatnez Found" ? "נמצא שעטנז" : o.result;
          enMsg += `Test result is: ${o.result}. `;
          heMsg += `תוצאת הבדיקה היא: ${translatedResult}. `;
        }
      }

      return jsonResponse({
        found: true,
        ordersCount: orders.length,
        messageEn: enMsg.trim(),
        messageHe: heMsg.trim()
      });
    }

    // ─── 2. MANUAL LOOKUP (BY ORDER ID OR PHONE) ───
    if (action === "manual_lookup") {
      if (!query) {
        return jsonResponse({
          found: false,
          messageEn: "Please enter an order number or phone number.",
          messageHe: "אנא הקש מספר הזמנה או מספר טלפון."
        });
      }

      console.log(`[Twilio Studio API] Performing Manual Lookup for: "${query}"`);
      
      // Try Order ID first
      let order = await getOrderById(query);
      
      // If not found, check if it looks like a phone number to search by phone
      if (!order && query.replace(/\D/g, "").length >= 7) {
        const byPhone = await getOrdersByPhone(query);
        if (byPhone.length === 1) {
          order = byPhone[0];
        } else if (byPhone.length > 1) {
          let enMsg = `We found ${byPhone.length} orders for this phone number. `;
          let heMsg = `נמצאו ${byPhone.length} הזמנות למספר זה. `;
          for (const o of byPhone) {
            const safeId = String(o.id).replace(/-/g, " dash ");
            const safeIdHe = String(o.id).replace(/-/g, " מקף ");
            enMsg += `Order ${safeId}, status ${translateStatusEn(o.status || "received")}. `;
            heMsg += `הזמנה ${safeIdHe}, סטטוס ${translateStatus(o.status || "received")}. `;
          }
          return jsonResponse({
            found: true,
            isMultiple: true,
            messageEn: enMsg.trim(),
            messageHe: heMsg.trim()
          });
        }
      }

      if (!order) {
        return jsonResponse({
          found: false,
          messageEn: `We could not find any order with number ${query.split("").join(" ")}.`,
          messageHe: `לא מצאנו הזמנה עם המספר המבוקש.`
        }, 404);
      }

      const enStatus = translateStatusEn(order.status || "received");
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

      return jsonResponse({
        found: true,
        isMultiple: false,
        messageEn: enMsg.trim(),
        messageHe: heMsg.trim()
      });
    }

    // ─── 3. ADMIN LOGIN / PIN CHECK ───
    if (action === "admin_login") {
      const settings = await getAdminSettings();
      const expectedPin = settings.pin || "1234";
      const authenticated = pin === expectedPin;
      
      console.log(`[Twilio Studio API] Admin Auth attempt. Provided: "${pin}", Success: ${authenticated}`);
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
      const recent = orders.slice(-5).reverse();
      
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
      const newOrderId = (body.orderId || url.searchParams.get("orderId") || "").trim();
      const customerPhone = (body.customerPhone || url.searchParams.get("customerPhone") || "").trim();
      
      console.log(`[Twilio Studio API] Admin adding new order: "${newOrderId}", Phone: "${customerPhone}"`);
      
      if (!newOrderId) {
        return jsonResponse({
          success: false,
          messageEn: "Missing order ID.",
          messageHe: "חסר מספר הזמנה."
        });
      }

      const existing = await getOrderById(newOrderId);
      if (existing) {
        return jsonResponse({
          success: false,
          messageEn: `<speak>Order number <say-as interpret-as="digits">${newOrderId}</say-as> already exists in the system.</speak>`,
          messageHe: `מספר הזמנה ${newOrderId} כבר קיים במערכת.`
        });
      }

      const today = new Date().toISOString().split("T")[0];
      await saveOrder({
        id: newOrderId,
        customerName: "Phone Admin",
        phone: customerPhone,
        status: "received",
        dateReceived: today,
        estimatedCompletion: "",
        notes: "Created via Phone IVR Admin Menu",
        result: ""
      });

      return jsonResponse({
        success: true,
        messageEn: `<speak>Order <say-as interpret-as="digits">${newOrderId}</say-as> was successfully added.</speak>`,
        messageHe: `הזמנה ${newOrderId} נוספה בהצלחה למערכת.`
      });
    }

    // ─── 6. ADMIN UPDATE ORDER STATUS ───
    if (action === "admin_update_order") {
      const orderId = (body.orderId || url.searchParams.get("orderId") || "").trim();
      const newStatusDigit = (body.statusDigit || url.searchParams.get("statusDigit") || "").trim();
      const resultSelection = (body.resultSelection || url.searchParams.get("resultSelection") || "").trim();
      
      console.log(`[Twilio Studio API] Admin updating order: "${orderId}", statusDigit: "${newStatusDigit}", resultSelection: "${resultSelection}"`);

      if (!orderId) {
        return jsonResponse({
          success: false,
          messageEn: "Missing order ID.",
          messageHe: "חסר מספר הזמנה."
        });
      }

      const order = await getOrderById(orderId);
      if (!order) {
        return jsonResponse({
          success: false,
          messageEn: `We could not find order number ${orderId.split("").join(" ")}.`,
          messageHe: `לא מצאנו את הזמנה מספר ${orderId}.`
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

      const mappedStatus = statusMap[newStatusDigit];
      if (mappedStatus) {
        order.status = mappedStatus;
      }

      // Map digits to result values
      if (resultSelection === "1") {
        order.result = "Clean / No Shatnez";
      } else if (resultSelection === "2") {
        order.result = "Shatnez Found";
      } else if (resultSelection === "3") {
        order.result = "Call to Discuss";
      }

      await saveOrder(order);

      const friendlyStatusEn = translateStatusEn(order.status);
      const friendlyStatusHe = translateStatus(order.status);
      const friendlyResultEn = order.result || "no result";
      const friendlyResultHe = order.result || "ללא תוצאה";

      return jsonResponse({
        success: true,
        messageEn: `<speak>Updated order number <say-as interpret-as="digits">${orderId}</say-as> to status ${friendlyStatusEn} and result ${friendlyResultEn}.</speak>`,
        messageHe: `הזמנה מספר ${orderId} עודכנה בהצלחה לסטטוס ${friendlyStatusHe} ותוצאה ${friendlyResultHe}.`
      });
    }

    // ─── 7. VOICEMAIL RECORDING TO EMAIL ───
    if (action === "voicemail" || action === "voice") {
      const recordingUrl = (
        body.recordingUrl || 
        body.RecordingUrl || 
        body.recording_url || 
        url.searchParams.get("recordingUrl") || 
        url.searchParams.get("RecordingUrl") || 
        url.searchParams.get("recording_url") || 
        ""
      ).trim();
      
      const recordingDuration = (
        body.recordingDuration || 
        body.RecordingDuration || 
        body.recording_duration || 
        url.searchParams.get("recordingDuration") || 
        url.searchParams.get("RecordingDuration") || 
        url.searchParams.get("recording_duration") || 
        ""
      ).trim();
      
      const callerPhone = (
        body.phone || 
        body.From || 
        body.phone_number || 
        url.searchParams.get("phone") || 
        url.searchParams.get("From") || 
        url.searchParams.get("phone_number") || 
        "Unknown"
      ).trim();

      console.log(`[Twilio Studio API] Voicemail received from ${callerPhone}. Duration: ${recordingDuration}s, URL: ${recordingUrl}`);

      if (!recordingUrl) {
        return jsonResponse({
          success: false,
          messageEn: "No recording URL provided.",
          messageHe: "לא התקבלה הקלטת שמע."
        });
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
      const port = parseInt(settings.smtpPort || "465", 10);
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

      return jsonResponse({
        success: true,
        messageEn: "Voicemail notification sent successfully.",
        messageHe: "הודעת האימייל נשלחה בהצלחה."
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
