import { NextRequest } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "";

  console.log(`[Audio API] Requested audio file: "${name}"`);

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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("[Audio API] Unexpected error serving audio file:", error);
    return new Response(`Error serving audio file: ${error.message || error}`, { status: 500 });
  }
}
