import { NextRequest, NextResponse } from "next/server";
import { getOrCreateChatSession, addChatMessage, ChatMessage, getAdminPresence } from "@/lib/liveChat";
import { sendSms } from "@/lib/twilioCall";
import { getAdminSettings, getOrderById, getOrdersByPhone, Order } from "@/lib/db";
import { sendEmailNotification } from "@/lib/email";

function isHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

function isYiddish(text: string): boolean {
  if (!isHebrew(text)) return false;
  const yiddishKeywords = [
    "וועלכע",
    "זענען",
    "ענק",
    "אפן",
    "אפען",
    "עפענען",
    "קאסט",
    "קאסטן",
    "וויפיל",
    "פרייז",
    "פרייזן",
    "וואו",
    "וואס",
    "הערט",
    "איבערלאזן",
    "איבערגעבן",
    "נעמט",
    "צייט",
    "געדויערט",
    "שנעל",
    "באצאלן",
    "געלט",
    "רעדן",
    "מענטש",
    "האבן",
    "מיר",
    "איר",
    "אייך",
    "קומען",
    "זונטאג",
    "מאנטיג",
    "דינסטיג",
    "מיטוואך",
    "דאנערשטאג",
    "פרייטאג",
    "ביינאכט",
    "צופרי",
    "אנצוג",
    "רעקל",
    "מאנטל",
    "הויזן",
    "קלייד",
    "גוט מארגן",
    "גוט אוונט",
  ];
  const lower = text.toLowerCase();
  return yiddishKeywords.some((w) => lower.includes(w));
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
  const isYid = isYiddish(text);

  // 1. Contact number provided
  if (cleanDigits.length >= 7) {
    if (isYid) {
      return `א גרויסן דאנק! מיר האבן באקומען אייער טעלעפאן נומער (${text.trim()}). א נציג פון די מעבדה וועט אייך צוריקרופן ווי שנעלער.`;
    }
    if (isHeb) {
      return `תודה רבה! קיבלנו את מספר הטלפון שלך (${text.trim()}). נציג המעבדה קיבל התראה ויחזור אליך בהקדם האפשרי.`;
    }
    return `Thank you! We have received your phone number (${text.trim()}). A lab specialist has been notified and will contact you as soon as possible.`;
  }

  // 2. Email provided
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch) {
    if (isYid) {
      return `א דאנק! מיר האבן באקומען אייער אימעיל (${emailMatch[0]}). א נציג וועט זיך פארבינדן מיט אייך אין קורצן.`;
    }
    if (isHeb) {
      return `תודה! קיבלנו את כתובת האימייל שלך (${emailMatch[0]}). נציג המעבדה עודכן וייצור איתך קשר בהקדם.`;
    }
    return `Thank you! We have received your email address (${emailMatch[0]}). A lab specialist has been notified and will be in touch shortly.`;
  }

  // 3. Pricing / Cost / How much (Checked FIRST before tracking!)
  if (
    q.includes("price") ||
    q.includes("cost") ||
    q.includes("fee") ||
    q.includes("how much") ||
    q.includes("charge") ||
    q.includes("rate") ||
    q.includes("pricing") ||
    q.includes("מחיר") ||
    q.includes("מחירים") ||
    q.includes("עלות") ||
    q.includes("כמה עולה") ||
    q.includes("תשלום") ||
    q.includes("קאסט") ||
    q.includes("קאסטן") ||
    q.includes("וויפיל") ||
    q.includes("פרייז") ||
    q.includes("פרייזן") ||
    q.includes("געלט") ||
    q.includes("באצאלן")
  ) {
    if (isYid) {
      return "די פרייז פאר שעטנז בדיקה איז געווענליך צווישן $15 ביז $25 פאר א קלייד (רעקלאך, אנצוגן, מאנטלען, הויזן וכדומה). עס נעמט געווענליך 1-2 טעג. איר קענט עס איבערלאזן ביי 14 Buchanan Rd אדער רופן 845-552-4744.";
    }
    if (isHeb) {
      return "עלות בדיקת שעטנז נעה בדרך כלל בין $15 ל-$25 לבגד (חליפות, מעילים, ז'קטים, מכנסיים וכו'). זמן הבדיקה הרגיל הוא 1-2 ימי עסקים. ניתן להניח את הבגד ב-14 Buchanan Rd או ליצור קשר ב-845-552-4744.";
    }
    return "Testing fees typically range from $15 to $25 per garment (suits, coats, jackets, pants, or custom textiles). Standard turnaround is 1-2 business days. Drop off items at 14 Buchanan Rd or call 845-552-4744 for an exact quote.";
  }

  // 4. Opening Hours / Schedule / When open
  if (
    q.includes("hour") ||
    q.includes("hours") ||
    q.includes("open") ||
    q.includes("opening") ||
    q.includes("close") ||
    q.includes("closing") ||
    q.includes("schedule") ||
    q.includes("when") ||
    q.includes("time") ||
    q.includes("שעות") ||
    q.includes("פתוח") ||
    q.includes("שעות פעילות") ||
    q.includes("מתי") ||
    q.includes("זמנים") ||
    q.includes("מתי פתוח") ||
    q.includes("שעה") ||
    q.includes("שעות פתיחה") ||
    q.includes("סגור") ||
    q.includes("וועלכע שעה") ||
    q.includes("אפן") ||
    q.includes("אפען") ||
    q.includes("עפענען") ||
    q.includes("ווען") ||
    q.includes("זענען ענק אפן") ||
    q.includes("זענט איר אפן")
  ) {
    if (isYid) {
      return "די מעבדה איז אפן זונטאג ביז דאנערשטאג פון 9:00 צופרי ביז 9:00 ביינאכט (9:00 AM - 9:00 PM). פרייטאג און שבת איז פארמאכט.";
    }
    if (isHeb) {
      return "שעות הפעילות של מעבדת השעטנז: ימים ראשון עד חמישי בין השעות 9:00 בבוקר ל-21:00 בערב (9:00 AM – 9:00 PM). בימי שישי ובשבת המעבדה סגורה.";
    }
    return "The Shatnez Lab is open Sunday through Thursday from 9:00 AM to 9:00 PM. We are closed on Friday and Shabbat.";
  }

  // 5. Drop-off / Locations / Address
  if (
    q.includes("location") ||
    q.includes("locations") ||
    q.includes("address") ||
    q.includes("where") ||
    q.includes("drop") ||
    q.includes("dropoff") ||
    q.includes("bring") ||
    q.includes("place") ||
    q.includes("directions") ||
    q.includes("כתובת") ||
    q.includes("מיקום") ||
    q.includes("איפה") ||
    q.includes("איפה לשים") ||
    q.includes("מסירה") ||
    q.includes("להביא") ||
    q.includes("להניח") ||
    q.includes("איפה אתם") ||
    q.includes("נקודת מסירה") ||
    q.includes("וואו") ||
    q.includes("וואו איז") ||
    q.includes("וואו קען מען") ||
    q.includes("ברענגען") ||
    q.includes("אדרעס") ||
    q.includes("פלאץ") ||
    q.includes("איבערלאזן")
  ) {
    if (isYid) {
      return "אונזער הויפט פלאץ איז: 14 Buchanan Rd, Spring Valley, NY. מיר האבן אויך נאך א דראפ-אף לאקאציע ביי: 166 Clinton Lane, Spring Valley, NY. לייגט אריין די בגדים אין א זעקל מיט אייער נאמען און טעלעפאן נומער.";
    }
    if (isHeb) {
      return "כתובת המסירה הראשית: 14 Buchanan Rd, Spring Valley, NY. נקודת מסירה נוספת: 166 Clinton Lane, Spring Valley, NY. ניתן להניח את הבגדים בשקית/מעטפה עם שמך ומספר הטלפון שלך.";
    }
    return "Our primary drop-off location is 14 Buchanan Rd, Spring Valley, NY. We also have a secondary drop-off location at 166 Clinton Lane, Spring Valley, NY. Place garments in a bag with your name and phone number.";
  }

  // 6. Turnaround Time / How long
  if (
    q.includes("how long") ||
    q.includes("duration") ||
    q.includes("time take") ||
    q.includes("turnaround") ||
    q.includes("when ready") ||
    q.includes("fast") ||
    q.includes("urgent") ||
    q.includes("same day") ||
    q.includes("כמה זמן") ||
    q.includes("זמן בדיקה") ||
    q.includes("תוך כמה זמן") ||
    q.includes("מתי מוכן") ||
    q.includes("דחוף") ||
    q.includes("באותו יום") ||
    q.includes("מהר") ||
    q.includes("ווי לאנג") ||
    q.includes("נעמט") ||
    q.includes("געדויערט") ||
    q.includes("שנעל")
  ) {
    if (isYid) {
      return "געווענליך נעמט די בדיקה 1-2 ביזנעס טעג. אויב איר דארפט א שנעלע / דרינגענדע בדיקה אויפן פלאץ, ביטע רופט 845-552-4744 צו קאארדינירן פון פאראויס.";
    }
    if (isHeb) {
      return "זמן הבדיקה הרגיל במעבדה הוא 1 עד 2 ימי עסקים. בדיקה דחופה או במקום אפשרית בתיאום טלפוני מראש ב-845-552-4744.";
    }
    return "Standard testing turnaround is 1 to 2 business days. Urgent or on-the-spot checking is available by prior coordination at 845-552-4744.";
  }

  // 7. VIP pickup / Delivery
  if (
    q.includes("pickup") ||
    q.includes("delivery") ||
    q.includes("home") ||
    q.includes("vip") ||
    q.includes("איסוף") ||
    q.includes("משלוח") ||
    q.includes("בית") ||
    q.includes("עד הבית") ||
    q.includes("החזרה") ||
    q.includes("היים") ||
    q.includes("נעמען")
  ) {
    if (isYid) {
      return "מיר שטעלן צו א ספעציעלע VIP סערוויס פון אויפנעמען און צוריקברענגען בגדים ביז צום טיר. מען קען עס באשטעלן אויפן וועבסייט אדער רופן 845-552-4744.";
    }
    if (isHeb) {
      return "אנו מציעים שירות VIP של איסוף והחזרה עד לבית הלקוח, וכן בדיקת שעטנז מקצועית בבית או בחנות. ניתן לתאם זאת באתר או מול המעבדה בטלפון 845-552-4744.";
    }
    return "We offer premium VIP home pickup & delivery services, as well as on-site store inventory certification. You can coordinate this on our website or by calling 845-552-4744.";
  }

  // 8. Order Tracking (Strict matching - only when asking for specific status/order)
  if (
    q.includes("track") ||
    q.includes("tracking") ||
    q.includes("order status") ||
    q.includes("check status") ||
    q.includes("where is my order") ||
    q.includes("my order") ||
    q.includes("is my order ready") ||
    q.includes("order ready") ||
    q.includes("סטטוס הזמנה") ||
    q.includes("מעקב הזמנה") ||
    q.includes("מצב הזמנה") ||
    q.includes("האם ההזמנה מוכנה") ||
    q.includes("ההזמנה שלי מוכנה") ||
    q.includes("איפה ההזמנה") ||
    q.includes("איפה הבגד") ||
    q.includes("ווי האלט מיין ארדער") ||
    q.includes("ארדער סטאטוס") ||
    q.includes("מיין ארדער")
  ) {
    if (isYid) {
      return "צו זען דעם סטאטוס פון אייער ארדער, ביטע שרייבט דא אייער ארדער נומער (למשל 105) אדער טעלעפאן נומער, אדער באזוכט די טרעקינג פעידזש (/track).";
    }
    if (isHeb) {
      return "למעקב אחר הזמנה, תוכל להקליד כאן את מספר ההזמנה שלך (למשל 105) או מספר הטלפון, או לבקר בעמוד מעקב הזמנה באתר (/track).";
    }
    return "To track your order, you can type your order number (e.g. 105) or phone number right here, or visit the Track Order page on our website (/track).";
  }

  // 9. Greetings
  if (
    q.includes("hello") ||
    q.includes("hi") ||
    q.includes("hey") ||
    q.includes("good morning") ||
    q.includes("good evening") ||
    q.includes("שלום") ||
    q.includes("היי") ||
    q.includes("בוקר טוב") ||
    q.includes("ערב טוב") ||
    q.includes("גוט מארגן") ||
    q.includes("גוט אוונט") ||
    q.includes("שלום עליכם") ||
    q.includes("וואס הערט זיך") ||
    q.includes("גוט יום טוב") ||
    q.includes("גוט וואך")
  ) {
    if (isYid) {
      return "שלום עליכם! ברוכים הבאים צו מעבדת השעטנז (ClearFabric). ווי אזוי קענען מיר אייך העלפן היינט מיט אייערע בגדים אדער שאלות?";
    }
    if (isHeb) {
      return "שלום וברכה! ברוכים הבאים למעבדת השעטנז. כיצד נוכל לעזור לך היום עם בדיקת הבגדים או שאלות?";
    }
    return "Hello! Welcome to The Shatnez Lab. How can we assist you today with your garment testing or questions?";
  }

  // 10. Human representative / Callback
  if (
    q.includes("human") ||
    q.includes("person") ||
    q.includes("speak") ||
    q.includes("call") ||
    q.includes("phone") ||
    q.includes("agent") ||
    q.includes("נציג") ||
    q.includes("אדם") ||
    q.includes("בנאדם") ||
    q.includes("אנושי") ||
    q.includes("לדבר") ||
    q.includes("שיחה") ||
    q.includes("טלפון") ||
    q.includes("רעדן") ||
    q.includes("מענטש") ||
    q.includes("רופן") ||
    q.includes("קאל")
  ) {
    if (isYid) {
      return "א נציג פון די מעבדה האט באקומען א נאטיפיקאציע. ביטע לאזט איבער אייער טעלעפאן נומער אדער שרייבט 'אמתין' און מיר וועלן אייך גערן ענטפערן.";
    }
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

  // 11. Natural comprehensive fallback
  if (isYid) {
    return "א גרויסן דאנק פארן זיך פארבינדן מיט מעבדת השעטנז! מיר זענען אפן זונטאג ביז דאנערשטאג 9AM-9PM ביי 14 Buchanan Rd (פרייזן $15-$25, נעמט 1-2 טעג). אויב איר דארפט הילף אדער ווילט רעדן מיט א נציג, לאזט איבער אייער טעלעפאן נומער און מיר וועלן אייך צוריקרופן.";
  }
  if (isHeb) {
    return "תודה שפנית למעבדת השעטנז! שעות הפעילות הן א'-ה' 9:00-21:00 ב-14 Buchanan Rd, עלות בדיקה $15-$25 (זמן בדיקה 1-2 ימים). לבירור נוסף או שיחה עם נציג תוכל להשאיר כאן מספר טלפון ונחזור אליך בהקדם.";
  }
  return "Thank you for contacting The Shatnez Lab! We are open Sun-Thu 9:00 AM – 9:00 PM at 14 Buchanan Rd. Testing is typically $15–$25 (1-2 business days). To speak with a specialist or request a callback, simply reply with your phone number!";
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

  const isYid = isYiddish(userMessage);
  let targetLang = "ENGLISH";
  if (isYid) {
    targetLang = "YIDDISH (אידיש / Yiddish dialect) or warm HEBREW";
  } else if (isHeb) {
    targetLang = "HEBREW (עברית טבעית, ברורה ונעימה)";
  }

  const systemInstruction = `You are a courteous, natural, and knowledgeable first responder AI assistant for "The Shatnez Lab" (מעבדת השעטנז - ClearFabric).
You talk like a real helpful human assistant at the front desk of a professional Shatnez testing laboratory in Spring Valley, NY.

Language Requirement:
- Reply in ${targetLang}. If the visitor speaks Yiddish (e.g. "וועלכע שעה זענען ענק אפן?", "וויפיל קאסט?"), reply in fluent, authentic Yiddish. If they speak Hebrew, reply in Hebrew. If English, reply in English.

Knowledge Base & Lab Facts:
- Business Name: The Shatnez Lab (ClearFabric) / מעבדת השעטנז
- Primary Drop-off Location: 14 Buchanan Rd, Spring Valley, NY (place garments in bag with name and phone number).
- Secondary Drop-off Location: 166 Clinton Lane, Spring Valley, NY.
- Business Hours: Sunday through Thursday, 9:00 AM – 9:00 PM. Closed Friday & Shabbat (סגור בשישי ושבת).
- Phone: 845-552-4744.
- Pricing / Fees: Standard testing fees are typically $15 to $25 per garment (suits, coats, blazers, pants, wool garments). Very affordable and certified.
- Turnaround Time: Standard turnaround is 1 to 2 business days (1-2 ימי עסקים). Urgent / on-the-spot checking available by appointment.
- Services: Microscopic laboratory testing for wool and linen fibers in men's, women's, and children's suits, jackets, coats, skirts, pants, sweaters, and blankets. VIP home pickup & delivery service. On-site store inventory certification.
- Order Tracking: Visitors can track orders directly by providing their order number (e.g. 105) or phone number in this chat, or on /track.

Representative Availability:
- Human Lab Representative is currently: ${adminOnline ? "ONLINE (מחובר כעת)" : "AWAY / ON CALL"}.

Guidelines:
1. Answer directly: When asked about hours, prices ($15-$25), addresses (14 Buchanan Rd), turnaround (1-2 days), or services, provide the exact direct answer immediately without generic filler.
2. If asked about tracking an order, ask for their Order ID or Phone Number.
3. If they leave a phone number or email, confirm it warmly and state that a lab specialist will contact them.
4. Keep answers brief, warm, concise, and natural (1-3 sentences). Never return JSON or markdown headers.`;

  const modelsToTry = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
  ];

  for (const model of modelsToTry) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const recentMessages = history
        .slice(-15)
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
        console.warn(`[LiveChat AI] Gemini model ${model} returned HTTP ${response.status}`);
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

    // 3. Human Escalation, Callback Response, or Order ID Lookup
    let aiReply: string | null = null;
    let sendAdminSmsNotice: { type: "phone_callback" | "chat_wait"; text: string } | null = null;

    const cleanDigits = trimmedText.replace(/\D/g, "");
    const isExplicitPhone =
      cleanDigits.length >= 7 &&
      cleanDigits.length <= 15 &&
      (cleanDigits.length >= trimmedText.replace(/[^a-zA-Z0-9]/g, "").length ||
        trimmedText.includes("טלפון") ||
        trimmedText.toLowerCase().includes("phone") ||
        trimmedText.toLowerCase().includes("call") ||
        trimmedText.toLowerCase().includes("number"));

    // Check if bot previously asked for phone or preference
    const priorAdminMsgs = (updatedSession?.messages || []).filter(
      (m) =>
        m.sender === "admin" &&
        m.id !== updatedSession?.messages?.[updatedSession.messages.length - 1]?.id
    );
    const lastAdminMsg = priorAdminMsgs.slice(-1)[0]?.text || "";
    const botPreviouslyAskedForContact =
      lastAdminMsg.includes("טלפון") ||
      lastAdminMsg.includes("phone") ||
      lastAdminMsg.includes("חזרה") ||
      lastAdminMsg.includes("callback") ||
      lastAdminMsg.includes("שיחה חוזרת") ||
      lastAdminMsg.includes("מענה") ||
      lastAdminMsg.includes("להמתין") ||
      lastAdminMsg.includes("wait");

    const isPhoneResponse =
      isExplicitPhone || (botPreviouslyAskedForContact && cleanDigits.length >= 7 && cleanDigits.length <= 15);

    const lower = trimmedText.toLowerCase();
    const isWaitInChatChoice =
      lower.includes("להמתין") ||
      lower.includes("אמתין") ||
      lower.includes("בחלון") ||
      lower.includes("בצ'אט") ||
      lower.includes("wait in chat") ||
      lower.includes("wait here") ||
      lower.includes("hold on") ||
      lower.includes("stay in chat") ||
      trimmedText.includes("מענה כאן בצ'אט") ||
      trimmedText.includes("אמתין למענה");

    const isRepresentativeRequest =
      !isPhoneResponse &&
      !isWaitInChatChoice &&
      (lower.includes("נציג") ||
        lower.includes("אדם חי") ||
        lower.includes("אדם") ||
        lower.includes("בנאדם") ||
        lower.includes("אנושי") ||
        lower.includes("לדבר עם") ||
        lower.includes("שיחה עם") ||
        lower.includes("שיחה חוזרת") ||
        lower.includes("תתקשרו") ||
        lower.includes("חייגו") ||
        lower.includes("human") ||
        lower.includes("representative") ||
        lower.includes("agent") ||
        lower.includes("specialist") ||
        lower.includes("real person") ||
        lower.includes("talk to someone") ||
        lower.includes("call me") ||
        lower.includes("request callback"));

    // Case 1: Visitor provided a phone number (Phone Callback)
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
        aiReply = `תודה רבה! מספר הטלפון שלך (${trimmedText}) נקלט בהצלחה במערכת. נציג מעבדה קיבל התראה ויחייג אליך בהקדם האפשרי.${linkedOrdersText}`;
      } else {
        aiReply = `Thank you! We have received your phone number (${trimmedText}). A lab specialist has been notified and will call you as soon as possible.${linkedOrdersText}`;
      }

      sendAdminSmsNotice = {
        type: "phone_callback",
        text: trimmedText,
      };
    }
    // Case 2: Visitor chose to wait in the chat window for an SMS reply from admin
    else if (isWaitInChatChoice) {
      // Find what question or topic the visitor previously asked
      const userQuestions = (updatedSession?.messages || [])
        .filter((m) => m.sender === "user" && m.text !== trimmedText)
        .slice(-2)
        .map((m) => m.text);
      const questionContext = userQuestions.length > 0 ? userQuestions.join(" | ") : trimmedText;

      if (userIsHeb) {
        aiReply = `נציג המעבדה עודכן והודעתך הועברה אליו ישירות. אנא המתן כאן בחלון הצ'אט בזמן שהנציג מנסח עבורך תשובה...`;
      } else {
        aiReply = `Our lab specialist has been alerted directly via SMS. Please hold on in this chat window while they prepare your answer...`;
      }

      sendAdminSmsNotice = {
        type: "chat_wait",
        text: questionContext,
      };
    }
    // Case 3: Visitor requested a human representative -> Ask how they want to connect
    else if (isRepresentativeRequest) {
      if (userIsHeb) {
        aiReply = `בשמחה! כיצד תרצה לקבל מענה מנציג המעבדה?\n\n1. 📞 שיחה חוזרת לטלפון: אנא הקלד את מספר הטלפון שלך ונחייג אליך בהקדם.\n2. 💬 מענה כאן בחלון הצ'אט: הקלד "אמתין כאן" והנציג ישיב לך ישירות לכאן.`;
      } else {
        aiReply = `Gladly! How would you prefer to connect with a lab specialist?\n\n1. 📞 Phone Callback: Please reply with your phone number and we will call you.\n2. 💬 Wait in Chat: Reply "Wait in chat" and a specialist will answer you right here.`;
      }
    }
    // Case 4: Order ID Lookup (e.g. "#105", "105", "order 105")
    else {
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

    // 4. Generate AI Reply if not an escalation / order match
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

    // 5. Send SMS notification to admin ONLY on human escalation or phone callback
    const adminPhone = settings.forwardingNumber || settings.twilioPhoneNumber;
    if (adminPhone && sendAdminSmsNotice) {
      let smsBody = "";
      if (sendAdminSmsNotice.type === "phone_callback") {
        smsBody = `[#${session.shortId}] 📞 Live Callback Request from customer phone: ${sendAdminSmsNotice.text}.\nPlease dial this number to assist the customer.`;
      } else if (sendAdminSmsNotice.type === "chat_wait") {
        smsBody = `[#${session.shortId}] 💬 Visitor is WAITING in Website Live Chat for your reply!\nQuestion: "${sendAdminSmsNotice.text}"\n\nReply directly to visitor by texting:\n#${session.shortId} your reply`;
      }

      if (smsBody) {
        sendSms(adminPhone, smsBody).catch((err) => {
          console.warn(`[Chat API] SMS notification background send error:`, err);
        });
      }
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
