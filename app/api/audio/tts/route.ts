import { NextRequest } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// In-memory cache for ultra-fast response
const audioCache = new Map<string, Buffer>();

async function generateEdgeAudio(text: string, voice = "en-US-GuyNeural"): Promise<Buffer> {
  const cacheKey = `${voice}_${text.trim()}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", () => {
      const buffer = Buffer.concat(chunks);
      // Keep up to 500 items in cache
      if (audioCache.size > 500) {
        const firstKey = audioCache.keys().next().value;
        if (firstKey) audioCache.delete(firstKey);
      }
      audioCache.set(cacheKey, buffer);
      resolve(buffer);
    });
    audioStream.on("error", (err) => reject(err));
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const text = url.searchParams.get("text") || "";
  const voice = url.searchParams.get("voice") || "en-US-GuyNeural";

  if (!text) {
    return new Response("Missing text parameter", { status: 400 });
  }

  try {
    const buffer = await generateEdgeAudio(text, voice);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("[TTS API Error]:", error);
    return new Response(`TTS generation failed: ${error.message || error}`, { status: 500 });
  }
}
