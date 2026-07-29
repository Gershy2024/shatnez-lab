import { NextRequest, NextResponse } from "next/server";
import { getOrCreateChatSession, updateSessionMetadata } from "@/lib/liveChat";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const page = searchParams.get("page") || undefined;
    const device = searchParams.get("device") || undefined;
    const ref = searchParams.get("ref") || undefined;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId parameter" }, { status: 400 });
    }

    let session = await getOrCreateChatSession(sessionId, {
      currentPage: page,
      deviceInfo: device,
      referrer: ref,
    });

    if (page || device || ref) {
      const updated = await updateSessionMetadata(sessionId, {
        currentPage: page,
        deviceInfo: device,
        referrer: ref,
      });
      if (updated) session = updated;
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error("[Chat Session API] Error fetching session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch chat session" },
      { status: 500 }
    );
  }
}
