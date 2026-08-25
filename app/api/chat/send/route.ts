import { NextRequest, NextResponse } from "next/server";
import { getOrCreateChatSession, addChatMessage, ChatMessage, getAdminPresence } from "@/lib/liveChat";
import { sendSms } from "@/lib/twilioCall";
import { getAdminSettings, getOrderById, getOrdersByPhone, Order } from "@/lib/db";
import { sendEmailNotification } from "@/lib/email";

function isHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

function formatOrderStatusHebrew(order: Order): string {
  const statusLabels: Record<string, string> = {
    received: "התקבל במעבדה (ממתין לבדיקה)",
    testing: "בבדיקה מיקרוסקופית פעילה",
    review: "בביקורת סופית על ידי מומחה",
    ready: "מוכן לאיסוף",
    delivered: "נמסר ללקוח",
    issue: "דרוש בירור עם המעבדה",
  };

  const statusHebrew = statusLabels[order.status] || order.status;
  let text = `פרטי הזמנה #${order.id} עבור ${order.customerName}:\n`;
  text += `• סטטוס: ${statusHebrew}\n`;
  if (order.result) {
    text += `• תוצאת בדיקה: ${order.result}\n`;
  }
  if (order.estimatedCompletion) {
    text += `• צפי סיום משוער: ${order.estimatedCompletion}\n`;
  }
  if (order.status === "ready") {
    text += `• כתובת לאיסוף: 14 Buchanan Rd, Spring Valley (ימים א'-ה' 9:00-21:00).\n`;
  }
  if (order.notes) {
    text += `• הערות: ${order.notes}\n`;
  }
  return text.trim();
}

function formatOrderStatusEnglish(order: Order): string {
  const statusLabels: Record<string, string> = {
    received: "Received in Lab (Awaiting testing)",
    testing: "In active microscopic examination",
    review: "Under final senior review",
    ready: "Ready for pickup",
    delivered: "Delivered",
    issue: "Attention needed / Please contact lab",
  };

  const statusEn = statusLabels[order.status] || order.status;
  let text = `Order #${order.id} details for ${order.customerName}:\n`;
  text += `• Status: ${statusEn}\n`;
  if (order.result) {
    text += `• Test Result: ${order.result}\n`;
  }
  if (order.estimatedCompletion) {
    text += `• Estimated Completion: ${order.estimatedCompletion}\n`;
  }
  if (order.status === "ready") {
    text += `• Pickup Location: 14 Buchanan Rd, Spring Valley, NY (Sun-Thu 9am-9pm).\n`;
  }
  if (order.notes) {
    text += `• Notes: ${order.notes}\n`;
  }
  return text.trim();
}

function getSmartFallbackReply(text: string, isHeb: boolean, adminOnline: boolean): string {
  const cleanDigits = text.replace(/\D/g, "");
  const q = text.toLowerCase();

  // Contact number provided
  if (cleanDigits.length >= 7) {
    if (isHeb) {
      return `תודה רבה! קיבלנו את מספר הטלפון שלך (${text.trim()}). נציג המעבדה קיבל התראה ויחזור אליך בהקדם האפשרי.`;
    }
    return `Thank you! We have received your phone number (${text.trim()}). A lab specialist has been notified and will contact you as soon as possible.`;
  }

  // Email provided
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch) {
    if (isHeb) {
      return `תודה! קיבלנו את כתובת האימייל שלך (${emailMatch[0]}). נציג המעבדה עודכן וייצור איתך קשר בהקדם.`;
    }
    return `Thank you! We have received your email address (${emailMatch[0]}). A lab specialist has been notified and will be in touch shortly.`;
  }

  // Opening Hours
  if (
    q.includes("hour") ||
    q.includes("open") ||
    q.includes("close") ||
    q.includes("when") ||
    q.includes("time") ||
    q.includes("שעות") ||
    q.includes("פתוח") ||
    q.includes("מתי") ||
    q.includes("זמנים")
  ) {
    if (isHeb) {
      return "שעות הפעילות של המעבדה: ימים ראשון עד חמישי בין השעות 9:00 בבוקר ל-21:00 בערב. בימי שישי ובשבת המעבדה סגורה.";
    }
    return "Our business hours are Sunday through Thursday from 9:00 AM to 9:00 PM. We are closed on Friday and Shabbat.";
  }

  // Drop-off / Locations
  if (
    q.includes("location") ||
    q.includes("address") ||
    q.includes("where") ||
    q.includes("drop") ||
    q.includes("bring") ||
    q.includes("place") ||
    q.includes("כתובת") ||
    q.includes("מיקום") ||
    q.includes("איפה") ||
    q.includes("מסירה") ||
    q.includes("להביא") ||
    q.includes("להניח")
  ) {
    if (isHeb) {
      return "כתובת המסירה הראשית: 14 Buchanan Rd, Spring Valley, NY. יש לנו גם נקודת מסירה נוספת ב-166 Clinton Lane, Spring Valley, NY. ניתן להניח את הבגד במעטפה/שקית עם פרטי קשר.";
    }
    return "Our primary drop-off location is 14 Buchanan Rd, Spring Valley, NY. We also have a secondary drop-off location at 166 Clinton Lane, Spring Valley, NY. Place garments in a bag with your name and phone number.";
  }

  // Tracking / Order status
  if (
    q.includes("track") ||
    q.includes("status") ||
    q.includes("order") ||
    q.includes("ready") ||
    q.includes("check") ||
    q.includes("מעקב") ||
    q.includes("סטטוס") ||
    q.includes("הזמנה") ||
    q.includes("מוכן") ||
    q.includes("בדיקה")
  ) {
    if (isHeb) {
      return "למעקב אחר הזמנה, תוכל להקליד כאן את מספר ההזמנה שלך (למשל 105) או מספר הטלפון, או לבקר בעמוד מעקב הזמנה באתר (/track).";
    }
    return "To track your order, you can type your order number (e.g. 105) or phone number right here, or visit the Track Order page on our website (/track).";
  }

  // Pricing / Cost
  if (
    q.includes("price") ||
    q.includes("cost") ||
    q.includes("fee") ||
    q.includes("how much") ||
    q.includes("charge") ||
    q.includes("מחיר") ||
    q.includes("עלות") ||
    q.includes("כמה עולה") ||
    q.includes("תשלום")
  ) {
    if (isHeb) {
      return "עלות הבדיקה תלויה בסוג הבגד (חליפות, מעילים, ז'קטים, מכנסיים או בדים). זמן הבדיקה הוא כ-1-2 ימי עסקים. ניתן לפנות למעבדה לקבלת הצעת מחיר מדויקת.";
    }
    return "Testing fees depend on the garment type (suits, coats, jackets, pants, or custom textiles). Standard turnaround is 1-2 business days. Drop off your item or contact the lab for an exact quote.";
  }

  // VIP pickup / Delivery
  if (
    q.includes("pickup") ||
    q.includes("delivery") ||
    q.includes("home") ||
    q.includes("vip") ||
    q.includes("איסוף") ||
    q.includes("משלוח") ||
    q.includes("בית") ||
    q.includes("עד הבית")
  ) {
    if (isHeb) {
      return "אנו מציעים שירות VIP של איסוף והחזרה עד לבית הלקוח, וכן בדיקת שעטנז מקצועית בבית או בחנות. ניתן לתאם זאת באתר או מול המעבדה בטלפון 845-552-4744.";
    }
    return "We offer premium VIP home pickup & delivery services, as well as on-site store inventory certification. You can coordinate this on our website or by calling 845-552-4744.";
  }

  // Human representative / Callback
  if (
    q.includes("human") ||
    q.includes("person") ||
    q.includes("speak") ||
    q.includes("call") ||
    q.includes("phone") ||
    q.includes("נציג") ||
    q.includes("אדם") ||
    q.includes("לדבר") ||
    q.includes("שיחה") ||
    q.includes("טלפון")
  ) {
    if (isHeb) {
      if (adminOnline) {
        return "נציג מעבדה מחובר כעת במערכת וקיבל התראה על הודעתך. זמן מענה משוער: 1-3 דקות. תוכל להמתין כאן או להשאיר מספר טלפון לחזרה.";
      }
      return "נציג המעבדה קיבל התראה על פנייתך. תוכל להשאיר כאן את מספר הטלפון שלך והשעה הנוחה, ונחזור אליך בהקדם האפשרי.";
    }
    if (adminOnline) {
      return "A lab representative is currently online and has been alerted. Estimated wait time: 1-3 minutes. You can wait here or leave your phone number for a callback.";
    }
    return "A lab specialist has been alerted to your message. Please leave your phone number and the best time to reach you, and we will call or text you shortly.";
  }

  // Generic fallback with routing notice
  if (isHeb) {
    if (adminOnline) {
      return "תודה שפנית למעבדת השעטנז! סייר ה-AI של המעבדה כאן לשירותך, ונציג אנושי מחובר כעת במערכת. תוכל להמתין למענה או להשאיר מספר טלפון לחזרה.";
    }
    return "תודה שפנית למעבדת השעטנז! סייר ה-AI רשם את שאלתך ונציג המעבדה עודכן. להמשך בירור מהיר תוכל להשאיר מספר טלפון ונחזור אליך בהקדם.";
  }

  if (adminOnline) {
    return "Thank you for contacting The Shatnez Lab! Our AI assistant is here to help, and a live lab representative is currently online. You can wait a moment or leave your phone number.";
  }
  return "Thank you for contacting The Shatnez Lab! A lab specialist has been alerted. If you would like us to call or text you, please reply with your phone number.";
}

async function generateAiChatReply(
  userMessage: string,
  history: ChatMessage[],
  isHeb: boolean,
  adminOnline: boolean,
  apiKey?: string
): Promise<string | null> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return null;

  const targetLang = isHeb ? "HEBREW (עברית טבעית ונעימה)" : "ENGLISH";

  const systemInstruction = `You are a helpful, courteous, and knowledgeable customer service AI assistant and first responder for "The Shatnez Lab" (מעבדת השעטנז - ClearFabric).
Your role is to assist website visitors, clarify their needs, provide accurate answers from the knowledge base, and smoothly route inquiries to human lab specialists when needed.

Language Requirement:
- Reply in ${targetLang}. If the visitor writes in Hebrew or Yiddish, reply in fluent Hebrew. If they write in English, reply in English.

Knowledge Base & Lab Facts:
- Business Name: The Shatnez Lab (ClearFabric) / מעבדת השעטנז
- Primary Drop-off Location: 14 Buchanan Rd, Spring Valley, NY (הנחת בגדים במעטפה/שקית עם פרטי קשר).
- Secondary Drop-off Location: 166 Clinton Lane, Spring Valley, NY.
- Business Hours: Sunday through Thursday, 9:00 AM – 9:00 PM. Closed on Friday & Shabbat (סגור בשישי ושבת).
- Phone: 845-552-4744.
- Turnaround Time: Standard turnaround is 1 to 2 business days (1-2 ימי עסקים). Urgent / on-spot checking is available by prior appointment.
- Services: Certified laboratory microscopic testing of coats, suits, jackets, blazers, pants, skirts, wool garments, linens, and home textiles. VIP home pickup & delivery service. On-site store and inventory certification. Mail-in shipping available.
- Order Tracking: Visitors can track orders directly by providing their order number (e.g. 105) or phone number in this chat, or on /track.

Representative Availability Status:
- Human Lab Representative is currently: ${adminOnline ? "ONLINE (מחובר כעת)" : "AWAY / ON CALL (נציג מקבל התראות SMS/מייל בזמן אמת)"}.

Interaction Guidelines:
1. Contact Info Recognition: If the visitor provides a phone number or email, acknowledge it warmly and confirm that a lab specialist has been notified and will reach out.
2. Direct Answers: Answer standard questions (hours, drop-off locations, turnaround time, services, how testing works) directly, clearly, and concisely.
3. Complex Inquiries & Human Escalation:
   - If the inquiry is complex, specialized, or if the visitor asks to speak with a human representative:
     - Answer any part you can, and inform them politely:
       - If representative is online: "נציג מעבדה מחובר כעת וקיבל את הודעתך (זמן מענה משוער: 1-3 דקות). תוכל להמתין כאן או להשאיר מספר טלפון לחזרה." / "A lab representative is online and has been alerted (est. wait: 1-3 mins). You can wait here or leave your phone number."
       - If representative is away: "פנייתך הועברה לנציג המעבדה שקיבל התראה מיידית. תוכל להשאיר כאן מספר טלפון ונחזור אליך בהקדם האפשרי." / "Your inquiry has been forwarded to our lab specialist. Please leave your phone number and we will contact you shortly."
4. Conciseness: Keep answers clear, friendly, and brief (2-4 sentences maximum). Do not use markdown headers or json.`;

  const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

  for (const model of modelsToTry) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const recentMessages = history
        .slice(-20)
        .map((m) => `${m.sender === "user" ? "Visitor" : "Lab Specialist"}: ${m.text}`)
        .join("\n");
      const promptText = `${systemInstruction}\n\nRecent conversation:\n${recentMessages}\n\nVisitor: ${userMessage}\nLab Assistant:`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
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

    const trimmedText = text.trim();
    const userIsHeb = isHebrew(trimmedText);

    // 1. Get or create session
    const session = await getOrCreateChatSession(sessionId);

    // 2. Add user message to session
    let updatedSession = await addChatMessage(session.sessionId, "user", trimmedText);
    const settings = await getAdminSettings();
    const geminiApiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    // Check admin presence status
    const presence = await getAdminPresence();
    const adminOnline = presence.isOnline;

    // 3. Check for Phone Callback Response or Order ID Lookup
    let aiReply: string | null = null;

    const cleanDigits = trimmedText.replace(/\D/g, "");
    const isExplicitPhone =
      cleanDigits.length >= 7 &&
      cleanDigits.length <= 15 &&
      (cleanDigits.length >= trimmedText.replace(/[^a-zA-Z0-9]/g, "").length ||
        trimmedText.includes("טלפון") ||
        trimmedText.toLowerCase().includes("phone") ||
        trimmedText.toLowerCase().includes("call") ||
        trimmedText.toLowerCase().includes("number"));

    // Check if bot previously asked for phone number in this session
    const priorAdminMsgs = (updatedSession?.messages || []).filter(
      (m) =>
        m.sender === "admin" &&
        m.id !== updatedSession?.messages?.[updatedSession.messages.length - 1]?.id
    );
    const lastAdminMsg = priorAdminMsgs.slice(-1)[0]?.text || "";
    const botPreviouslyAskedForPhone =
      lastAdminMsg.includes("טלפון") ||
      lastAdminMsg.includes("phone") ||
      lastAdminMsg.includes("חזרה") ||
      lastAdminMsg.includes("callback") ||
      lastAdminMsg.includes("reach you") ||
      lastAdminMsg.includes("call you");

    const isPhoneResponse =
      isExplicitPhone || (botPreviouslyAskedForPhone && cleanDigits.length >= 7 && cleanDigits.length <= 15);

    // If visitor provided a phone number:
    if (isPhoneResponse) {
      let linkedOrdersText = "";
      if (cleanDigits.length >= 7) {
        try {
          const orders = await getOrdersByPhone(cleanDigits);
          if (orders && orders.length > 0) {
            const latestOrder = orders[0];
            linkedOrdersText = userIsHeb
              ? `\n\nבנוסף, אותרה במערכת הזמנה #${latestOrder.id} על שמך:\n${formatOrderStatusHebrew(
                  latestOrder
                )}`
              : `\n\nAlso, order #${latestOrder.id} was found under your phone number:\n${formatOrderStatusEnglish(
                  latestOrder
                )}`;
          }
        } catch (e) {
          console.warn("[LiveChat] Error querying order by phone:", e);
        }
      }

      if (userIsHeb) {
        aiReply = `תודה רבה! מספר הטלפון שלך (${trimmedText}) נקלט בהצלחה במערכת. נציג מעבדה קיבל התראה וייצור איתך קשר בהקדם האפשרי.${linkedOrdersText}`;
      } else {
        aiReply = `Thank you! We have received your phone number (${trimmedText}). A lab specialist has been notified and will contact you as soon as possible.${linkedOrdersText}`;
      }
    } else {
      // Check if input looks like an order ID (e.g. "#105", "105", "order 105")
      const orderMatch = trimmedText.match(/^(?:#|order\s*#?|הזמנה\s*#?)?(\d{2,6})$/i);
      if (orderMatch && orderMatch[1].length <= 5) {
        const orderId = orderMatch[1];
        try {
          const order = await getOrderById(orderId);
          if (order) {
            aiReply = userIsHeb ? formatOrderStatusHebrew(order) : formatOrderStatusEnglish(order);
          } else {
            aiReply = userIsHeb
              ? `חיפשנו במערכת אך לא נמצאה הזמנה שמספרה #${orderId}. אנא ודא את המספר או השאר מספר טלפון לאיתור.`
              : `We checked the database but could not find order #${orderId}. Please verify the number or provide your phone number.`;
          }
        } catch (e) {
          console.warn("[LiveChat] Error querying order by ID:", e);
        }
      }
    }

    // 4. Generate AI Reply if not an order match / phone callback
    if (!aiReply && updatedSession) {
      aiReply = await generateAiChatReply(
        trimmedText,
        updatedSession.messages,
        userIsHeb,
        adminOnline,
        geminiApiKey
      );

      if (!aiReply) {
        console.log("[LiveChat AI] Using smart fallback reply");
        aiReply = getSmartFallbackReply(trimmedText, userIsHeb, adminOnline);
      }
    }

    if (aiReply && updatedSession) {
      updatedSession = await addChatMessage(session.sessionId, "admin", aiReply);
    }

    // 5. Send SMS notification to admin with visitor question & AI reply
    const adminPhone = settings.forwardingNumber || settings.twilioPhoneNumber;
    if (adminPhone) {
      let smsBody = isPhoneResponse
        ? `[#${session.shortId}] 📞 Customer Phone Callback Received: ${trimmedText}`
        : `[#${session.shortId}] Web Visitor: ${trimmedText}`;
      if (aiReply) {
        smsBody += `\n\nReply: ${aiReply.substring(0, 140)}`;
      }
      smsBody += `\n\n(Reply: #${session.shortId} your reply)`;

      sendSms(adminPhone, smsBody).catch((err) => {
        console.warn(`[Chat API] SMS notification background send error:`, err);
      });
    }

    // 6. Send Email Alert Notification to Admin
    const emailSubject = `💬 Live Chat Alert [#${session.shortId}] - New Website Visitor Question`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #0f172a; padding: 16px; border-radius: 8px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; color: #f59e0b; font-size: 20px;">💬 The Shatnez Lab - Website Live Chat</h2>
          <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Chat Session ID: #${session.shortId}</p>
        </div>

        <div style="margin: 20px 0; padding: 16px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px;">
          <strong style="color: #b45309; font-size: 14px;">👤 Visitor Message:</strong>
          <p style="margin: 8px 0 0 0; font-size: 16px; color: #1e293b; font-weight: 500;">"${trimmedText}"</p>
        </div>

        ${aiReply ? `
        <div style="margin: 20px 0; padding: 16px; background-color: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 6px;">
          <strong style="color: #0369a1; font-size: 14px;">🤖 AI Assistant Auto-Reply:</strong>
          <p style="margin: 8px 0 0 0; font-size: 15px; color: #0f172a; white-space: pre-wrap;">"${aiReply}"</p>
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
      text: `Live Chat [#${session.shortId}] Message: ${trimmedText}${aiReply ? `\n\nAI Replied: ${aiReply}` : ''}`,
      html: emailHtml,
    }).catch((err) => {
      console.warn("[Chat API] Email notification background send error:", err);
    });

    return NextResponse.json({
      success: true,
      session: updatedSession || session,
      aiReplied: !!aiReply,
      adminOnline,
    });
  } catch (error: any) {
    console.error("[Chat API] Error processing user message:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process chat message" },
      { status: 500 }
    );
  }
}
