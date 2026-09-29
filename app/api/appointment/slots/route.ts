import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, getNyDateString, calculateAppointmentDuration } from "@/lib/appointmentSlots";
import { getAppointmentSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || getNyDateString().dateStr;
    const garmentsParam = parseInt(url.searchParams.get("garments") || "1", 10);
    const garments = isNaN(garmentsParam) || garmentsParam < 1 ? 1 : Math.min(garmentsParam, 10);

    const settings = await getAppointmentSettings();
    if (!settings.enabled) {
      return NextResponse.json({
        success: false,
        enabled: false,
        message: "Appointment booking is currently disabled.",
        slots: []
      });
    }

    const duration = calculateAppointmentDuration(garments, settings);
    const slots = await getAvailableSlots(dateParam, garments, settings);

    return NextResponse.json({
      success: true,
      enabled: true,
      date: dateParam,
      garments,
      duration,
      slotsCount: slots.length,
      slots,
      settings: {
        locationText: settings.locationText,
        startHour: settings.startHour,
        endHour: settings.endHour,
        bufferMinutes: settings.bufferMinutes,
        dayOverrides: settings.dayOverrides,
        daysOfWeek: settings.daysOfWeek
      }
    });
  } catch (error) {
    console.error("[Appointment Slots API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch available slots" },
      { status: 500 }
    );
  }
}
