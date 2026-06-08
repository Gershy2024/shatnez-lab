import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getAdminSettings, logCallEvent } from "@/lib/db";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: NextRequest) {
  // Check if it's a form-urlencoded body (Twilio WebRTC outbound webhook)
  let customTo = "";
  let callSid = "";
  let fromPhoneNumber = "";
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      customTo = (formData.get("To") as string) || "";
      callSid = (formData.get("CallSid") as string) || "";
      fromPhoneNumber = (formData.get("From") as string) || "";
    }
  } catch (e) {
    // Not a form-urlencoded body
  }

  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");
  const settings = await getAdminSettings();
  
  let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;

  // 1. If it's a dialer WebRTC outbound call
  const isWebRtcCall = fromPhoneNumber.startsWith("client:");
  if (isWebRtcCall && customTo && !customTo.startsWith("client:")) {
    // Format the number to dial
    let cleanPhone = customTo.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "+1" + cleanPhone;
    else if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) cleanPhone = "+" + cleanPhone;
    else if (cleanPhone.length >= 7) cleanPhone = "+" + cleanPhone;

    // Log the outbound VoIP call start in our database
    if (callSid) {
      await logCallEvent(callSid, cleanPhone, "Outbound VoIP Call", "active", undefined, "outbound");
    }

    const fromPhone = settings.twilioPhoneNumber || "";
    const origin = `https://${req.headers.get("host")}`;

    twiml += `<Dial callerId="${fromPhone}" statusCallback="${origin}/api/twilio/call-status-callback" statusCallbackEvent="completed" statusCallbackMethod="POST">`;
    twiml += `<Number>${cleanPhone}</Number>`;
    twiml += `</Dial>`;
  }
  // 2. If it's a robotic voice notification call (Status Ready check)
  else if (orderId) {
    let outboundMsgEn = settings.outboundMsgEn || "Hello. This is The Shatnez Lab. We are calling to inform you that your order is now ready for pickup. Pick up at 14 Buchanan Rd. Thank you.";
    const order = await getOrderById(orderId);
    if (order && order.status === "ready") {
      const orderLocation = order.location || "14 Buchanan Rd";
      if (orderLocation !== "14 Buchanan Rd") {
        outboundMsgEn = outboundMsgEn
          .replace(/14\s*Buchanan\s*Rd\.?/gi, orderLocation)
          .replace(/14\s*Buchanan\s*Road\.?/gi, orderLocation)
          .replace(/14\s*Buchanan/gi, orderLocation);
      }
      const safeEn = escapeXml(outboundMsgEn);
      twiml += `<Say voice="Polly.Matthew" language="en-US">${safeEn}</Say>`;
    } else {
      twiml += `<Say voice="Polly.Matthew" language="en-US">Hello. This is The Shatnez Lab calling regarding your recent order.</Say>`;
    }
    twiml += `<Hangup></Hangup>`;
  } else {
    twiml += `<Say voice="Polly.Matthew" language="en-US">Hello. This is The Shatnez Lab calling.</Say>`;
    twiml += `<Hangup></Hangup>`;
  }

  twiml += `</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
