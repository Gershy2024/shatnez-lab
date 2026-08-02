import { NextRequest, NextResponse } from "next/server";
import { addChatMessage, getOrCreateChatSession } from "@/lib/liveChat";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, text } = await req.json();
    if (!sessionId || !text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Missing sessionId or text" }, { status: 400 });
    }

    const session = await getOrCreateChatSession(sessionId);
    const updatedSession = await addChatMessage(session.sessionId, "admin", text.trim());

    return NextResponse.json({
      success: true,
      session: updatedSession || session,
    });
  } catch (error: any) {
    console.error("[Chat Reply API] Error sending admin reply:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send admin chat reply" },
      { status: 500 }
    );
  }
}
