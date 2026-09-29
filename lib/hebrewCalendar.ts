import { HDate, HebrewCalendar, Sedra, Locale } from "@hebcal/core";

export interface HebrewDayInfo {
  hebrewDay: string; // e.g. "י״ט"
  hebrewMonth: string; // e.g. "אלול"
  hebrewYear: string; // e.g. "תשפ״ו"
  hebrewDateShort: string; // e.g. "י״ט אלול"
  hebrewDateFull: string; // e.g. "י״ט אלול תשפ״ו"
  isRoshChodesh: boolean;
  parsha: string | null; // e.g. "נצבים-וילך" or "האזינו"
  holidays: string[]; // e.g. ["ערב ראש השנה"] or ["ראש השנה"]
  primaryHoliday: string | null;
}

// Strip Hebrew vowels/nikud and cantillation marks
function stripNikud(str: string): string {
  if (!str) return "";
  return str.replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, "");
}

// Clean holiday name (remove trailing Gregorian/Hebrew 4-digit years like "5787")
function cleanHolidayName(str: string): string {
  return str.replace(/\s+\d{4}$/, "").trim();
}

/**
 * Returns comprehensive Jewish calendar details for any Gregorian date string "YYYY-MM-DD"
 */
export function getHebrewDayInfo(dateStr: string): HebrewDayInfo {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);

  const dateObj = new Date(year, month, day);
  const hd = new HDate(dateObj);

  // Gematriya rendering
  const gematriyaFull = hd.renderGematriya(true); // "י״ט אלול תשפ״ו"
  const parts = gematriyaFull.split(" ");
  const hebrewDay = parts[0] || "";
  const hebrewMonth = parts.slice(1, -1).join(" ") || "";
  const hebrewYear = parts[parts.length - 1] || "";
  const hebrewDateShort = `${hebrewDay} ${hebrewMonth}`.trim();

  // Sedra / Parsha (Diaspora standard) - lookup Shabbat on or after this date
  const saturday = hd.onOrAfter(6);
  const sedra = new Sedra(saturday.getFullYear(), false);
  let parsha: string | null = null;
  const p = sedra.lookup(saturday);
  if (p && p.parsha && p.parsha.length > 0) {
    parsha = p.parsha.map((name) => stripNikud(Locale.gettext(name, "he"))).join("-");
  }

  // Jewish Holidays & Fasts on this date
  const events = HebrewCalendar.getHolidaysOnDate(hd) || [];
  const rawHolidays = events
    .map((e) => cleanHolidayName(stripNikud(e.render("he"))))
    .filter(Boolean);

  // De-duplicate
  const holidays = Array.from(new Set(rawHolidays));

  // Determine if it's Rosh Chodesh
  const isRoshChodesh = holidays.some((h) => h.includes("ראש חודש")) || hd.getDate() === 1 || hd.getDate() === 30;

  // Primary holiday for display
  const primaryHoliday = holidays.length > 0 ? holidays[0] : null;

  return {
    hebrewDay,
    hebrewMonth,
    hebrewYear,
    hebrewDateShort,
    hebrewDateFull: gematriyaFull,
    isRoshChodesh,
    parsha,
    holidays,
    primaryHoliday
  };
}
