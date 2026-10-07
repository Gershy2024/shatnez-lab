import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, calculateAppointmentDuration, formatTime12h } from "@/lib/appointmentSlots";
import { saveAppointment, getAppointmentSettings, getAdminSettings, Appointment, getNextAppointmentId } from "@/lib/db";
import { sendSms } from "@/lib/twilioCall";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, customerName, date, time, garmentsCount, notes } = body;

    if (!phone || !date || !time) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (phone, date, time)" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid 10-digit phone number" },
        { status: 400 }
      );
    }

    const garments = Math.max(1, Math.min(parseInt(garmentsCount, 10) || 1, 10));
    const [settings, adminSettings] = await Promise.all([
      getAppointmentSettings(),
      getAdminSettings()
    ]);

    if (!settings.enabled) {
      return NextResponse.json(
        { success: false, error: "Online appointment booking is currently disabled." },
        { status: 400 }
      );
    }

    // Verify slot availability in real time
    const availableSlots = await getAvailableSlots(date, garments, settings);
    const isSlotAvailable = availableSlots.some((s) => s.time === time);

    if (!isSlotAvailable) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected time slot is no longer available. Please select another time.",
          availableSlots
        },
        { status: 409 }
      );
    }

    const duration = calculateAppointmentDuration(garments, settings);
    const aptId = await getNextAppointmentId();

    const newApt: Appointment = {
      id: aptId,
      phone: cleanPhone,
      customerName: (customerName || "").trim(),
      date,
      time,
      duration,
      garmentsCount: garments,
      status: "scheduled",
      notes: (notes || "").trim(),
      createdAt: Date.now(),
      source: "web"
    };

    await saveAppointment(newApt);

    // Format friendly time & date for confirmation SMS
    const { label: timeLabel } = formatTime12h(time);
    const garmentWord = garments === 1 ? "garment" : "garments";
    const location = settings.locationText || "14 Buchanan Rd, North Square, NY";

    const smsMessage = `The Shatnez Lab: Your appointment (${aptId}) is confirmed for ${date} at ${timeLabel} for ${garments} ${garmentWord} (${duration} mins).\nLocation: ${location}.\nSee you soon!`;

    const twilioFrom = (adminSettings.twilioPhoneNumber || "").replace(/\D/g, "");
    const smsPromises: Promise<any>[] = [];

    // 1. Send confirmation SMS to customer (awaited so serverless won't drop it)
    if (cleanPhone.length >= 10 && cleanPhone !== twilioFrom) {
      smsPromises.push(
        sendSms(cleanPhone, smsMessage)
          .then((res) => console.log(`[Appointment Book API] Customer SMS to ${cleanPhone} result:`, res))
          .catch((smsErr) => console.error("[Appointment Book API] Failed to send confirmation SMS:", smsErr))
      );
    }

    // 2. Send instant alert SMS to Admin (awaited)
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

    const adminSms = `📅 New Appointment Alert (${aptId} - Website)!\nDate: ${date} at ${timeLabel}\nGarments: ${garments} (${duration} mins)\nCustomer: ${customerName ? customerName.trim() : "None"} (${cleanPhone})${notes ? `\nNotes: ${notes.trim()}` : ""}`;

    for (const admPhone of validAdminPhones) {
      smsPromises.push(
        sendSms(admPhone, adminSms)
          .then((res) => console.log(`[Appointment Book API] Admin SMS to ${admPhone} result:`, res))
          .catch((err) => console.error(`[Appointment Book API] Failed to send admin SMS alert to ${admPhone}:`, err))
      );
    }

    // Await all SMS dispatches so Vercel runtime does not terminate before sending!
    await Promise.allSettled(smsPromises);

    return NextResponse.json({
      success: true,
      appointment: newApt,
      timeLabel,
      location
    });
  } catch (error) {
    console.error("[Appointment Book API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error booking appointment" },
      { status: 500 }
    );
  }
}
