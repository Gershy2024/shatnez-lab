import { NextRequest, NextResponse } from "next/server";
import { getOrCreateChatSession, addChatMessage, ChatMessage } from "@/lib/liveChat";
import { sendSms } from "@/lib/twilioCall";
import { getAdminSettings } from "@/lib/db";
import { sendEmailNotification } from "@/lib/email";

function getSmartFallbackReply(text: string): string {
  const cleanDigits = text.replace(/\D/g, "");
  if (cleanDigits.length >= 7) {
    return `Thank you! We have received your phone number (${text.trim()}). A lab specialist has been notified and will call you as soon as possible.`;
  }

  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch) {
    return `Thank you! We have received your email (${emailMatch[0]}). A lab specialist has been notified and will be in touch shortly.`;
  }

  const q = text.toLowerCase();

  if (q.includes("hour") || q.includes("open") || q.includes("close") || q.includes("when") || q.includes("time") || q.includes("day")) {
    return "Our business hours are Sunday through Thursday from 9:00 AM to 9:00 PM. We are closed on Friday and Shabbat.";
  }

  if (q.includes("location") || q.includes("address") || q.includes("where") || q.includes("drop") || q.includes("bring") || q.includes("place")) {
    return "Our primary drop-off location is 14 Buchanan Rd, Spring Valley, NY. We also have a secondary drop-off location at 166 Clinton Lane, Spring Valley, NY.";
  }

  if (q.includes("track") || q.includes("status") || q.includes("order") || q.includes("ready") || q.includes("check")) {
    return "You can track your order status anytime by visiting the Track Order page on our website (/track) and entering your order number or phone number.";
  }

  if (q.includes("price") || q.includes("cost") || q.includes("fee") || q.includes("how much") || q.includes("charge")) {
    return "Testing fees depend on the garment type (suits, coats, jackets, or textiles). Please drop off your item or contact our lab for an exact quote.";
  }

  if (q.includes("pickup") || q.includes("delivery") || q.includes("home") || q.includes("vip")) {
    return "We offer VIP home pickup and delivery services. You can request a pickup directly on our website or by contacting our lab.";
  }

  return "Thank you for contacting The Shatnez Lab! A lab specialist has been notified. If you would like us to call you, please reply with your phone number and the best time to reach you.";
}

async function generateAiChatReply(
  userMessage: string,
  history: ChatMessage[],
  apiKey?: string
): Promise<string | null> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return null;

  const systemInstruction = `You are a helpful, professional customer support AI assistant for "The Shatnez Lab" (ClearFabric).
Your goal is to answer website visitors' questions clearly, accurately, and politely in ENGLISH.

Key Information & Knowledge Base:
- Business Name: The Shatnez Lab (ClearFabric)
- Primary Drop-off Location: 14 Buchanan Rd, Spring Valley, NY.
- Secondary Drop-off Location: 166 Clinton Lane, Spring Valley, NY.
- Business Hours: Sunday through Thursday, 9:00 AM – 9:00 PM. Closed on Friday & Shabbat.
- Testing Services: Certified shatnez testing for coats, suits, jackets, pants, wool garments, linens, and home textiles. VIP home pickup & drop-off available.
- Order Tracking: Customers can track their order status anytime by visiting the "Track Order" page on our website (/track) and entering their order number or phone number.

Strict Interaction Rules:
1. ALWAYS reply in ENGLISH.
2. Visitor Contact Input Recognition: If the visitor provides a phone number, email address, or contact info:
   - ALWAYS acknowledge it warmly! Reply: "Thank you! We have received your contact number (${userMessage.trim()}). A lab specialist has been notified and will call you as soon as possible."
3. Direct Answer First: ALWAYS answer simple and standard questions (hours, locations, services, tracking) directly first. Do NOT escalate simple questions to a representative or offer a phone call unless necessary.
4. Call / Phone Request Policy: ONLY if the inquiry is complex/custom, outside your knowledge base, or if the visitor explicitly asks to speak with a human/representative or requests a phone call:
   - State politely that a lab specialist can assist them, and ask: "If you would like a lab specialist to call you, please reply with your phone number and a convenient time to reach out."
5. Format: Keep your response brief, friendly, and concise (1 to 3 sentences maximum). Return plain text only without markdown formatting.`;

  const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

  for (const model of modelsToTry) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const recentMessages = history
        .slice(-6)
        .map((m) => `${m.sender === "user" ? "Visitor" : "Lab Assistant"}: ${m.text}`)
        .join("\n");
      const promptText = `${systemInstruction}\n\nRecent conversation:\n${recentMessages}\n\nVisitor: ${userMessage}\nLab Assistant:`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 250 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (replyText.trim()) return replyText.trim();
      } else {
        console.warn(`[LiveChat AI] Gemini model ${model} status ${response.status}`);
      }
    } catch (err) {
      console.error(`[LiveChat AI] Error calling Gemini API with model ${model}:`, err);
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, text } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Missing message text" }, { status: 400 });
    }

    // 1. Get or create session
    const session = await getOrCreateChatSession(sessionId);

    // 2. Add user message to session
    let updatedSession = await addChatMessage(session.sessionId, "user", text);
    const settings = await getAdminSettings();
    const geminiApiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    // 3. Generate AI Auto-Reply in English (with Smart Fallback)
    let aiReply: string | null = null;
    if (updatedSession) {
      // Direct phone number / email check first
      const cleanDigits = text.replace(/\D/g, "");
      const isEmail = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);

      if (cleanDigits.length >= 7) {
        aiReply = `Thank you! We have received your phone number (${text.trim()}). A lab specialist has been notified and will call you as soon as possible.`;
      } else if (isEmail) {
        aiReply = `Thank you! We have received your email address (${isEmail[0]}). A lab specialist has been notified and will be in touch shortly.`;
      } else {
        aiReply = await generateAiChatReply(text, updatedSession.messages, geminiApiKey);
        if (!aiReply) {
          console.log("[LiveChat AI] Using smart fallback reply");
          aiReply = getSmartFallbackReply(text);
        }
      }

      if (aiReply) {
        updatedSession = await addChatMessage(session.sessionId, "admin", aiReply);
      }
    }

    // 4. Send SMS notification to admin with visitor question & AI reply
    const adminPhone = settings.forwardingNumber || settings.twilioPhoneNumber;
    if (adminPhone) {
      let smsBody = `[#${session.shortId}] Web Visitor: ${text.trim()}`;
      if (aiReply) {
        smsBody += `\n\nAI Replied: ${aiReply}`;
      }
      smsBody += `\n\n(Reply: #${session.shortId} your reply)`;

      console.log(`[Chat API] Sending SMS notification for shortId #${session.shortId} to ${adminPhone}`);
      sendSms(adminPhone, smsBody).catch((err) => {
        console.warn(`[Chat API] SMS notification background send error:`, err);
      });
    }

    // 5. Send Email Alert Notification to Admin
    const emailSubject = `💬 Live Chat Alert [#${session.shortId}] - New Website Visitor Question`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #0f172a; padding: 16px; border-radius: 8px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; color: #f59e0b; font-size: 20px;">💬 The Shatnez Lab - Website Live Chat</h2>
          <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Chat Session ID: #${session.shortId}</p>
        </div>

        <div style="margin: 20px 0; padding: 16px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px;">
          <strong style="color: #b45309; font-size: 14px;">👤 Visitor Message:</strong>
          <p style="margin: 8px 0 0 0; font-size: 16px; color: #1e293b; font-weight: 500;">"${text.trim()}"</p>
        </div>

        ${aiReply ? `
        <div style="margin: 20px 0; padding: 16px; background-color: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 6px;">
          <strong style="color: #0369a1; font-size: 14px;">🤖 AI Assistant Auto-Reply (English):</strong>
          <p style="margin: 8px 0 0 0; font-size: 15px; color: #0f172a;">"${aiReply}"</p>
        </div>
        ` : ''}

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
          <p style="margin: 0 0 8px 0;"><strong>How to reply to this visitor:</strong></p>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
            <li><strong>From Phone (SMS):</strong> Reply directly to Twilio with <code>#${session.shortId} &lt;your reply text&gt;</code></li>
            <li><strong>From Dashboard:</strong> Open your Admin Panel (<a href="https://www.theshatnezlab.com/admin" style="color: #2563eb;">theshatnezlab.com/admin</a>) and click <em>Website Live Chat</em>.</li>
          </ul>
        </div>
      </div>
    `;

    sendEmailNotification({
      subject: emailSubject,
      text: `Live Chat [#${session.shortId}] Message: ${text.trim()}${aiReply ? `\n\nAI Replied: ${aiReply}` : ''}`,
      html: emailHtml,
    }).catch((err) => {
      console.warn("[Chat API] Email notification background send error:", err);
    });

    return NextResponse.json({
      success: true,
      session: updatedSession || session,
      aiReplied: !!aiReply,
    });
  } catch (error: any) {
    console.error("[Chat API] Error processing user message:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process chat message" },
      { status: 500 }
    );
  }
}
