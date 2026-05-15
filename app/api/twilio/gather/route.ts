import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrdersByPhone, getAllOrders, saveOrder, getAdminSettings } from "@/lib/db";

function say(en: string, he: string) {
  return `<Say voice="Polly.Matthew" language="en-US">${en}</Say>` +
         `<Say voice="Polly.Madi" language="he-IL">${he}</Say>`;
}

function gather(action: string, numDigits: number | string, timeout = 10, innerXml: string) {
  return `<Gather action="${action}" method="POST" numDigits="${numDigits}" timeout="${timeout}">${innerXml}</Gather>`;
}

function redirect(action: string) {
  return `<Redirect method="POST">${action}</Redirect>`;
}

function xmlResponse(inner: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: NextRequest) {
  let digits = "";
  try {
    const form = await req.formData();
    digits = (form.get("Digits") as string) || "";
  } catch (e) {
    // If not form data, try query params
    const url = new URL(req.url);
    digits = url.searchParams.get("Digits") || "";
  }
  
  const url = new URL(req.url);
  const step = url.searchParams.get("step") || "menu";

  const settings = await getAdminSettings();
  const ADMIN_PIN = settings.pin;

  // ── Main Menu ──
  if (step === "menu") {
    if (digits === "1") {
      return xmlResponse(
        gather(
          "/api/twilio/gather?step=order_lookup",
          10,
          10,
          say(
            "Please enter your order number, or your ten digit phone number, followed by pound.",
            "אנא הקש את מספר ההזמנה, או את מספר הטלפון שלך בן עשר ספרות, ולאחר מכן סולמית."
          )
        ) +
        say("No input received. Returning to main menu.", "לא התקבל קלט. חוזר לתפריט הראשי.") +
        redirect("/api/twilio/voice")
      );
    }
    // Option 9 for admin access
    if (digits === "9") {
      return xmlResponse(
        gather(
          "/api/twilio/gather?step=admin_pin",
          4,
          10,
          say("Please enter your 4 digit admin PIN.", "אנא הקש את קוד המנהל בן 4 הספרות.")
        ) +
        say("No input received. Returning to main menu.", "לא התקבל קלט. חוזר לתפריט הראשי.") +
        redirect("/api/twilio/voice")
      );
    }
    if (digits === "3") {
      const num = settings.forwardingNumber || "8457092022";
      return xmlResponse(
        say("Connecting you to a representative. Please wait.", "מעביר אותך לנציג. אנא המתן.") +
        `<Dial>${num}</Dial>`
      );
    }
    // Try direct order number entry (includes pound terminator)
    const clean = digits.replace(/#$/, "").trim().toUpperCase();
    if (clean) {
      return await lookupOrder(clean);
    }
    return xmlResponse(
      say("Invalid selection. Returning to main menu.", "בחירה לא תקינה. חוזר לתפריט הראשי.") +
      redirect("/api/twilio/voice")
    );
  }

  // ── Order Lookup ──
  if (step === "order_lookup") {
    const clean = digits.replace(/#$/, "").trim().toUpperCase();
    if (!clean) {
      return xmlResponse(
        say("No order number entered. Returning to main menu.", "לא הוקש מספר הזמנה. חוזר לתפריט הראשי.") +
        redirect("/api/twilio/voice")
      );
    }
    return await lookupOrder(clean);
  }

  // ── Admin PIN ──
  if (step === "admin_pin") {
    if (digits === ADMIN_PIN) {
      return xmlResponse(
        gather(
          "/api/twilio/gather?step=admin_menu",
          1,
          15,
          say(
            "Admin menu. Press 1 to hear recent orders. Press 2 to update an order status. Press 3 to lookup by phone. Press 4 to add a new order. Press star to return to main menu.",
            "תפריט מנהל. הקש 1 לשמיעת הזמנות אחרונות. הקש 2 לעדכון סטטוס הזמנה. הקש 3 לחיפוש לפי טלפון. הקש 4 להוספת הזמנה חדשה. הקש כוכבית לחזרה לתפריט הראשי."
          )
        ) +
        say("No input received. Goodbye.", "לא התקבל קלט. שלום.")
      );
    }
    return xmlResponse(
      say("Incorrect PIN. Returning to main menu.", "קוד שגוי. חוזר לתפריט הראשי.") + 
      redirect("/api/twilio/voice")
    );
  }

  // ── Admin Menu ──
  if (step === "admin_menu") {
    if (digits === "*") {
      return xmlResponse(redirect("/api/twilio/voice"));
    }
    if (digits === "1") {
      // Recent orders
      const orders = await getAllOrders();
      const recent = orders.slice(-5).reverse();
      if (recent.length === 0) {
        return xmlResponse(
          say("No orders found.", "לא נמצאו הזמנות.") + 
          redirect("/api/twilio/gather?step=admin_menu")
        );
      }
      let enMsg = `You have ${orders.length} total orders. Here are the latest 5. `;
      let heMsg = `יש לך ${orders.length} הזמנות בסך הכל. הנה ה-5 האחרונות. `;
      
      for (const o of recent) {
        enMsg += `Order ${o.id.replace(/-/g, " dash ")}, ${o.customerName}, status ${o.status}. `;
        heMsg += `הזמנה ${o.id.replace(/-/g, " מקף ")}, ${o.customerName}, סטטוס ${translateStatus(o.status)}. `;
      }
      return xmlResponse(
        say(enMsg, heMsg) +
        gather(
          "/api/twilio/gather?step=admin_menu",
          1,
          10,
          say("Press any key to return to admin menu, or star for main menu.", "הקש על מקש כלשהו לחזרה לתפריט המנהל, או כוכבית לתפריט הראשי.")
        )
      );
    }
    if (digits === "2") {
      return xmlResponse(
        gather(
          "/api/twilio/gather?step=status_update_ask_id",
          10,
          10,
          say("Enter the order number to update, followed by pound.", "הקש את מספר ההזמנה לעדכון, ולאחריו סולמית.")
        ) +
        say("No input received.", "לא התקבל קלט.") +
        redirect("/api/twilio/gather?step=admin_menu")
      );
    }
    if (digits === "3") {
      return xmlResponse(
        gather(
          "/api/twilio/gather?step=lookup_by_phone",
          10,
          10,
          say("Enter the phone number, followed by pound.", "הקש את מספר הטלפון, ולאחריו סולמית.")
        ) +
        say("No input received.", "לא התקבל קלט.") +
        redirect("/api/twilio/gather?step=admin_menu")
      );
    }
    if (digits === "4") {
      return xmlResponse(
        gather(
          "/api/twilio/gather?step=admin_add_order",
          10,
          10,
          say("Enter the customer phone number for the new order, followed by pound.", "הקש את מספר הטלפון של הלקוח עבור ההזמנה החדשה, ולאחריו סולמית.")
        ) +
        say("No input received.", "לא התקבל קלט.") +
        redirect("/api/twilio/gather?step=admin_menu")
      );
    }
    return xmlResponse(
      say("Invalid option.", "אופציה לא תקינה.") + 
      redirect("/api/twilio/gather?step=admin_menu")
    );
  }

  // ── Status Update: Ask for Order ID ──
  if (step === "status_update_ask_id") {
    const clean = digits.replace(/#$/, "").trim().toUpperCase();
    const order = await getOrderById(clean);
    if (!order) {
      return xmlResponse(
        say("Order not found.", "הזמנה לא נמצאה.") + 
        redirect("/api/twilio/gather?step=admin_menu")
      );
    }
    return xmlResponse(
      say(
        `Order ${order.id.replace(/-/g, " dash ")} is currently ${order.status}.`,
        `הזמנה ${order.id.replace(/-/g, " מקף ")} כרגע בסטטוס ${translateStatus(order.status)}.`
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
    if (digits === "*") {
      return xmlResponse(
        say("Cancelled. Returning to admin menu.", "בוטל. חוזר לתפריט המנהל.") +
        redirect("/api/twilio/gather?step=admin_menu")
      );
    }
    const statusMap: Record<string, string> = {
      "1": "received",
      "2": "testing",
      "3": "review",
      "4": "ready",
      "5": "delivered",
      "6": "issue",
    };
    const newStatus = statusMap[digits];
    if (!newStatus || !orderId) {
      return xmlResponse(
        say("Invalid option.", "אופציה לא תקינה.") + 
        redirect("/api/twilio/gather?step=admin_menu")
      );
    }
    const order = await getOrderById(orderId);
    if (!order) {
      return xmlResponse(
        say("Order not found.", "הזמנה לא נמצאה.") + 
        redirect("/api/twilio/gather?step=admin_menu")
      );
    }
    await saveOrder({ ...order, status: newStatus as any });
    return xmlResponse(
      say(`Status updated to ${newStatus}.`, `הסטטוס עודכן ל-${translateStatus(newStatus as any)}.`) +
      redirect("/api/twilio/gather?step=admin_menu")
    );
  }

  // ── Lookup by Phone ──
  if (step === "lookup_by_phone") {
    const clean = digits.replace(/#$/, "").trim();
    const orders = await getOrdersByPhone(clean);
    if (orders.length === 0) {
      return xmlResponse(
        say("No orders found for that phone number.", "לא נמצאו הזמנות עבור מספר הטלפון הזה.") +
        redirect("/api/twilio/gather?step=admin_menu")
      );
    }
    let enMsg = `Found ${orders.length} order${orders.length > 1 ? "s" : ""}. `;
    let heMsg = `נמצאו ${orders.length} הזמנות. `;
    for (const o of orders) {
      enMsg += `Order ${o.id.replace(/-/g, " dash ")}, ${o.customerName}, status ${o.status}. `;
      heMsg += `הזמנה ${o.id.replace(/-/g, " מקף ")}, ${o.customerName}, סטטוס ${translateStatus(o.status)}. `;
    }
    return xmlResponse(
      say(enMsg, heMsg) +
      gather(
        "/api/twilio/gather?step=admin_menu",
        1,
        10,
        say("Press any key to return to admin menu, or star for main menu.", "הקש על מקש כלשהו לחזרה לתפריט המנהל, או כוכבית לתפריט הראשי.")
      )
    );
  }

  // ── Admin: Add Order ──
  if (step === "admin_add_order") {
    const phone = digits.replace(/#$/, "").trim();
    if (!phone) {
      return xmlResponse(
        say("No phone number entered.", "לא הוקש מספר טלפון.") +
        redirect("/api/twilio/gather?step=admin_menu")
      );
    }
    
    const orders = await getAllOrders();
    const nextNum = orders.length + 1;
    const newId = `ORD-P${nextNum.toString().padStart(3, "0")}`;
    
    await saveOrder({
      id: newId,
      customerName: "Phone Customer",
      phone: phone,
      status: "received",
      dateReceived: new Date().toISOString().split("T")[0],
      estimatedCompletion: "",
      notes: "Added via phone system",
      result: ""
    });

    return xmlResponse(
      say(
        `Order created successfully. The order ID is ${newId.replace(/-/g, " dash ")}.`,
        `ההזמנה נוצרה בהצלחה. מספר ההזמנה הוא ${newId.replace(/-/g, " מקף ")}.`
      ) +
      redirect("/api/twilio/gather?step=admin_menu")
    );
  }

  // Fallback
  return xmlResponse(redirect("/api/twilio/voice"));
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

async function lookupOrder(input: string) {
  // Try exact order ID match first
  let order = await getOrderById(input);

  // If not found, try phone search
  if (!order && input.replace(/\D/g, "").length >= 7) {
    const byPhone = await getOrdersByPhone(input);
    if (byPhone.length === 1) {
      order = byPhone[0];
    } else if (byPhone.length > 1) {
      let enMsg = `Found ${byPhone.length} orders. `;
      let heMsg = `נמצאו ${byPhone.length} הזמנות. `;
      for (const o of byPhone) {
        enMsg += `Order ${o.id.replace(/-/g, " dash ")}, status ${o.status}. `;
        heMsg += `הזמנה ${o.id.replace(/-/g, " מקף ")}, סטטוס ${translateStatus(o.status)}. `;
      }
      return xmlResponse(
        say(enMsg, heMsg) +
        gather(
          "/api/twilio/gather?step=menu",
          1,
          10,
          say("Press 1 to return to main menu.", "הקש 1 לחזרה לתפריט הראשי.")
        )
      );
    }
  }

  if (!order) {
    return xmlResponse(
      say(
        "We could not find an order with that number. Please try again.",
        "לא מצאנו הזמנה עם המספר הזה. אנא נסה שוב."
      ) +
      redirect("/api/twilio/voice")
    );
  }

  const enStatus =
    order.status === "received"
      ? "received and logged"
      : order.status === "testing"
      ? "in testing"
      : order.status === "review"
      ? "under review"
      : order.status === "ready"
      ? "ready for pickup"
      : order.status === "delivered"
      ? "delivered"
      : "needs attention";

  const heStatus = translateStatus(order.status);

  let enMsg = `Order ${order.id.replace(/-/g, " dash ")} is currently ${enStatus}. `;
  let heMsg = `הזמנה ${order.id.replace(/-/g, " מקף ")} היא כרגע ${heStatus}. `;
  
  if (order.estimatedCompletion) {
    enMsg += `Estimated completion is ${order.estimatedCompletion}. `;
    heMsg += `תאריך סיום משוער הוא ${order.estimatedCompletion}. `;
  }
  if (order.result) {
    enMsg += `Test result: ${order.result}. `;
    heMsg += `תוצאת הבדיקה: ${order.result}. `;
  }
  
  enMsg += "Thank you for calling The Shatnez Lab. Goodbye.";
  heMsg += "תודה שהתקשרת למעבדת השעטנז. שלום.";

  return xmlResponse(say(enMsg, heMsg));
}
