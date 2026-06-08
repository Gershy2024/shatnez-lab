import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getAdminSettings } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const settings = await getAdminSettings();
    
    if (
      !settings.twilioAccountSid || 
      !settings.twilioApiKey || 
      !settings.twilioApiSecret || 
      !settings.twilioTwimlAppSid
    ) {
      return NextResponse.json(
        { error: "Missing Twilio configurations in settings (Account SID, API Key, API Secret, or TwiML App SID)" },
        { status: 400 }
      );
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Create Access Token
    const token = new AccessToken(
      settings.twilioAccountSid,
      settings.twilioApiKey,
      settings.twilioApiSecret,
      {
        identity: "admin",
        ttl: 3600 // Valid for 1 hour
      }
    );

    // Create Voice Grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: settings.twilioTwimlAppSid,
      incomingAllow: true // Enables receiving incoming calls via WebRTC device if needed
    });

    token.addGrant(voiceGrant);

    return NextResponse.json({ token: token.toJwt() });
  } catch (error: any) {
    console.error("Error generating Twilio voice token:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
