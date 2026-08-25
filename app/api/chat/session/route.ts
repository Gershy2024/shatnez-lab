import { NextRequest, NextResponse } from "next/server";
import { getOrCreateChatSession, updateSessionMetadata, getAdminPresence } from "@/lib/liveChat";

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

    // Extract Geolocation from Vercel edge headers
    const rawCity = req.headers.get("x-vercel-ip-city") || "";
    const rawRegion = req.headers.get("x-vercel-ip-country-region") || "";
    const rawCountry = req.headers.get("x-vercel-ip-country") || "";

    let locationStr = searchParams.get("location") || "";
    if (!locationStr && (rawCity || rawCountry)) {
      const city = rawCity ? decodeURIComponent(rawCity) : "";
      if (city) {
        locationStr = city;
        if (rawRegion) locationStr += `, ${rawRegion}`;
        if (rawCountry) locationStr += ` (${rawCountry})`;
      } else if (rawCountry) {
        locationStr = rawCountry;
      }
    }

    let session = await getOrCreateChatSession(sessionId, {
      currentPage: page,
      deviceInfo: device,
      referrer: ref,
      location: locationStr || undefined,
    });

    if (page || device || ref || locationStr) {
      const updated = await updateSessionMetadata(sessionId, {
        currentPage: page,
        deviceInfo: device,
        referrer: ref,
        location: locationStr || undefined,
      });
      if (updated) session = updated;
    }

    const presence = await getAdminPresence();

    return NextResponse.json({
      success: true,
      session,
      adminOnline: presence.isOnline,
    });
  } catch (error: any) {
    console.error("[Chat Session API] Error fetching session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch chat session" },
      { status: 500 }
    );
  }
}

