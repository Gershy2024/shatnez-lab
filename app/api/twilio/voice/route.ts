import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

export async function POST(req: NextRequest) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    action="${BASE_URL}/api/twilio/gather?step=menu"
    method="POST"
    numDigits="1"
    timeout="5"
  >
    <Say voice="man" language="en-US">
      Welcome to The Shatnez Lab.
      Press 1 to check your order status.
      Press 2 for admin access.
      Or enter your order number followed by pound.
    </Say>
  </Gather>
  <Say voice="man" language="en-US">We did not receive a response. Goodbye.</Say>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
