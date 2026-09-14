import { NextRequest } from "next/server";
import { getMediaFile } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";

  if (!id) {
    return new Response("Missing media id parameter", { status: 400 });
  }

  try {
    const record = await getMediaFile(id);

    if (!record || !record.base64) {
      return new Response("Media file not found", { status: 404 });
    }

    const buffer = Buffer.from(record.base64, "base64");
    const contentType = record.contentType || "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(record.filename || id)}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("[Media API] Error serving media file:", error);
    return new Response(`Error serving media file: ${error.message || error}`, { status: 500 });
  }
}
