import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, calculateAppointmentDuration, formatTime12h } from "@/lib/appointmentSlots";
import { saveAppointment, getAppointmentSettings, Appointment } from "@/lib/db";
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
    const settings = await getAppointmentSettings();

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
    const aptId = `apt_web_${Date.now()}_${cleanPhone.slice(-4)}`;

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

    const smsMessage = `The Shatnez Lab: Your appointment is confirmed for ${date} at ${timeLabel} for ${garments} ${garmentWord} (${duration} mins). Location: ${location}. See you soon!`;

    // Send confirmation SMS in background
    sendSms(cleanPhone, smsMessage).catch((smsErr) => {
      console.warn("[Appointment Book API] Failed to send confirmation SMS:", smsErr);
    });

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
