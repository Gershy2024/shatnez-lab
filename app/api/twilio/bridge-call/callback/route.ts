import { NextRequest, NextResponse } from "next/server";
import { getAdminSettings } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const customerPhone = url.searchParams.get("customerPhone");
    const customerName = url.searchParams.get("customerName") || "";
    const orderId = url.searchParams.get("orderId") || "";
    
    if (!customerPhone) {
      const twimlErr = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Matthew" language="en-US">Error: Missing customer phone number.</Say></Response>`;
      return new NextResponse(twimlErr, { headers: { "Content-Type": "text/xml" } });
    }

    const settings = await getAdminSettings();
    const twilioPhone = settings.twilioPhoneNumber || "";

    let promptMessage = "Connecting you to the customer now.";
    if (customerName && orderId) {
      promptMessage = `Connecting you to customer ${customerName} for order number ${orderId} now.`;
    } else if (customerName) {
      promptMessage = `Connecting you to customer ${customerName} now.`;
    } else if (orderId) {
      promptMessage = `Connecting you to order number ${orderId} now.`;
    }

    const origin = `https://${req.headers.get("host")}`;
    const escapedPhone = encodeURIComponent(customerPhone || "");
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew" language="en-US">${promptMessage}</Say>
  <Dial callerId="${twilioPhone}" action="${origin}/api/twilio/gather?step=dashboard_dial_completed&amp;customerPhone=${escapedPhone}">${customerPhone}</Dial>
</Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error in bridge callback:", error);
    const twimlErr = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Matthew" language="en-US">An error occurred while routing this call.</Say></Response>`;
    return new NextResponse(twimlErr, { headers: { "Content-Type": "text/xml" } });
  }
}
