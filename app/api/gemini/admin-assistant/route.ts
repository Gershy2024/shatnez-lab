import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSettings,
  getAllOrders,
  getAllCalls,
  getAllVoicemails,
  getAllDeliveryRequests,
  getAllSmsMessages,
} from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { query, history = [], isRtl = true, clientData } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const settings = await getAdminSettings();
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured in settings. Please add it in the Settings tab.",
        },
        { status: 400 }
      );
    }

    // Gather Live Data (use clientData if provided as primary, fallback/merge with server DB)
    let orders = clientData?.orders || [];
    let calls = clientData?.calls || [];
    let voicemails = clientData?.voicemails || [];
    let deliveries = clientData?.deliveries || [];
    let billingData = clientData?.billingData || null;

    if (orders.length === 0) {
      try {
        orders = await getAllOrders();
      } catch (e) {
        console.error("Error fetching orders for AI assistant:", e);
      }
    }

    if (calls.length === 0) {
      try {
        calls = await getAllCalls();
      } catch (e) {
        console.error("Error fetching calls for AI assistant:", e);
      }
    }

    if (voicemails.length === 0) {
      try {
        voicemails = await getAllVoicemails();
      } catch (e) {
        console.error("Error fetching voicemails for AI assistant:", e);
      }
    }

    if (deliveries.length === 0) {
      try {
        deliveries = await getAllDeliveryRequests();
      } catch (e) {
        console.error("Error fetching deliveries for AI assistant:", e);
      }
    }

    // Time calculations (New York timezone)
    const now = new Date();
    const nyTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyTimeStr);
    
    const startOfToday = new Date(nyDate.getFullYear(), nyDate.getMonth(), nyDate.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

    // Calls Analytics
    const callsToday = calls.filter((c: any) => c.timestamp >= startOfToday);
    const callsPast7Days = calls.filter((c: any) => c.timestamp >= sevenDaysAgo);

    let todayInbound = 0;
    let todayOutbound = 0;
    let todaySms = 0;
    let todayTotalDurationSec = 0;
    let todayCallsWithDuration = 0;

    const todayIvrPresses: Record<string, number> = {
      "1_info_pricing": 0,
      "2_status_check": 0,
      "3_vip_services": 0,
      "5_delivery": 0,
      "9_admin_pin": 0,
      "0_representative": 0,
      "voicemail_left": 0,
    };

    callsToday.forEach((c: any) => {
      const isOutbound = c.direction === "outbound" || (c.actions || []).some((act: string) => act.toLowerCase().includes("outbound"));
      const isSms = (c.actions || []).some((act: string) => act.trim().startsWith("SMS:") || act.includes("SMS:"));

      if (isSms) {
        todaySms++;
      } else if (isOutbound) {
        todayOutbound++;
      } else {
        todayInbound++;
      }

      if (c.duration) {
        const sec = parseInt(String(c.duration).replace("s", ""), 10);
        if (!isNaN(sec)) {
          todayTotalDurationSec += sec;
          todayCallsWithDuration++;
        }
      }

      (c.actions || []).forEach((act: string) => {
        if (act.includes("Option 1") || act.includes("אופציה 1")) todayIvrPresses["1_info_pricing"]++;
        if (act.includes("Option 2") || act.includes("אופציה 2") || act.includes("Looked up") || act.includes("Auto Caller Lookup") || act.includes("Typed status check")) todayIvrPresses["2_status_check"]++;
        if (act.includes("Option 3") || act.includes("אופציה 3")) todayIvrPresses["3_vip_services"]++;
        if (act.includes("Option 5") || act.includes("Confirmed Delivery")) todayIvrPresses["5_delivery"]++;
        if (act.includes("Option 9") || act.includes("Admin PIN") || act.includes("Admin Logged In")) todayIvrPresses["9_admin_pin"]++;
        if (act.includes("Representative") || act.includes("נציג") || act.includes("Forwarded")) todayIvrPresses["0_representative"]++;
        if (act.includes("Voicemail Left") || act.includes("קולי")) todayIvrPresses["voicemail_left"]++;
      });
    });

    const todayAvgDurationSec = todayCallsWithDuration > 0 ? Math.round(todayTotalDurationSec / todayCallsWithDuration) : 0;

    // Orders Analytics
    const activeOrders = orders.filter((o: any) => !o.archived);
    const archivedOrders = orders.filter((o: any) => !!o.archived);

    const ordersByStatus: Record<string, number> = {
      received: 0,
      testing: 0,
      review: 0,
      ready: 0,
      delivered: 0,
      issue: 0,
    };

    let shatnezFoundCount = 0;
    let cleanOrdersCount = 0;

    activeOrders.forEach((o: any) => {
      if (ordersByStatus[o.status] !== undefined) {
        ordersByStatus[o.status]++;
      }
      if (o.result?.includes("Shatnez Found")) shatnezFoundCount++;
      if (o.result?.includes("Clean")) cleanOrdersCount++;
    });

    // Voicemails Analytics
    const unreadVoicemails = voicemails.filter((v: any) => !v.read);

    // Deliveries Analytics
    const pendingDeliveries = deliveries.filter((d: any) => d.status === "pending");
    const calledDeliveries = deliveries.filter((d: any) => d.status === "called");
    const completedDeliveries = deliveries.filter((d: any) => d.status === "completed");

    // Build the rich context for Gemini
    const systemPrompt = `You are the intelligent Executive AI Assistant for the Manager/Owner of "The Shatnez Lab" (מעבדת שעטנז) in Spring Valley, NY (14 Buchanan Rd).
Current Date & Time (America/New_York): ${nyTimeStr}

You have DIRECT, REAL-TIME access to all operations data in the lab management system:

==================================================
📊 LIVE REAL-TIME DATA SNAPSHOT
==================================================

📞 CALLS & TELEPHONY TODAY:
- Total Calls Today: ${callsToday.length} (Inbound: ${todayInbound}, Outbound: ${todayOutbound}, SMS: ${todaySms})
- Calls in Past 7 Days: ${callsPast7Days.length}
- Average Call Duration Today: ${todayAvgDurationSec}s (${Math.floor(todayAvgDurationSec / 60)}m ${todayAvgDurationSec % 60}s)
- IVR Keypresses Today:
  * Option 1 (Drop-off & Pricing info): ${todayIvrPresses["1_info_pricing"]}
  * Option 2 (Check Order Status): ${todayIvrPresses["2_status_check"]}
  * Option 3 (Special / VIP Store services): ${todayIvrPresses["3_vip_services"]}
  * Option 5 (Door-to-door Delivery): ${todayIvrPresses["5_delivery"]}
  * Option 9 (Admin PIN login): ${todayIvrPresses["9_admin_pin"]}
  * Option 0 (Forward to Representative): ${todayIvrPresses["0_representative"]}
  * Voicemails left today: ${todayIvrPresses["voicemail_left"]}

Recent Calls (Last 25):
${JSON.stringify(
  calls.slice(0, 25).map((c: any) => ({
    id: c.id,
    phone: c.phone,
    time: new Date(c.timestamp).toLocaleString("en-US", { timeZone: "America/New_York" }),
    direction: c.direction || "inbound",
    duration: c.duration || "0s",
    status: c.status,
    actionsSummary: c.actions ? c.actions.join(" -> ") : "",
    price: c.price ? `${c.price} ${c.priceUnit || "USD"}` : "N/A",
  })),
  null,
  2
)}

--------------------------------------------------
📦 ORDERS & LAB INSPECTIONS:
- Total Active Orders: ${activeOrders.length} (Archived: ${archivedOrders.length})
- Status Breakdown:
  * Received (התקבל): ${ordersByStatus.received}
  * Testing (בבדיקה): ${ordersByStatus.testing}
  * Review (בבדיקה חוזרת): ${ordersByStatus.review}
  * Ready for Pickup (מוכן לאיסוף): ${ordersByStatus.ready}
  * Delivered (נמסר ללקוח): ${ordersByStatus.delivered}
  * Issue (תקלה/דורש בירור): ${ordersByStatus.issue}
- Results Breakdown:
  * Clean / No Shatnez: ${cleanOrdersCount}
  * Shatnez Found: ${shatnezFoundCount}

All Active Orders List:
${JSON.stringify(
  activeOrders.map((o: any) => ({
    id: o.id,
    customerName: o.customerName,
    phone: o.phone,
    status: o.status,
    result: o.result || "None",
    location: o.location || "14 Buchanan Rd",
    dateReceived: o.dateReceived,
    estimatedCompletion: o.estimatedCompletion,
    notes: o.notes,
  })),
  null,
  2
)}

--------------------------------------------------
📥 VOICEMAILS:
- Total Voicemails: ${voicemails.length} (Unread / New: ${unreadVoicemails.length})
Recent Voicemails:
${JSON.stringify(
  voicemails.slice(0, 15).map((v: any) => ({
    id: v.id,
    phone: v.phone,
    duration: v.duration,
    read: v.read,
    time: new Date(v.timestamp).toLocaleString("en-US", { timeZone: "America/New_York" }),
  })),
  null,
  2
)}

--------------------------------------------------
🚚 PICK UP & DELIVERY REQUESTS:
- Pending: ${pendingDeliveries.length}
- Called/Scheduled: ${calledDeliveries.length}
- Completed: ${completedDeliveries.length}
Recent Delivery Requests:
${JSON.stringify(
  deliveries.slice(0, 15).map((d: any) => ({
    id: d.id,
    customerName: d.customerName,
    phone: d.phone,
    status: d.status,
    notes: d.notes,
    time: new Date(d.timestamp).toLocaleString("en-US", { timeZone: "America/New_York" }),
  })),
  null,
  2
)}

--------------------------------------------------
⚙️ SYSTEM SETTINGS & STATUS:
- Forwarding Phone Number: ${settings.forwardingNumber || "Not configured"}
- Forwarding Hours: ${settings.forwardingHoursStart || "09:00"} - ${settings.forwardingHoursEnd || "21:00"}
- Do Not Disturb (DND): ${settings.dndActive ? "ACTIVE (All calls go to Voicemail)" : "OFF (Normal routing)"}
- Holiday Mode: ${settings.holidayModeActive ? "ACTIVE (Holiday greeting + Voicemail)" : "OFF"}
${billingData ? `- Twilio Cost This Month: $${billingData.thisMonth?.total?.toFixed(2) || "0.00"} ${billingData.currency || "USD"}` : ""}

==================================================
INSTRUCTIONS FOR ASSISTANT:
1. You are talking to the Admin/Manager of the lab. Be helpful, concise, highly professional, friendly and accurate.
2. If asked in Hebrew (or Yiddish/Hebrew mix), answer in fluent, natural Hebrew. If asked in English, answer in English. (Default to Hebrew if ambiguous or isRtl=${isRtl}).
3. Use clean, beautiful formatting with Markdown: bold headlines, neat bullet points, badges or emojis (📞, 📦, 🚚, 📥, ✅, ⚠️, 💰) where appropriate.
4. When asked questions like "how many calls today?", "which orders are ready?", "did customer X call?", "summary of today", look through the real-time data provided above and give exact figures, names, and details.
5. If the user asks you to write a message, create an order summary, or analyze trends, do so constructively based on the real lab details.
6. When mentioning phone numbers, format them clearly with dashes (e.g. 845-552-4744).
7. If data is zero or none exists for a query, state it clearly and politely.`;

    // Prepare contents for Gemini API (include history)
    const contents: any[] = [];

    // Add prior conversation turns if available
    if (Array.isArray(history) && history.length > 0) {
      history.slice(-8).forEach((item: any) => {
        contents.push({
          role: item.role === "user" ? "user" : "model",
          parts: [{ text: item.text }],
        });
      });
    }

    // Add current user prompt
    contents.push({
      role: "user",
      parts: [{ text: query }],
    });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini Assistant error:", errText);
      return NextResponse.json(
        { error: `Gemini API error: ${errText}` },
        { status: 500 }
      );
    }

    const resData = await response.json();
    const replyText =
      resData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "לא התקבלה תשובה משרת ה-AI.";

    return NextResponse.json({
      success: true,
      reply: replyText.trim(),
      metrics: {
        totalCallsToday: callsToday.length,
        inboundToday: todayInbound,
        outboundToday: todayOutbound,
        activeOrdersCount: activeOrders.length,
        readyOrdersCount: ordersByStatus.ready,
        unreadVoicemailsCount: unreadVoicemails.length,
        pendingDeliveriesCount: pendingDeliveries.length,
      },
    });
  } catch (error: any) {
    console.error("Error in admin-assistant route:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
