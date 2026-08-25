import { NextRequest, NextResponse } from "next/server";
import { addChatMessage, getOrCreateChatSession, updateSessionStatus, deleteChatSession } from "@/lib/liveChat";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, text, action } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (action === "resolve" || action === "close") {
      const updated = await updateSessionStatus(sessionId, "closed");
      return NextResponse.json({ success: true, session: updated });
    }

    if (action === "reopen") {
      const updated = await updateSessionStatus(sessionId, "active");
      return NextResponse.json({ success: true, session: updated });
    }

    if (action === "delete") {
      await deleteChatSession(sessionId);
      return NextResponse.json({ success: true, deleted: true });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Missing sessionId or text" }, { status: 400 });
    }

    const session = await getOrCreateChatSession(sessionId);
    const updatedSession = await addChatMessage(session.sessionId, "admin", text.trim());

    // If session was closed, reopen it when admin replies
    if (session.status === "closed") {
      await updateSessionStatus(sessionId, "active");
    }

    return NextResponse.json({
      success: true,
      session: updatedSession || session,
    });
  } catch (error: any) {
    console.error("[Chat Reply API] Error sending admin reply / status action:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process chat action" },
      { status: 500 }
    );
  }
}

