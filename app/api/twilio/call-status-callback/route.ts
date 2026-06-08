import { NextRequest, NextResponse } from "next/server";
import { logCallEvent } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
    } else if (contentType.includes("application/json")) {
      body = await req.json();
    }

    const callSid = body.CallSid || "";
    const callStatus = body.CallStatus || "completed";
    const duration = body.CallDuration || "";
    const phone = body.From || "";

    console.log(`[Twilio Call Status Callback] CallSid: ${callSid}, Status: ${callStatus}, Duration: ${duration}s`);

    if (callSid) {
      let finalStatus: "completed" | "active" | "voicemail" = "completed";
      
      if (
        callStatus === "completed" || 
        callStatus === "busy" || 
        callStatus === "no-answer" || 
        callStatus === "failed" || 
        callStatus === "canceled"
      ) {
        finalStatus = "completed";
      }

      await logCallEvent(
        callSid, 
        phone, 
        `Call ended (${callStatus})`, 
        finalStatus, 
        duration ? `${duration}s` : undefined
      );
    }

    return NextResponse.json({ success: true }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  } catch (error) {
    console.error("[Twilio Call Status Callback] Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({ success: true }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
}
