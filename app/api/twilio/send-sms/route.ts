import { NextRequest, NextResponse } from "next/server";
import { sendSms } from "@/lib/twilioCall";
import { logSmsMessage, logCallEvent, saveMediaFile } from "@/lib/db";

// Memory cache to prevent duplicate SMS sends within 6 seconds
const recentSends = new Map<string, number>();

function isRecentDuplicate(key: string): boolean {
  const now = Date.now();
  // Clean up older entries
  recentSends.forEach((time, k) => {
    if (now - time > 30000) {
      recentSends.delete(k);
    }
  });
  const lastTime = recentSends.get(key);
  if (lastTime && now - lastTime < 6000) {
    return true;
  }
  recentSends.set(key, now);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { phone, message, media } = await req.json();
    if (!phone || (!message && !media)) {
      return NextResponse.json({ error: "Missing phone or message/media" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const dedupKey = `${cleanPhone}_${(message || "").trim()}_${media?.filename || ""}`;

    if (isRecentDuplicate(dedupKey)) {
      console.warn(`[Send SMS API] Duplicate send request blocked for phone: ${cleanPhone}`);
      return NextResponse.json({ success: true, duplicateBlocked: true });
    }

    let mediaUrl: string | undefined = undefined;

    // Handle media attachment if provided
    if (media && media.base64) {
      try {
        const mediaId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const filename = media.filename || `attachment_${Date.now()}.jpg`;
        const contentType = media.contentType || "image/jpeg";
        const size = Math.round((media.base64.length * 3) / 4);

        await saveMediaFile(mediaId, filename, contentType, media.base64, size);

        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
        const proto = req.headers.get("x-forwarded-proto") || "https";
        let publicOrigin = `${proto}://${host}`;
        if (!host || host.includes("localhost")) {
          publicOrigin = "https://www.theshatnezlab.com";
        }

        mediaUrl = `${publicOrigin}/api/media?id=${mediaId}&file=${encodeURIComponent(filename)}`;
        console.log(`[Send SMS API] Saved media file ${mediaId} (${filename}), public URL: ${mediaUrl}`);
      } catch (saveErr) {
        console.error("[Send SMS API] Failed to store media file:", saveErr);
      }
    }

    const result = await sendSms(phone, message || "", mediaUrl);

    if (result.success) {
      const displayMsg = message || (media?.filename ? `[${media.filename}]` : (mediaUrl ? "[Attached File]" : ""));
      // Log the outbound SMS in the database
      await logSmsMessage(phone, displayMsg, "outbound", result.sid, undefined, mediaUrl ? [mediaUrl] : undefined);
      await logCallEvent(undefined, phone, `SMS Outbound: "${displayMsg}"${mediaUrl ? " (+Media)" : ""}`, "completed");
      return NextResponse.json({ success: true, sid: result.sid, mediaUrl });
    } else {
      return NextResponse.json({ error: result.error || "Failed to send SMS" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in send-sms API route:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
