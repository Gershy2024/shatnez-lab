import { NextRequest, NextResponse } from "next/server";
import { getOrderById, saveOrder, logCallEvent } from "@/lib/db";
import { sendSms } from "@/lib/twilioCall";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    
    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing orderId" }, { status: 400 });
    }

    const formData = await req.formData();
    const callStatus = formData.get("CallStatus")?.toString() || "unknown";
    const callDuration = formData.get("CallDuration")?.toString();
    const price = formData.get("Price")?.toString();
    const priceUnit = formData.get("PriceUnit")?.toString() || "USD";

    console.log(`[Twilio Call Status] Order ${orderId}: ${callStatus} (Duration: ${callDuration}s, Price: ${price} ${priceUnit})`);

    const callSid = formData.get("CallSid")?.toString() || "";
    const toPhone = formData.get("To")?.toString() || "";

    const order = await getOrderById(orderId);
    if (order) {
      const callLogs = order.callLogs || [];
      callLogs.push({
        status: callStatus,
        timestamp: new Date().toISOString(),
        duration: callDuration,
      });
      order.callLogs = callLogs;
      
      await saveOrder(order);
    }

    if (callSid) {
      const finalStatus = (callStatus === "completed" || callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed" || callStatus === "canceled") ? "completed" : "active";
      try {
        await logCallEvent(
          callSid, 
          toPhone || (order ? order.phone : "") || "Unknown", 
          `Robotic Order Ready Call ended (${callStatus})`, 
          finalStatus, 
          callDuration ? `${callDuration}s` : undefined,
          "outbound",
          orderId,
          price,
          priceUnit
        );
      } catch (logErr) {
        console.error("[Twilio Call Status] Failed to log call event:", logErr);
      }
    }

    // Send SMS alert to admin numbers
    const adminPhones = ["+18455524744", "+18457092022"];
    const isSuccess = callStatus === "completed";
    const smsMessage = isSuccess 
      ? `success - Ready notification call for Order ${orderId} completed.`
      : `failed - Ready notification call for Order ${orderId} ended with status: ${callStatus}.`;

    for (const phone of adminPhones) {
      try {
        await sendSms(phone, smsMessage);
      } catch (smsErr) {
        console.error(`[Twilio Call Status] Failed to send admin SMS alert to ${phone}:`, smsErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Twilio Call Status] Error processing webhook:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

