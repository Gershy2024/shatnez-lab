import { Appointment, AppointmentSettings, getAppointmentsForDate, getAppointmentSettings } from "./db";

export interface AvailableSlot {
  time: string; // "HH:mm" (24-hour format, e.g. "14:30")
  label: string; // "2:30 PM"
  spoken: string; // "two thirty PM"
  duration: number; // minutes
}

// Convert "HH:mm" to minutes from midnight
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

// Convert minutes from midnight to "HH:mm"
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Format "HH:mm" into friendly 12-hour format e.g. "2:30 PM"
export function formatTime12h(timeStr: string): { label: string; spoken: string } {
  const [hourStr, minStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  const minFormatted = min === 0 ? "" : `:${String(min).padStart(2, "0")}`;
  const label = `${hour}${minFormatted} ${ampm}`;

  let spokenMin = "";
  if (min === 0) {
    spokenMin = "o'clock";
  } else if (min < 10) {
    spokenMin = `oh ${min}`;
  } else {
    spokenMin = `${min}`;
  }
  const spoken = `${hour} ${spokenMin} ${ampm}`;

  return { label, spoken };
}

// Get current date string "YYYY-MM-DD" in America/New_York
export function getNyDateString(offsetDays = 0): { dateStr: string; dayOfWeek: number; dateObj: Date } {
  const now = new Date();
  const nyDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  if (offsetDays > 0) {
    nyDate.setDate(nyDate.getDate() + offsetDays);
  }
  const year = nyDate.getFullYear();
  const month = String(nyDate.getMonth() + 1).padStart(2, "0");
  const day = String(nyDate.getDate()).padStart(2, "0");
  return {
    dateStr: `${year}-${month}-${day}`,
    dayOfWeek: nyDate.getDay(),
    dateObj: nyDate
  };
}

/**
 * Calculates available appointment slots for a given date and number of garments.
 */
export async function getAvailableSlots(
  dateStr: string,
  garmentsCount: number,
  customSettings?: AppointmentSettings
): Promise<AvailableSlot[]> {
  const settings = customSettings || (await getAppointmentSettings());
  if (!settings.enabled) return [];

  // Check blackout dates
  if (settings.blackoutDates && settings.blackoutDates.includes(dateStr)) {
    return [];
  }

  // Parse target date to get day of week
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const targetDate = new Date(y, m - 1, d);
  const dayOfWeek = targetDate.getDay(); // 0 = Sun, 6 = Sat

  // Check day overrides or general daysOfWeek
  let startHour = settings.startHour || "10:00";
  let endHour = settings.endHour || "18:00";
  let isClosed = false;

  const override = settings.dayOverrides?.[String(dayOfWeek)];
  if (override) {
    if (override.closed) return [];
    startHour = override.start || startHour;
    endHour = override.end || endHour;
  } else {
    if (!settings.daysOfWeek.includes(dayOfWeek)) {
      return []; // Day not active
    }
  }

  const startMins = timeToMinutes(startHour);
  const endMins = timeToMinutes(endHour);
  if (endMins <= startMins) return [];

  // Calculate required duration: e.g. count * 5 mins, with minDuration
  const count = Math.max(1, Math.min(garmentsCount, settings.maxGarments || 10));
  const minDuration = settings.minDuration || 10;
  const minutesPerGarment = settings.minutesPerGarment || 5;
  const duration = Math.max(count * minutesPerGarment, minDuration);
  const buffer = settings.bufferMinutes || 5;

  // Retrieve existing active appointments for this date
  const existingApts = await getAppointmentsForDate(dateStr);

  // Determine minimum start time if booking for today in America/New_York
  const todayNy = getNyDateString();
  let minAllowedStartMins = startMins;

  if (dateStr === todayNy.dateStr) {
    const nyNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const currentMins = nyNow.getHours() * 60 + nyNow.getMinutes();
    // Must be at least 30 minutes ahead of current time
    minAllowedStartMins = Math.max(startMins, currentMins + 30);
  }

  // Determine candidate slot interval: align to 15-minute intervals
  const interval = 15;
  const availableSlots: AvailableSlot[] = [];

  // Round minAllowedStartMins up to nearest interval
  let candidateStart = Math.ceil(minAllowedStartMins / interval) * interval;

  while (candidateStart + duration <= endMins) {
    const candidateEnd = candidateStart + duration;

    // Check collision with any existing appointment
    const hasConflict = existingApts.some((apt) => {
      const aptStart = timeToMinutes(apt.time);
      const aptEnd = aptStart + (apt.duration || duration);

      // Conflict if time intervals overlap (including buffer)
      // Slot 1: [candidateStart, candidateEnd + buffer]
      // Slot 2: [aptStart, aptEnd + buffer]
      return candidateStart < aptEnd + buffer && candidateEnd + buffer > aptStart;
    });

    if (!hasConflict) {
      const timeFormatted = minutesToTime(candidateStart);
      const { label, spoken } = formatTime12h(timeFormatted);
      availableSlots.push({
        time: timeFormatted,
        label,
        spoken,
        duration
      });
    }

    candidateStart += interval;
  }

  return availableSlots;
}
