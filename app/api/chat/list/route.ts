import { NextResponse } from "next/server";
import { getAllChatSessions } from "@/lib/liveChat";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await getAllChatSessions();
    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error: any) {
    console.error("[Chat List API] Error fetching chat sessions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch chat sessions" },
      { status: 500 }
    );
  }
}
