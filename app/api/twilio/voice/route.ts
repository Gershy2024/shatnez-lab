import { NextRequest, NextResponse } from "next/server";

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    action="${origin}/api/twilio/gather?step=menu"
    method="POST"
    timeout="5"
  >
    <Say voice="Polly.Matthew" language="en-US">
      Welcome to The Shatnez Lab.
      Press 1 to check your order status.
      Press 2 to speak with a representative.
      Press 9 for admin access.
      Or enter your order number followed by pound.
    </Say>
    <Say voice="Polly.Madi" language="he-IL">
      ברוכים הבאים למעבדת השעטנז.
      להקיש אחת לבדיקת סטטוס הזמנה.
      להקיש שתיים לשיחה עם נציג.
      להקיש תשע לגישת מנהל.
      או הקישו את מספר ההזמנה ולאחריו סולמית.
    </Say>
  </Gather>
  <Say voice="Polly.Matthew" language="en-US">We did not receive a response. Goodbye.</Say>
  <Say voice="Polly.Madi" language="he-IL">לא התקבלה קלט. שלום.</Say>
  <Redirect method="POST">${origin}/api/twilio/voice</Redirect>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
