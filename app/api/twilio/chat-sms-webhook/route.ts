import { NextRequest, NextResponse } from "next/server";
import { findChatSessionByShortId, addChatMessage } from "@/lib/liveChat";

async function handleWebhook(req: NextRequest) {
  try {
    let bodyText = "";
    let fromPhone = "";

    const url = new URL(req.url);
    const contentType = req.headers.get("content-type") || "";

    if (req.method === "POST") {
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        bodyText =
          (formData.get("Body") as string) ||
          (formData.get("body") as string) ||
          (formData.get("msg") as string) ||
          (formData.get("message") as string) ||
          "";
        fromPhone =
          (formData.get("From") as string) ||
          (formData.get("from") as string) ||
          (formData.get("phone") as string) ||
          "";
      } else if (contentType.includes("json")) {
        const json = await req.json();
        bodyText = json.Body || json.body || json.msg || json.message || json.text || "";
        fromPhone = json.From || json.from || json.phone || "";
      }
    }

    // Fallback to URL parameters
    if (!bodyText) {
      bodyText =
        url.searchParams.get("Body") ||
        url.searchParams.get("body") ||
        url.searchParams.get("msg") ||
        url.searchParams.get("message") ||
        url.searchParams.get("text") ||
        "";
    }
    if (!fromPhone) {
      fromPhone =
        url.searchParams.get("From") ||
        url.searchParams.get("from") ||
        url.searchParams.get("phone") ||
        "";
    }

    console.log(`[Twilio Chat Webhook] Incoming SMS from ${fromPhone}: "${bodyText}"`);

    const trimmedBody = bodyText.trim();
    if (!trimmedBody) {
      return new NextResponse("<Response/>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Parse shortId prefix e.g. "#837 Hello" or "837 Hello" or "#837"
    const match = trimmedBody.match(/^(?:#|\b)(\d{3,5})\b[:\s,.-]*([\s\S]*)/);

    let targetShortId = "";
    let replyText = trimmedBody;

    if (match) {
      targetShortId = match[1];
      replyText = match[2].trim();
    }

    if (!replyText && match) {
      replyText = trimmedBody;
    }

    // Find session by shortId (or fallback to most recent active session)
    const session = await findChatSessionByShortId(targetShortId);

    if (session && replyText) {
      console.log(`[Twilio Chat Webhook] Routing admin reply to session ${session.sessionId} (shortId: #${session.shortId}): "${replyText}"`);
      await addChatMessage(session.sessionId, "admin", replyText);
    } else {
      console.warn(`[Twilio Chat Webhook] Could not route reply. Target ID: "${targetShortId}", Reply Text: "${replyText}"`);
    }

    return new NextResponse("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    console.error("[Twilio Chat Webhook] Error processing incoming SMS:", error);
    return new NextResponse("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  }
}

export async function POST(req: NextRequest) {
  return handleWebhook(req);
}

export async function GET(req: NextRequest) {
  return handleWebhook(req);
}
