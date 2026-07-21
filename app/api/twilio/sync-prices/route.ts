import { NextRequest, NextResponse } from "next/server";
import { getAdminSettings, getAllCalls, updateCallPrice } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const settings = await getAdminSettings();
    if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
      return NextResponse.json({ success: false, error: "Twilio settings not configured" });
    }

    const allCalls = await getAllCalls();
    
    // Find calls that are completed (not active), have a Twilio SID (start with CA), and don't have a price yet
    const callsToSync = allCalls.filter(
      (c) => c.status !== "active" && c.id.startsWith("CA") && (!c.price || c.price === "")
    );

    // Limit to 30 calls per batch to prevent API rate limits / route timeouts
    const batch = callsToSync.slice(0, 30);
    let syncedCount = 0;

    const auth = Buffer.from(`${settings.twilioAccountSid}:${settings.twilioAuthToken}`).toString("base64");

    for (const call of batch) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioAccountSid}/Calls/${call.id}.json`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Basic ${auth}`,
          },
          cache: "no-store", // Prevent Next.js from caching Twilio REST API responses
        });

        if (res.ok) {
          const data = await res.json();
          const price = data.price;
          const priceUnit = data.price_unit || "USD";
          
          if (price !== null && price !== undefined) {
            // Update the call price, unit, and sync duration if it's different
            const twilioDuration = data.duration ? `${data.duration}s` : undefined;
            await updateCallPrice(call.id, String(price), priceUnit, twilioDuration);
            syncedCount++;
          }
        } else {
          console.error(`[Sync Prices] Failed to fetch call ${call.id} from Twilio: ${res.status}`);
        }
      } catch (err) {
        console.error(`[Sync Prices] Error syncing call ${call.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, synced: syncedCount, totalPending: callsToSync.length });
  } catch (error: any) {
    console.error("[Sync Prices] General error:", error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
