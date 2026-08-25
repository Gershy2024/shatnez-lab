import { NextRequest, NextResponse } from "next/server";
import { getAdminPresence, updateAdminPresence } from "@/lib/liveChat";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const presence = await getAdminPresence();
    return NextResponse.json({
      success: true,
      isOnline: presence.isOnline,
      lastActive: presence.lastActive,
    });
  } catch (error: any) {
    console.error("[Chat Presence API] Error fetching admin presence:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch admin presence" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let isOnline = true;
    try {
      const body = await req.json();
      if (typeof body.isOnline === "boolean") {
        isOnline = body.isOnline;
      }
    } catch (e) {}

    await updateAdminPresence(isOnline);
    return NextResponse.json({
      success: true,
      isOnline,
      lastActive: Date.now(),
    });
  } catch (error: any) {
    console.error("[Chat Presence API] Error updating admin presence:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update admin presence" },
      { status: 500 }
    );
  }
}
