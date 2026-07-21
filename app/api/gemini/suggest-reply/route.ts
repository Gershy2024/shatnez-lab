import { NextRequest, NextResponse } from "next/server";
import { getAdminSettings } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { phone, messages, orders, isRtl } = await req.json();
    const settings = await getAdminSettings();
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured in settings." }, { status: 400 });
    }

    const systemPrompt = `You are a helpful customer service assistant for "Shatnez Lab" (מעבדת שעטנז) VoIP dashboard.
We need to generate a polite, concise, and helpful SMS reply to a customer's message.
Here is the customer's phone: "${phone}".
Here are the orders associated with this customer in our system:
${JSON.stringify(orders, null, 2)}

Here is the recent SMS conversation history (newest first):
${JSON.stringify(messages.slice(0, 10), null, 2)}

Requirements:
1. Suggest a single text message reply. Keep it under 160 characters if possible.
2. The language of your reply must match the customer's language. If the customer messages are in Hebrew, reply in Hebrew. If in English, reply in English. If ambiguous, match the application language (isRtl = ${isRtl} means Hebrew, otherwise English).
3. Be professional and warm. Reference their order status or pickup details if relevant (e.g. if an order is ready for pickup, mention "ביוקנן 14" / "14 Buchanan Rd").
4. Never include markdown formatting, json tags, or any surrounding text. Return ONLY the reply text itself.
5. If the conversation is a system automated menu where customer was replying numbers (like 1, 2, 3), and it's a broadcast channel with no phone or menu, write a polite friendly closing message or order updates.
6. To avoid carrier spam filters, do NOT write raw contiguous phone numbers. Always format them with dashes (e.g. 845-709-2022) or omit the country code.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { temperature: 0.7 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Gemini API call failed: ${errText}` }, { status: 500 });
    }

    const resData = await response.json();
    let suggestion = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    suggestion = suggestion.trim();

    return NextResponse.json({ suggestion });
  } catch (e: any) {
    console.error("Error in suggest-reply route:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
