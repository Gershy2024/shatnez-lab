import { NextRequest, NextResponse } from "next/server";
import { getAdminSettings, getAllCalls, updateCallPrice, getAllSmsMessages, updateSmsMessagePrice } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const settings = await getAdminSettings();
    if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
      return NextResponse.json({ success: false, error: "Twilio settings not configured" });
    }

    const allCalls = await getAllCalls();
    const allSms = await getAllSmsMessages();
    
    // 1. Sync voice calls (CA prefix)
    const callsToSync = allCalls.filter(
      (c) => c.status !== "active" && c.id.startsWith("CA") && (!c.price || c.price === "")
    );

    // Limit to 30 calls per batch to prevent API rate limits
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
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          const price = data.price;
          const priceUnit = data.price_unit || "USD";
          
          if (price !== null && price !== undefined) {
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

    // 2. Sync SMS prices using Twilio Messages list (fuzzy matching recent SMS)
    let smsSyncedCount = 0;
    try {
      const twilioMsgUrl = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioAccountSid}/Messages.json?PageSize=100`;
      const resSmsList = await fetch(twilioMsgUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        cache: "no-store",
      });

      if (resSmsList.ok) {
        const dataSms = await resSmsList.json();
        const twMessages = dataSms.messages || [];

        for (const twMsg of twMessages) {
          const twPrice = twMsg.price;
          const twPriceUnit = twMsg.price_unit || "USD";
          
          if (twPrice !== null && twPrice !== undefined) {
            const match = allSms.find((dbMsg) => {
              if (dbMsg.id === twMsg.sid) return true;
              
              if (!dbMsg.id.startsWith("SM")) {
                const cleanPhone = (p: string) => p.replace(/\D/g, "");
                const dbP = cleanPhone(dbMsg.phone);
                const twFrom = cleanPhone(twMsg.from || "");
                const twTo = cleanPhone(twMsg.to || "");
                
                const isPhoneMatch = dbMsg.direction === "inbound"
                  ? (twFrom.endsWith(dbP) || dbP.endsWith(twFrom))
                  : (twTo.endsWith(dbP) || dbP.endsWith(twTo));
                  
                if (!isPhoneMatch) return false;
                
                const isDirectionMatch = dbMsg.direction === "inbound"
                  ? twMsg.direction === "inbound"
                  : twMsg.direction.startsWith("outbound");
                  
                if (!isDirectionMatch) return false;
                
                const timeDiff = Math.abs(dbMsg.timestamp - new Date(twMsg.date_sent).getTime());
                if (timeDiff >= 180 * 1000) return false; // 3 minutes limit
                
                const dbBody = dbMsg.body.trim().toLowerCase();
                const twBody = (twMsg.body || "").trim().toLowerCase();
                return dbBody === twBody || dbBody.includes(twBody) || twBody.includes(dbBody);
              }
              return false;
            });

            if (match) {
              await updateSmsMessagePrice(match.id, String(twPrice), twPriceUnit, twMsg.sid);
              match.price = String(twPrice);
              match.priceUnit = twPriceUnit;
              match.id = twMsg.sid;
              smsSyncedCount++;
            }
          }
        }
      }
    } catch (smsErr) {
      console.error("[Sync Prices] Error syncing recent SMS from Twilio list:", smsErr);
    }

    // 3. Direct lookup for older SMS that have MessageSids (start with SM) but no price
    const smsToSyncDirect = allSms.filter(
      (m) => m.id.startsWith("SM") && (!m.price || m.price === "")
    );
    for (const msg of smsToSyncDirect.slice(0, 30)) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioAccountSid}/Messages/${msg.id}.json`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Basic ${auth}`,
          },
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          const price = data.price;
          const priceUnit = data.price_unit || "USD";
          if (price !== null && price !== undefined) {
            await updateSmsMessagePrice(msg.id, String(price), priceUnit);
            msg.price = String(price);
            msg.priceUnit = priceUnit;
            smsSyncedCount++;
          }
        }
      } catch (err) {
        console.error(`[Sync Prices] Error syncing direct SMS ${msg.id}:`, err);
      }
    }

    // 4. Fill in fallbacks in-memory for remaining unmatched SMS logs (standard rate of $0.0079)
    // We do NOT write this back to Firestore to avoid massive write bursts/delays, but it handles the total cost calculation perfectly.
    for (const msg of allSms) {
      if (!msg.price || msg.price === "") {
        msg.price = "-0.0079";
        msg.priceUnit = "USD";
      }
    }

    // 5. Update aggregated SMS call records in calls table
    const smsCallLogs = allCalls.filter((c) => c.id.includes("_sms_"));
    let updatedCallRecordsCount = 0;
    
    for (const c of smsCallLogs) {
      const phone = c.phone.replace(/\D/g, "");
      const start = c.timestamp;
      const end = start + 24 * 60 * 60 * 1000;
      
      const matchingSms = allSms.filter((m) => {
        const mPhone = m.phone.replace(/\D/g, "");
        return mPhone === phone && m.timestamp >= start && m.timestamp < end;
      });

      let totalSmsCost = 0;
      let unit = "USD";
      for (const sms of matchingSms) {
        if (sms.price) {
          totalSmsCost += Math.abs(parseFloat(sms.price));
          if (sms.priceUnit) unit = sms.priceUnit;
        }
      }

      const finalPriceStr = totalSmsCost > 0 ? `-${totalSmsCost.toFixed(4)}` : "0.0000";
      if (c.price !== finalPriceStr || c.priceUnit !== unit) {
        await updateCallPrice(c.id, finalPriceStr, unit);
        updatedCallRecordsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      syncedCalls: syncedCount,
      syncedSms: smsSyncedCount,
      updatedSmsCallLogs: updatedCallRecordsCount,
      totalPendingCalls: callsToSync.length,
    });
  } catch (error: any) {
    console.error("[Sync Prices] General error:", error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
