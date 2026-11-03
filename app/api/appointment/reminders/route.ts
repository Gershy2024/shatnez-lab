import { NextRequest, NextResponse } from "next/server";
import {
  getAllAppointments,
  getAppointmentSettings,
  getAdminSettings,
  markAppointmentReminderSent,
  Appointment
} from "@/lib/db";
import { formatTime12h, getNyDateString, getMinutesUntilAppointment } from "@/lib/appointmentSlots";
import { sendSms } from "@/lib/twilioCall";

export const dynamic = "force-dynamic";

/**
 * Core processor for checking and dispatching 10-minute appointment SMS reminders.
 */
async function processAppointmentReminders(options: {
  appointmentId?: string;
  force?: boolean;
}) {
  const [settings, adminSettings, allAppointments] = await Promise.all([
    getAppointmentSettings(),
    getAdminSettings(),
    getAllAppointments()
  ]);

  if (!settings.reminderEnabled && !options.force) {
    return {
      success: true,
      enabled: false,
      message: "Appointment SMS reminders are currently disabled in settings.",
      checkedAt: new Date().toISOString(),
      sentCount: 0
    };
  }

  const targetMinutes = settings.reminderMinutesBefore ?? 10;
  const todayStr = getNyDateString(0).dateStr;
  const tomorrowStr = getNyDateString(1).dateStr;

  // 1. Determine candidate appointments
  let candidates: Appointment[] = [];
  if (options.appointmentId) {
    const targetId = options.appointmentId;
    const cleanTargetId = targetId.replace(/^APT[-_]?/i, "");
    const single = allAppointments.find(
      (a) =>
        a.id === targetId ||
        a.id === `APT-${targetId}` ||
        a.id.replace(/^APT[-_]?/i, "") === cleanTargetId
    );
    if (single) candidates = [single];
  } else {
    // Only scheduled appointments for today or tomorrow
    candidates = allAppointments.filter(
      (a) => a.status === "scheduled" && (a.date === todayStr || a.date === tomorrowStr)
    );
  }

  const twilioFrom = (adminSettings.twilioPhoneNumber || "").replace(/\D/g, "");

  // Candidate admin phone numbers
  const candidateAdminPhones = new Set<string>();
  if (settings.adminReminderPhone) {
    candidateAdminPhones.add(settings.adminReminderPhone.replace(/\D/g, ""));
  }
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

  const results: any[] = [];

  for (const apt of candidates) {
    const diffMinutes = getMinutesUntilAppointment(apt.date, apt.time);

    // If not forced: check if within the reminder window (~10 minutes before, with tolerance up to 5 mins past)
    // and check that reminder hasn't already been sent.
    const isWithinWindow =
      options.force ||
      (diffMinutes <= targetMinutes + 2 && diffMinutes >= -5 && !apt.adminReminderSent && !apt.reminderSent);

    if (!isWithinWindow) {
      continue;
    }

    const { label: timeLabel } = formatTime12h(apt.time);
    const garmentWordHe = apt.garmentsCount === 1 ? "בגד 1" : `${apt.garmentsCount} בגדים`;
    const garmentWordEn = apt.garmentsCount === 1 ? "garment" : "garments";
    const durationText = `${apt.duration} דק'`;
    const location = apt.location || settings.locationText || "14 Buchanan Rd, North Square, NY";
    const customerDisplayName = apt.customerName?.trim() || "לקוח ללא שם";
    const cleanCustomerPhone = (apt.phone || "").replace(/\D/g, "");
    const formattedCustomerPhone =
      cleanCustomerPhone.length === 10
        ? `(${cleanCustomerPhone.slice(0, 3)}) ${cleanCustomerPhone.slice(3, 6)}-${cleanCustomerPhone.slice(6)}`
        : cleanCustomerPhone;

    const minsLeft = Math.max(0, Math.round(diffMinutes));
    const timeNoticeHe = minsLeft <= 1 ? "ממש עכשיו (בעוד דקה!)" : `בעוד כ-${minsLeft} דקות`;
    const timeNoticeEn = minsLeft <= 1 ? "in about 1 minute" : `in about ${minsLeft} minutes`;

    // ── Build Admin SMS ──
    const adminSms = `⏰ תזכורת פגישה ${timeNoticeHe} במעבדה!\n📅 תור: ${apt.id}\n🕐 שעה: ${timeLabel} (${apt.date})\n👤 לקוח: ${customerDisplayName}\n📞 טלפון: ${formattedCustomerPhone}\n👔 פריטים: ${garmentWordHe} (${durationText})\n📍 מיקום: ${location}${apt.notes ? `\n📝 הערות: ${apt.notes.trim()}` : ""}`;

    // ── Build Customer SMS ──
    const customerSms = `The Shatnez Lab: Reminder - your appointment (${apt.id}) is ${timeNoticeEn} at ${timeLabel} for ${apt.garmentsCount} ${garmentWordEn} (${apt.duration} mins).\nLocation: ${location}.\nPlease arrive on time. Looking forward to seeing you!`;

    const smsDispatches: Promise<any>[] = [];
    let adminSent = false;
    let customerSent = false;

    // 1. Dispatch SMS to Admin phones
    if (settings.sendAdminReminder !== false) {
      for (const admPhone of validAdminPhones) {
        smsDispatches.push(
          sendSms(admPhone, adminSms)
            .then((res) => {
              if (res.success) adminSent = true;
              console.log(`[Appointment Reminder API] Admin SMS dispatched to ${admPhone} for ${apt.id}:`, res);
            })
            .catch((err) => {
              console.error(`[Appointment Reminder API] Failed admin SMS to ${admPhone} for ${apt.id}:`, err);
            })
        );
      }
    }

    // 2. Dispatch SMS to Customer (if enabled, valid phone, and not already sent)
    const shouldSendCustomer =
      settings.sendCustomerReminder !== false &&
      cleanCustomerPhone.length >= 10 &&
      cleanCustomerPhone !== twilioFrom &&
      !validAdminPhones.includes(cleanCustomerPhone) &&
      (!apt.customerReminderSent || options.force);

    if (shouldSendCustomer) {
      smsDispatches.push(
        sendSms(cleanCustomerPhone, customerSms)
          .then((res) => {
            if (res.success) customerSent = true;
            console.log(`[Appointment Reminder API] Customer SMS dispatched to ${cleanCustomerPhone} for ${apt.id}:`, res);
          })
          .catch((err) => {
            console.error(`[Appointment Reminder API] Failed customer SMS to ${cleanCustomerPhone} for ${apt.id}:`, err);
          })
      );
    }

    // Await SMS dispatches
    await Promise.allSettled(smsDispatches);

    // Mark as sent in database
    await markAppointmentReminderSent(apt.id, {
      adminSent: adminSent || validAdminPhones.length > 0,
      customerSent
    });

    results.push({
      appointmentId: apt.id,
      date: apt.date,
      time: apt.time,
      diffMinutes: Math.round(diffMinutes * 10) / 10,
      customerName: apt.customerName,
      customerPhone: cleanCustomerPhone,
      adminSent,
      customerSent,
      sentAt: new Date().toISOString()
    });
  }

  return {
    success: true,
    enabled: true,
    checkedAt: new Date().toISOString(),
    checkedCount: candidates.length,
    sentCount: results.length,
    reminders: results
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get("appointmentId") || undefined;
    const force = searchParams.get("force") === "true";

    const result = await processAppointmentReminders({ appointmentId, force });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Appointment Reminders GET API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const { searchParams } = new URL(req.url);
    const appointmentId = body.appointmentId || searchParams.get("appointmentId") || undefined;
    const force = body.force === true || searchParams.get("force") === "true";

    const result = await processAppointmentReminders({ appointmentId, force });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Appointment Reminders POST API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
