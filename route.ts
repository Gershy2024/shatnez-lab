import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrdersByPhone, getAllOrders, saveOrder, getAdminSettings, translateStatus } from "@/lib/db";

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
function jsonResponse(data: any) {
  return NextResponse.json(data, {
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
    const action = url.searchParams.get("action") || "";
    
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
    const query = (body.query || url.searchParams.get("query") || "").trim();
    const phone = (body.phone || url.searchParams.get("phone") || "").trim();
    const pin = (body.pin || url.searchParams.get("pin") || "").trim();
    
    console.log(`[Twilio Studio API] Action: "${action}", Query: "${query}", Phone: "${phone}", PIN: "${pin}"`);

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
        });
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
        });
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
      });
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

      let enMsg = `Here are the last ${recent.length} orders. `;
      let heMsg = `להלן ${recent.length} ההזמנות האחרונות. `;

      for (const o of recent) {
        const safeId = String(o.id).replace(/-/g, " dash ");
        const safeIdHe = String(o.id).replace(/-/g, " מקף ");
        const customer = o.customerName || "No Name";
        const enStatus = translateStatusEn(o.status || "received");
        const heStatus = translateStatus(o.status || "received");
        
        enMsg += `Order ${safeId} for ${customer} is ${enStatus}. `;
        heMsg += `הזמנה ${safeIdHe} עבור ${customer} היא ${heStatus}. `;
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
          messageEn: `Order number ${newOrderId.split("").join(" ")} already exists in the system.`,
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
        messageEn: `Order ${newOrderId.split("").join(" ")} was successfully added.`,
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

      return jsonResponse({
        success: true,
        messageEn: `Order ${orderId.split("").join(" ")} has been updated to ${friendlyStatusEn}.`,
        messageHe: `הזמנה ${orderId} עודכנה בהצלחה לסטטוס ${friendlyStatusHe}.`
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
