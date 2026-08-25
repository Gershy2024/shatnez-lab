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

    const systemPrompt = `You are a helpful customer service assistant for "The Shatnez Lab" (מעבדת שעטנז - ClearFabric) dashboard.
We need to generate a polite, concise, and helpful reply to a website visitor or SMS customer.
Here is the customer/visitor identifier: "${phone}".
Here are the orders associated with this customer in our system:
${JSON.stringify(orders, null, 2)}

Here is the recent conversation history (newest last or first):
${JSON.stringify(messages.slice(0, 10), null, 2)}

Key Information:
- Locations: 14 Buchanan Rd, Spring Valley, NY (primary drop-off) & 166 Clinton Lane, Spring Valley, NY.
- Hours: Sunday through Thursday 9:00 AM – 9:00 PM. Closed Friday and Shabbat.
- Turnaround: 1-2 business days standard. Urgent on-spot checking by appointment.
- Phone: 845-552-4744.
- Services: Garment microscopic testing (suits, coats, blazers, wool/linen items), VIP home pickup/delivery, store inventory certification.

Requirements:
1. Suggest a single clear, friendly, and professional reply.
2. The language of your reply must match the customer's language. If the customer messages are in Hebrew, reply in fluent Hebrew. If in English, reply in English. If ambiguous, match the application language (isRtl = ${isRtl} means Hebrew, otherwise English).
3. Be professional and warm. Reference their order status or pickup details if relevant (e.g. if an order is ready for pickup, mention "ביוקנן 14" / "14 Buchanan Rd").
4. Never include markdown formatting, json tags, or any surrounding text. Return ONLY the reply text itself.
5. If phone numbers are mentioned, format them with dashes (e.g. 845-552-4744).`;

    const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"];
    let suggestion = "";

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 250 }
          })
        });

        if (response.ok) {
          const resData = await response.json();
          suggestion = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          suggestion = suggestion.trim();
          if (suggestion) break;
        }
      } catch (err) {
        console.warn(`[Suggest Reply] Error with model ${model}:`, err);
      }
    }

    return NextResponse.json({ suggestion });
  } catch (e: any) {
    console.error("Error in suggest-reply route:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
