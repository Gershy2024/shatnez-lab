import { NextRequest, NextResponse } from "next/server";
import { formatTime12h } from "@/lib/appointmentSlots";
import { getAppointmentSettings, getAdminSettings } from "@/lib/db";
import { sendSms } from "@/lib/twilioCall";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      phone,
      customerName,
      date,
      time,
      garmentsCount = 1,
      duration = 5,
      notes,
      source = "admin",
      sendCustomerSms = true,
      sendAdminSms = true
    } = body;

    if (!phone || !date || !time) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (phone, date, time)" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const [settings, adminSettings] = await Promise.all([
      getAppointmentSettings(),
      getAdminSettings()
    ]);

    const { label: timeLabel } = formatTime12h(time);
    const garmentWord = garmentsCount === 1 ? "garment" : "garments";
    const location = settings.locationText || "14 Buchanan Rd, North Square, NY";

    const twilioFrom = (adminSettings.twilioPhoneNumber || "").replace(/\D/g, "");
    const smsPromises: Promise<any>[] = [];
    let customerSent = false;
    let adminSent = false;

    // 1. Send customer confirmation SMS if requested
    if (sendCustomerSms && cleanPhone.length >= 10 && cleanPhone !== twilioFrom) {
      const customerMsg = `The Shatnez Lab: Your appointment is confirmed for ${date} at ${timeLabel} for ${garmentsCount} ${garmentWord} (${duration} mins).\nLocation: ${location}.\nThank you!`;
      smsPromises.push(
        sendSms(cleanPhone, customerMsg)
          .then((res) => {
            if (res.success) customerSent = true;
            console.log(`[Appointment Notify API] Customer SMS to ${cleanPhone} result:`, res);
          })
          .catch((err) => {
            console.error("[Appointment Notify API] Failed to send customer SMS:", err);
          })
      );
    }

    // 2. Send admin alert SMS if requested
    if (sendAdminSms) {
      const candidateAdminPhones = new Set<string>();
      if (settings.adminNotificationPhone) {
        candidateAdminPhones.add(settings.adminNotificationPhone.replace(/\D/g, ""));
      }
      if (adminSettings.forwardingNumber) {
        candidateAdminPhones.add(adminSettings.forwardingNumber.replace(/\D/g, ""));
      }
      candidateAdminPhones.add("8455524744");

      const validAdminPhones = Array.from(candidateAdminPhones).filter(
        (p) => p.length >= 10 && p !== twilioFrom
      );

      const sourceLabel =
        source === "phone"
          ? "Phone Line / קו טלפון"
          : source === "web"
          ? "Website / אתר"
          : "Admin Manual / ידני במערכת";

      const adminSms = `📅 New Appointment Alert!\nDate: ${date} at ${timeLabel}\nGarments: ${garmentsCount} (${duration} mins)\nCustomer: ${customerName ? customerName.trim() : "None"} (${cleanPhone})\nSource: ${sourceLabel}${notes ? `\nNotes: ${notes.trim()}` : ""}`;

      for (const admPhone of validAdminPhones) {
        smsPromises.push(
          sendSms(admPhone, adminSms)
            .then((res) => {
              if (res.success) adminSent = true;
              console.log(`[Appointment Notify API] Admin SMS to ${admPhone} result:`, res);
            })
            .catch((err) => {
              console.error(`[Appointment Notify API] Failed to send admin SMS to ${admPhone}:`, err);
            })
        );
      }
    }

    // Await all SMS dispatches so Vercel does not terminate lambda before sending!
    await Promise.allSettled(smsPromises);

    return NextResponse.json({
      success: true,
      customerSent,
      adminSent
    });
  } catch (error: any) {
    console.error("[Appointment Notify API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send notifications" },
      { status: 500 }
    );
  }
}
