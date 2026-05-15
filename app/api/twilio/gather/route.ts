import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrdersByPhone, getAllOrders, saveOrder } from "@/lib/db";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";
const ADMIN_PIN = "1234";

function say(text: string, lang = "en-US") {
  return `<Say voice="alice" language="${lang}">${text}</Say>`;
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
  const form = await req.formData();
  const digits = (form.get("Digits") as string) || "";
  const url = new URL(req.url);
  const step = url.searchParams.get("step") || "menu";

  // ── Main Menu ──
  if (step === "menu") {
    if (digits === "1") {
      return xmlResponse(
        gather(
          `${BASE_URL}/api/twilio/gather?step=order_lookup`,
          10,
          10,
          say("Please enter your order number, followed by pound. For example, O R D dash 0 0 1 pound.")
        ) +
        say("No input received. Returning to main menu.") +
        redirect(`${BASE_URL}/api/twilio/voice`)
      );
    }
    if (digits === "2") {
      return xmlResponse(
        gather(
          `${BASE_URL}/api/twilio/gather?step=admin_pin`,
          4,
          10,
          say("Please enter your 4 digit admin PIN.")
        ) +
        say("No input received. Returning to main menu.") +
        redirect(`${BASE_URL}/api/twilio/voice`)
      );
    }
    // Try direct order number entry (includes pound terminator)
    const clean = digits.replace(/#$/, "").trim().toUpperCase();
    if (clean) {
      return await lookupOrder(clean);
    }
    return xmlResponse(
      say("Invalid selection. Returning to main menu.") +
      redirect(`${BASE_URL}/api/twilio/voice`)
    );
  }

  // ── Order Lookup ──
  if (step === "order_lookup") {
    const clean = digits.replace(/#$/, "").trim().toUpperCase();
    if (!clean) {
      return xmlResponse(
        say("No order number entered. Returning to main menu.") +
        redirect(`${BASE_URL}/api/twilio/voice`)
      );
    }
    return await lookupOrder(clean);
  }

  // ── Admin PIN ──
  if (step === "admin_pin") {
    if (digits === ADMIN_PIN) {
      return xmlResponse(
        gather(
          `${BASE_URL}/api/twilio/gather?step=admin_menu`,
          1,
          10,
          say(
            "Admin menu. Press 1 to hear recent orders. Press 2 to update an order status. Press 3 to hear orders by phone. Press star to return to main menu."
          )
        ) +
        say("No input received. Goodbye.")
      );
    }
    return xmlResponse(
      say("Incorrect PIN. Returning to main menu.") + redirect(`${BASE_URL}/api/twilio/voice`)
    );
  }

  // ── Admin Menu ──
  if (step === "admin_menu") {
    if (digits === "*") {
      return xmlResponse(redirect(`${BASE_URL}/api/twilio/voice`));
    }
    if (digits === "1") {
      // Recent orders
      const orders = await getAllOrders();
      const recent = orders.slice(-5).reverse();
      if (recent.length === 0) {
        return xmlResponse(
          say("No orders found.") + redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
        );
      }
      let msg = `You have ${orders.length} total orders. Here are the latest 5. `;
      for (const o of recent) {
        msg += `Order ${o.id.replace(/-/g, " dash ")}, ${o.customerName}, status ${o.status}. `;
      }
      return xmlResponse(
        say(msg) +
        gather(
          `${BASE_URL}/api/twilio/gather?step=admin_menu`,
          1,
          10,
          say("Press any key to return to admin menu, or star for main menu.")
        )
      );
    }
    if (digits === "2") {
      return xmlResponse(
        gather(
          `${BASE_URL}/api/twilio/gather?step=status_update_ask_id`,
          10,
          10,
          say("Enter the order number to update, followed by pound.")
        ) +
        say("No input received.") +
        redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
      );
    }
    if (digits === "3") {
      return xmlResponse(
        gather(
          `${BASE_URL}/api/twilio/gather?step=lookup_by_phone`,
          10,
          10,
          say("Enter the phone number, followed by pound.")
        ) +
        say("No input received.") +
        redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
      );
    }
    return xmlResponse(
      say("Invalid option.") + redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
    );
  }

  // ── Status Update: Ask for Order ID ──
  if (step === "status_update_ask_id") {
    const clean = digits.replace(/#$/, "").trim().toUpperCase();
    const order = await getOrderById(clean);
    if (!order) {
      return xmlResponse(
        say("Order not found.") + redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
      );
    }
    return xmlResponse(
      say(`Order ${order.id.replace(/-/g, " dash ")} is currently ${order.status}.`) +
      gather(
        `${BASE_URL}/api/twilio/gather?step=status_update_set&orderId=${order.id}`,
        1,
        10,
        say(
          "Press 1 for received. 2 for in testing. 3 for under review. 4 for ready for pickup. 5 for delivered. 6 for attention needed. Star to cancel."
        )
      )
    );
  }

  // ── Status Update: Set New Status ──
  if (step === "status_update_set") {
    const orderId = url.searchParams.get("orderId");
    if (digits === "*") {
      return xmlResponse(
        say("Cancelled. Returning to admin menu.") +
        redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
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
        say("Invalid option.") + redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
      );
    }
    const order = await getOrderById(orderId);
    if (!order) {
      return xmlResponse(
        say("Order not found.") + redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
      );
    }
    await saveOrder({ ...order, status: newStatus as any });
    return xmlResponse(
      say(`Status updated to ${newStatus}.`) +
      redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
    );
  }

  // ── Lookup by Phone ──
  if (step === "lookup_by_phone") {
    const clean = digits.replace(/#$/, "").trim();
    const orders = await getOrdersByPhone(clean);
    if (orders.length === 0) {
      return xmlResponse(
        say("No orders found for that phone number.") +
        redirect(`${BASE_URL}/api/twilio/gather?step=admin_menu`)
      );
    }
    let msg = `Found ${orders.length} order${orders.length > 1 ? "s" : ""}. `;
    for (const o of orders) {
      msg += `Order ${o.id.replace(/-/g, " dash ")}, ${o.customerName}, status ${o.status}. `;
    }
    return xmlResponse(
      say(msg) +
      gather(
        `${BASE_URL}/api/twilio/gather?step=admin_menu`,
        1,
        10,
        say("Press any key to return to admin menu, or star for main menu.")
      )
    );
  }

  // Fallback
  return xmlResponse(redirect(`${BASE_URL}/api/twilio/voice`));
}

async function lookupOrder(input: string) {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

  // Try exact order ID match first
  let order = await getOrderById(input);

  // If not found, try phone search
  if (!order && input.replace(/\D/g, "").length >= 7) {
    const byPhone = await getOrdersByPhone(input);
    if (byPhone.length === 1) {
      order = byPhone[0];
    } else if (byPhone.length > 1) {
      let msg = `Found ${byPhone.length} orders. `;
      for (const o of byPhone) {
        msg += `Order ${o.id.replace(/-/g, " dash ")}, status ${o.status}. `;
      }
      return xmlResponse(
        say(msg) +
        gather(
          `${BASE_URL}/api/twilio/gather?step=menu`,
          1,
          10,
          say("Press 1 to return to main menu.")
        )
      );
    }
  }

  if (!order) {
    return xmlResponse(
      say("We could not find an order with that number. Please try again.") +
      redirect(`${BASE_URL}/api/twilio/voice`)
    );
  }

  const statusMsg =
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

  let msg = `Order ${order.id.replace(/-/g, " dash ")} is currently ${statusMsg}. `;
  if (order.estimatedCompletion) {
    msg += `Estimated completion is ${order.estimatedCompletion}. `;
  }
  if (order.result) {
    msg += `Test result: ${order.result}. `;
  }
  if (order.notes) {
    msg += `Notes: ${order.notes}. `;
  }
  msg += "Thank you for calling The Shatnez Lab. Goodbye.";

  return xmlResponse(say(msg));
}
