import { NextRequest, NextResponse } from "next/server";
import { getAdminSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

interface TwilioUsageRecord {
  category: string;
  description: string;
  usage: string;
  usage_unit: string;
  price: string;
  price_unit: string;
}

const CATEGORY_MAP: Record<string, { en: string; he: string }> = {
  "calls": { en: "Programmable Voice", he: "שיחות טלפון (Voice)" },
  "channels": { en: "Programmable Messaging (SMS)", he: "הודעות וצ'אטים (SMS)" },
  "phonenumbers": { en: "Phone Numbers", he: "מספרי טלפון" },
  "speech-recognition": { en: "Gather Speech Recognition", he: "זיהוי דיבור (Speech to Text)" },
  "amazon-polly": { en: "Text to Speech (Amazon Polly)", he: "הקראת שמע (Amazon Polly)" },
  "tts-google": { en: "Text to Speech (Google)", he: "הקראת שמע (Google TTS)" },
  "recordingstorage": { en: "Call Recording Storage", he: "אחסון הקלטות שיחה" },
  "studio": { en: "Studio Executions", he: "תזרימי שיחה (Studio)" },
  "carrier-route-lookups": { en: "Carrier Lookups", he: "בירור רשת (Carrier Lookups)" },
};

const MAIN_CATEGORIES = [
  "calls",
  "channels",
  "phonenumbers",
  "speech-recognition",
  "amazon-polly",
  "tts-google",
  "recordingstorage",
  "studio",
  "carrier-route-lookups"
];

function formatCategory(category: string): { en: string; he: string } {
  if (CATEGORY_MAP[category]) {
    return CATEGORY_MAP[category];
  }
  // Fallback formatting: capitalize words
  const clean = category.replace(/-/g, " ");
  const en = clean.charAt(0).toUpperCase() + clean.slice(1);
  return { en, he: en };
}

async function fetchTwilioUsage(accountSid: string, auth: string, period: "Today" | "Yesterday" | "ThisMonth" | "LastMonth") {
  // Query with PageSize=1000 to fetch all active billing categories
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records/${period}.json?PageSize=1000`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Twilio API returned status ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const usageRecords: TwilioUsageRecord[] = data.usage_records || [];

  // 1. Determine total price from the official Twilio "totalprice" record
  const totalPriceRecord = usageRecords.find((r) => r.category === "totalprice");
  let totalCost = totalPriceRecord ? parseFloat(totalPriceRecord.price) : 0;
  let currency = totalPriceRecord?.price_unit?.toUpperCase() || "USD";

  // 2. Filter distinct main categories for the itemized breakdown (filter out zero usage)
  const activeRecords = usageRecords.filter(
    (r) => MAIN_CATEGORIES.includes(r.category) && (parseFloat(r.price) > 0 || parseFloat(r.usage) > 0)
  );

  const categories = activeRecords.map((r) => {
    const price = parseFloat(r.price) || 0;
    const usage = parseFloat(r.usage) || 0;

    const { en, he } = formatCategory(r.category);

    return {
      category: r.category,
      description: r.description,
      nameEn: en,
      nameHe: he,
      usage,
      unit: r.usage_unit,
      price,
      priceUnit: r.price_unit || "usd",
    };
  });

  // Fallback total calculation if "totalprice" record is missing (sum main categories)
  if (!totalPriceRecord) {
    totalCost = categories.reduce((sum, cat) => sum + cat.price, 0);
  }

  // Sort by price descending
  categories.sort((a, b) => b.price - a.price);

  return {
    total: Math.round(totalCost * 100) / 100, // round to 2 decimal places
    currency,
    categories,
  };
}

async function fetchTwilioBalance(accountSid: string, auth: string) {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return {
        balance: parseFloat(data.balance) || 0,
        currency: data.currency || "USD",
      };
    }
  } catch (err) {
    console.error("[Twilio Billing API] Error fetching balance:", err);
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const settings = await getAdminSettings();
    if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
      return NextResponse.json({
        success: false,
        error: "Twilio credentials are not configured in settings.",
      });
    }

    const auth = Buffer.from(`${settings.twilioAccountSid}:${settings.twilioAuthToken}`).toString("base64");

    const [balanceData, today, yesterday, thisMonth, lastMonth] = await Promise.all([
      fetchTwilioBalance(settings.twilioAccountSid, auth),
      fetchTwilioUsage(settings.twilioAccountSid, auth, "Today"),
      fetchTwilioUsage(settings.twilioAccountSid, auth, "Yesterday"),
      fetchTwilioUsage(settings.twilioAccountSid, auth, "ThisMonth"),
      fetchTwilioUsage(settings.twilioAccountSid, auth, "LastMonth"),
    ]);

    return NextResponse.json({
      success: true,
      balance: balanceData ? balanceData.balance : null,
      currency: balanceData?.currency || thisMonth.currency,
      today: {
        total: today.total,
        categories: today.categories,
      },
      yesterday: {
        total: yesterday.total,
        categories: yesterday.categories,
      },
      thisMonth: {
        total: thisMonth.total,
        categories: thisMonth.categories,
      },
      lastMonth: {
        total: lastMonth.total,
        categories: lastMonth.categories,
      },
    });
  } catch (error: any) {
    console.error("[Twilio Billing API] Error fetching usage records:", error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 }
    );
  }
}
