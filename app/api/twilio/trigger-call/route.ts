import { NextRequest, NextResponse } from "next/server";
import { triggerOutboundCall } from "@/lib/twilioCall";

export async function POST(req: NextRequest) {
  try {
    const { orderId, phone, phone2 } = await req.json();
    if (!orderId || (!phone && !phone2)) {
      return NextResponse.json({ error: "Missing orderId or phone" }, { status: 400 });
    }

    const origin = `https://${req.headers.get("host")}`;
    const phonesToCall = [phone, phone2].filter(Boolean);
    await triggerOutboundCall(phonesToCall, orderId, origin);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error triggering call:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
