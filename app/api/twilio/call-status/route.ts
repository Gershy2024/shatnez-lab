import { NextRequest, NextResponse } from "next/server";
import { getOrderById, saveOrder, logCallEvent, getAdminSettings } from "@/lib/db";
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
    const answeredBy = formData.get("AnsweredBy")?.toString() || "";
    const callDuration = formData.get("CallDuration")?.toString();
    const price = formData.get("Price")?.toString();
    const priceUnit = formData.get("PriceUnit")?.toString() || "USD";

    const isVoicemail = answeredBy.toLowerCase().startsWith("machine");
    const isHuman = answeredBy.toLowerCase() === "human";

    console.log(`[Twilio Call Status] Order ${orderId}: status=${callStatus}, answeredBy=${answeredBy || "none"} (Duration: ${callDuration}s, Price: ${price} ${priceUnit})`);

    const callSid = formData.get("CallSid")?.toString() || "";
    const toPhone = formData.get("To")?.toString() || "";

    const order = await getOrderById(orderId);
    if (order) {
      const callLogs = order.callLogs || [];
      callLogs.push({
        status: callStatus,
        timestamp: new Date().toISOString(),
        duration: callDuration,
        answeredBy: answeredBy || undefined,
      });
      order.callLogs = callLogs;
      
      await saveOrder(order);
    }

    if (callSid) {
      const finalStatus = (callStatus === "completed" || callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed" || callStatus === "canceled") ? "completed" : "active";
      let eventTitle = `Robotic Order Ready Call ended (${callStatus})`;
      if (callStatus === "completed") {
        if (isVoicemail) {
          eventTitle = `Robotic Order Ready Call reached Voicemail (${answeredBy})`;
        } else if (isHuman) {
          eventTitle = `Robotic Order Ready Call answered by Customer`;
        }
      }

      try {
        await logCallEvent(
          callSid, 
          toPhone || (order ? order.phone : "") || "Unknown", 
          eventTitle, 
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

    // Determine distinct admin alert message
    const customerDisplay = toPhone || (order ? order.phone : "") || "";
    let smsMessage = "";
    if (callStatus === "completed") {
      if (isVoicemail) {
        smsMessage = `📞 עדכון: שיחת מוכן לאיסוף להזמנה #${orderId} הגיעה לתא קולי של הלקוח (${customerDisplay}) והושארה הודעה קולית.\nReady call for Order #${orderId} reached customer VOICEMAIL (message left).`;
      } else if (isHuman) {
        smsMessage = `✅ עדכון: שיחת מוכן לאיסוף להזמנה #${orderId} נענתה על ידי הלקוח (${customerDisplay}).\nReady call for Order #${orderId} was answered by customer.`;
      } else {
        smsMessage = `📞 עדכון: שיחת מוכן לאיסוף להזמנה #${orderId} הושלמה (${customerDisplay}).\nReady call for Order #${orderId} completed.`;
      }
    } else {
      smsMessage = `⚠️ עדכון: שיחת מוכן לאיסוף להזמנה #${orderId} לא נענתה (סטטוס: ${callStatus}) עבור ${customerDisplay}.\nReady call for Order #${orderId} ended with status: ${callStatus}.`;
    }

    // Send SMS alert to admin numbers
    const settings = await getAdminSettings();
    const adminPhonesSet = new Set<string>();
    ["+18455524744", "+18457092022"].forEach(p => adminPhonesSet.add(p));
    if (settings?.forwardingNumber) {
      let cleanFwd = settings.forwardingNumber.replace(/\D/g, "");
      if (cleanFwd.length === 10) cleanFwd = "+1" + cleanFwd;
      else if (cleanFwd.length === 11 && cleanFwd.startsWith("1")) cleanFwd = "+" + cleanFwd;
      else if (cleanFwd.length >= 7) cleanFwd = "+" + cleanFwd;
      adminPhonesSet.add(cleanFwd);
    }

    for (const phone of Array.from(adminPhonesSet)) {
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

