import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const origin = `https://${req.headers.get("host")}`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    action="${origin}/api/twilio/gather?step=menu"
    method="POST"
    timeout="3"
  >
    <Say voice="Polly.Joey" language="en-US">
      Welcome to The Shatnez Lab.
      Press 1 for drop-off information, pricing, and instructions.
      Press 2 to check your order status and test results.
      Press 3 to hear about our special VIP and store services.
      Press 0 to speak with a representative.
      Or, enter your order number followed by pound.
    </Say>
    <Say voice="Polly.Madi" language="he-IL">
      ברוכים הבאים למעבדת השעטנז.
      להקשת אחת לקבלת מידע על מסירת בגדים, מחירים והנחיות.
      להקשת שתיים לבדיקת סטטוס הזמנה ותוצאות הבדיקה.
      להקשת שלוש לשמיעת פרטים על שירותי ה-VIP והחנויות המיוחדים שלנו.
      להקשת אפס לשיחה עם נציג.
      או הקישו את מספר ההזמנה שלכם ולאחריו סולמית.
    </Say>
  </Gather>
  <Say voice="Polly.Joey" language="en-US">We did not receive a response. Returning to main menu.</Say>
  <Say voice="Polly.Madi" language="he-IL">לא התקבל קלט. חוזר לתפריט הראשי.</Say>
  <Redirect method="POST">${origin}/api/twilio/voice</Redirect>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
