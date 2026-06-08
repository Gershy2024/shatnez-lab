import { NextRequest } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "";
  const externalUrl = url.searchParams.get("url") || "";

  console.log(`[Audio API] Requested audio file: name="${name}", url="${externalUrl}"`);

  // Log call start asynchronously if Twilio passed CallSid and phone number in query parameters
  const callSid = url.searchParams.get("CallSid") || url.searchParams.get("callSid") || "";
  const phone = url.searchParams.get("From") || url.searchParams.get("phone") || url.searchParams.get("FromPhoneNumber") || "";
  if (callSid) {
    import("@/lib/db").then(({ logCallEvent }) => {
      logCallEvent(callSid, phone, "Welcome Menu", "active").catch((err) =>
        console.error("[Audio API] Failed to log call start:", err)
      );
    }).catch((err) => {
      console.error("[Audio API] Failed to import logCallEvent:", err);
    });
  }

  if (externalUrl) {
    try {
      const { getAdminSettings } = await import("@/lib/db");
      const settings = await getAdminSettings();
      const sid = settings.twilioAccountSid || "";
      const token = settings.twilioAuthToken || "";

      if (!sid || !token) {
        console.error("[Audio API] Twilio credentials are not configured in Admin Settings.");
        return new Response("Twilio credentials not configured", { status: 401 });
      }

      const authHeader = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
      const response = await fetch(externalUrl, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        console.error(`[Audio API] Twilio request failed: ${response.status} ${response.statusText}`);
        return new Response(`Failed to fetch from Twilio: ${response.statusText}`, { status: response.status });
      }

      const contentType = response.headers.get("content-type") || "audio/mpeg";
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error: any) {
      console.error("[Audio API] Error proxying Twilio recording:", error);
      return new Response(`Error proxying recording: ${error.message || error}`, { status: 500 });
    }
  }

  if (!name) {
    return new Response("Missing audio file name", { status: 400 });
  }

  if (!db) {
    console.error("[Audio API] Database is not initialized or configured.");
    return new Response("Database not configured", { status: 500 });
  }

  try {
    const docId = `audio_${name.toLowerCase().trim()}`;
    console.log(`[Audio API] Fetching document "settings/${docId}" from Firestore`);
    
    const docRef = doc(db, "settings", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.warn(`[Audio API] Document "settings/${docId}" does not exist in Firestore.`);
      return new Response("Audio file not found", { status: 404 });
    }

    const data = docSnap.data();
    const base64Data = data.base64;
    
    if (!base64Data) {
      console.error(`[Audio API] Document "settings/${docId}" exists but contains no base64 audio data.`);
      return new Response("Audio file data is empty", { status: 500 });
    }

    console.log(`[Audio API] Successfully retrieved Base64 data (length: ${base64Data.length}). Decoding to binary...`);
    const buffer = Buffer.from(base64Data, "base64");

    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("[Audio API] Unexpected error serving audio file:", error);
    return new Response(`Error serving audio file: ${error.message || error}`, { status: 500 });
  }
}
