import { NextRequest, NextResponse } from "next/server";
import { triggerCallBridge } from "@/lib/twilioCall";
import { getAdminSettings } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { phone, adminPhone, customerName, orderId } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "Missing customer phone number" }, { status: 400 });
    }

    const settings = await getAdminSettings();
    const finalAdminPhone = adminPhone || settings.forwardingNumber;

    if (!finalAdminPhone) {
      return NextResponse.json({ error: "No forwarding phone number configured. Please set one in Settings." }, { status: 400 });
    }

    const origin = `https://${req.headers.get("host")}`;
    const result = await triggerCallBridge(phone, finalAdminPhone, origin, customerName, orderId);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.error || "Failed to trigger call" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error triggering call bridge:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
