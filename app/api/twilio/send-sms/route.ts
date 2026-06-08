import { NextRequest, NextResponse } from "next/server";
import { sendSms } from "@/lib/twilioCall";
import { logSmsMessage, logCallEvent } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { phone, message } = await req.json();
    if (!phone || !message) {
      return NextResponse.json({ error: "Missing phone or message" }, { status: 400 });
    }

    const result = await sendSms(phone, message);

    if (result.success) {
      // Log the outbound SMS in the database
      await logSmsMessage(phone, message, "outbound", result.sid);
      await logCallEvent(undefined, phone, `SMS Outbound: "${message}"`, "completed");
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.error || "Failed to send SMS" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in send-sms API route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
