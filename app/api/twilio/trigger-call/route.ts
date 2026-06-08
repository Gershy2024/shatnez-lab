import { NextRequest, NextResponse } from "next/server";
import { triggerOutboundCall } from "@/lib/twilioCall";

export async function POST(req: NextRequest) {
  try {
    const { orderId, phone } = await req.json();
    if (!orderId || !phone) {
      return NextResponse.json({ error: "Missing orderId or phone" }, { status: 400 });
    }

    const origin = `https://${req.headers.get("host")}`;
    await triggerOutboundCall(phone, orderId, origin);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error triggering call:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
