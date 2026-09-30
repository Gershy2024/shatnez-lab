"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Clock,
  Shirt,
  User,
  Phone,
  FileText,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ExternalLink,
  Navigation,
  Plus,
  Minus,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Check,
  Info,
  Award,
  Layers
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { calculateAppointmentDuration, AvailableSlot, formatTime12h } from "@/lib/appointmentSlots";
import { getHebrewDayInfo } from "@/lib/hebrewCalendar";

interface DayOption {
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  dayNameEn: string;
  dayNameHe: string;
  displayDate: string; // "Sep 30"
  hebrewDateShort: string; // "י״ט אלול"
  hebrewDateFull: string;
  parsha: string | null;
  holidays: string[];
  primaryHoliday: string | null;
  isToday: boolean;
  isTomorrow: boolean;
}

type TimePeriodFilter = "all" | "morning" | "afternoon" | "evening";

export default function AppointmentBookingPage() {
  const { isRtl, language } = useLanguage();

  // Booking Form State
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [garmentsCount, setGarmentsCount] = useState<number>(1);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Slots Loading State
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimePeriodFilter>("all");
  const [weekTab, setWeekTab] = useState<0 | 1>(0); // 0 = first 7 days, 1 = next 7 days

  // Settings
  const [labAddress, setLabAddress] = useState<string>("14 Buchanan Rd, North Square, NY");
  const [systemEnabled, setSystemEnabled] = useState<boolean>(true);
  const [dayOverrides, setDayOverrides] = useState<Record<string, any>>({});
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [dateOverrides, setDateOverrides] = useState<Record<string, any>>({});

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedDetails, setConfirmedDetails] = useState<any>(null);

  // Generate 14-day upcoming list
  const upcomingDays = useMemo<DayOption[]>(() => {
    const list: DayOption[] = [];
    const now = new Date();
    // America/New_York date
    const nyNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

    const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayNamesHe = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 14; i++) {
      const d = new Date(nyNow);
      d.setDate(d.getDate() + i);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dateNum = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dateNum}`;
      const dayOfWeek = d.getDay();
      const h = getHebrewDayInfo(dateStr);

      list.push({
        dateStr,
        dayOfWeek,
        dayNameEn: dayNamesEn[dayOfWeek],
        dayNameHe: dayNamesHe[dayOfWeek],
        displayDate: `${monthNamesEn[d.getMonth()]} ${d.getDate()}`,
        hebrewDateShort: h.hebrewDateShort,
        hebrewDateFull: h.hebrewDateFull,
        parsha: h.parsha,
        holidays: h.holidays,
        primaryHoliday: h.primaryHoliday,
        isToday: i === 0,
        isTomorrow: i === 1
      });
    }
    return list;
  }, []);

  // Split into Week 1 (0-6) and Week 2 (7-13)
  const displayedDays = useMemo(() => {
    return weekTab === 0 ? upcomingDays.slice(0, 7) : upcomingDays.slice(7, 14);
  }, [upcomingDays, weekTab]);

  // Set default date to first open day
  useEffect(() => {
    if (upcomingDays.length > 0 && !selectedDate) {
      const firstValid = upcomingDays.find((d) => d.dayOfWeek !== 6);
      if (firstValid) {
        setSelectedDate(firstValid.dateStr);
      }
    }
  }, [upcomingDays, selectedDate]);

  // If user selected date in week 2, make sure tab is on week 2
  useEffect(() => {
    if (selectedDate && upcomingDays.length > 7) {
      const idx = upcomingDays.findIndex((d) => d.dateStr === selectedDate);
      if (idx >= 7 && weekTab !== 1) {
        setWeekTab(1);
      } else if (idx >= 0 && idx < 7 && weekTab !== 0) {
        setWeekTab(0);
      }
    }
  }, [selectedDate, upcomingDays, weekTab]);

  // Fetch available slots when selectedDate or garmentsCount changes
  useEffect(() => {
    if (!selectedDate) return;

    let isMounted = true;
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedTime("");

    fetch(`/api/appointment/slots?date=${selectedDate}&garments=${garmentsCount}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success) {
          setAvailableSlots(data.slots || []);
          if (data.settings?.locationText) setLabAddress(data.settings.locationText);
          if (data.settings?.dayOverrides) setDayOverrides(data.settings.dayOverrides);
          if (data.settings?.daysOfWeek) setDaysOfWeek(data.settings.daysOfWeek);
          if (data.settings?.blackoutDates) setBlackoutDates(data.settings.blackoutDates);
          if (data.settings?.dateOverrides) setDateOverrides(data.settings.dateOverrides);
          setSystemEnabled(data.enabled !== false);
        } else {
          setSlotsError(data.message || "Failed to load slots");
          setAvailableSlots([]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to fetch slots:", err);
        setSlotsError("Could not connect to appointment service.");
        setAvailableSlots([]);
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDate, garmentsCount]);

  // Calculate current duration
  const currentDuration = useMemo(() => {
    return calculateAppointmentDuration(garmentsCount);
  }, [garmentsCount]);

  // Categorize slots by time of day
  const categorizedSlots = useMemo(() => {
    const morning: AvailableSlot[] = [];
    const afternoon: AvailableSlot[] = [];
    const evening: AvailableSlot[] = [];

    availableSlots.forEach((slot) => {
      const hour = parseInt(slot.time.split(":")[0], 10);
      if (hour < 12) {
        morning.push(slot);
      } else if (hour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });

    return { morning, afternoon, evening };
  }, [availableSlots]);

  // Filtered slots for view
  const displayedSlots = useMemo(() => {
    if (timeFilter === "morning") return categorizedSlots.morning;
    if (timeFilter === "afternoon") return categorizedSlots.afternoon;
    if (timeFilter === "evening") return categorizedSlots.evening;
    return availableSlots;
  }, [availableSlots, categorizedSlots, timeFilter]);

  // Selected Day Details for summary
  const selectedDayOption = useMemo(() => {
    return upcomingDays.find((d) => d.dateStr === selectedDate) || null;
  }, [upcomingDays, selectedDate]);

  // Check Day Status (Open / Closed / Holiday)
  const getDayStatus = (day: DayOption) => {
    // 1. Date exception override (Holiday / special closure / custom hours)
    const override = dateOverrides[day.dateStr];
    if (override) {
      if (override.closed) {
        return {
          isOpen: false,
          label: override.label || (isRtl ? "סגור" : "Closed"),
          isHoliday: true
        };
      }
      return {
        isOpen: true,
        label: override.label || null,
        isHoliday: false
      };
    }

    // 2. Blackout dates array
    if (blackoutDates.includes(day.dateStr)) {
      return {
        isOpen: false,
        label: isRtl ? "סגור" : "Closed",
        isHoliday: true
      };
    }

    // 3. Day of week override
    const dowOverride = dayOverrides[String(day.dayOfWeek)];
    if (dowOverride) {
      return {
        isOpen: !dowOverride.closed,
        label: !dowOverride.closed ? null : (isRtl ? "סגור" : "Closed"),
        isHoliday: false
      };
    }

    // 4. Default weekly schedule
    const isOpen = daysOfWeek.includes(day.dayOfWeek) && day.dayOfWeek !== 6;
    return {
      isOpen,
      label: isOpen ? null : day.dayOfWeek === 6 ? (isRtl ? "שבת קודש" : "Shabbos") : (isRtl ? "סגור" : "Closed"),
      isHoliday: false
    };
  };

  // Handle Form Submission
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedDate || !selectedTime) {
      setSubmitError(isRtl ? "אנא בחר תאריך ושעה לפגישה" : "Please select an appointment date and time.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setSubmitError(
        isRtl
          ? "אנא הזן מספר טלפון תקין בן 10 ספרות לקבלת SMS"
          : "Please enter a valid 10-digit phone number so we can text your confirmation."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/appointment/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          customerName,
          date: selectedDate,
          time: selectedTime,
          garmentsCount,
          notes
        })
      });

      const data = await res.json();
      if (data.success) {
        setConfirmedDetails({
          ...data.appointment,
          timeLabel: data.timeLabel || formatTime12h(selectedTime).label,
          location: data.location || labAddress,
          dateOption: selectedDayOption
        });
        setSubmitSuccess(true);
      } else {
        setSubmitError(data.error || "Booking failed. Please try a different slot.");
        if (data.availableSlots) {
          setAvailableSlots(data.availableSlots);
        }
      }
    } catch (err) {
      console.error("Booking submission failed:", err);
      setSubmitError("Failed to book appointment. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Google Calendar URL generator
  const getGoogleCalendarUrl = () => {
    if (!confirmedDetails) return "#";
    const dateClean = confirmedDetails.date.replace(/-/g, "");
    const [h, m] = (confirmedDetails.time || "12:00").split(":");
    const startHour = String(h).padStart(2, "0");
    const startMin = String(m).padStart(2, "0");
    const duration = confirmedDetails.duration || 10;

    const startDateTime = new Date(`${confirmedDetails.date}T${startHour}:${startMin}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const formatCalDate = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    };

    const dates = `${formatCalDate(startDateTime)}/${formatCalDate(endDateTime)}`;
    const title = encodeURIComponent(isRtl ? "בדיקת שעטנז במעבדה" : "Shatnez Lab Appointment");
    const details = encodeURIComponent(
      isRtl
        ? `פגישת בדיקת שעטנז עבור ${confirmedDetails.garmentsCount} בגדים.\nכתובת המעבדה: ${confirmedDetails.location}`
        : `Shatnez testing appointment for ${confirmedDetails.garmentsCount} garments.\nLocation: ${confirmedDetails.location}`
    );
    const loc = encodeURIComponent(confirmedDetails.location || labAddress);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${loc}`;
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(labAddress)}`;

  return (
    <div className={`min-h-screen bg-[#fafaf9] py-10 px-4 sm:px-6 lg:px-8 ${isRtl ? "rtl" : "ltr"}`}>
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Luxury Hero Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-navy-900 text-gold-300 text-xs font-semibold tracking-wider mb-4 shadow-sm border border-navy-800">
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span className="uppercase">{isRtl ? "תיאום הגעה אישי למעבדה" : "Self-Service Lab Appointments"}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-navy-900 tracking-tight">
            {isRtl ? "שריון תור לבדיקת שעטנז" : "Schedule Your Lab Visit"}
          </h1>

          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            {isRtl
              ? "בחרו את המועד המתאים לכם, ציינו את כמות הבגדים, וקבלו שריון שעה מדויק ללא המתנה ואישור מיידי ב-SMS."
              : "Select your preferred date, indicate the number of garments, and instantly reserve your dedicated spot with SMS confirmation."}
          </p>

          {/* Trust Highlights Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-200/80">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-slate-200/70 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-left rtl:text-right">
                <p className="text-xs font-bold text-navy-900 leading-tight">
                  {isRtl ? "בדיקה מוסמכת" : "Certified Lab"}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {isRtl ? "מיקרוסקופ וכימיה" : "Optical & Chemical"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-slate-200/70 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-left rtl:text-right">
                <p className="text-xs font-bold text-navy-900 leading-tight">
                  {isRtl ? "ללא המתנה" : "Zero Wait Time"}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {isRtl ? "תור משוריין אישית" : "Dedicated Time Slot"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-slate-200/70 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="text-left rtl:text-right">
                <p className="text-xs font-bold text-navy-900 leading-tight">
                  {isRtl ? "אישור ב-SMS" : "SMS Alerts"}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {isRtl ? "תזכורת מיידית" : "Instant Confirmation"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-slate-200/70 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-left rtl:text-right">
                <p className="text-xs font-bold text-navy-900 leading-tight">
                  {isRtl ? "מיקום נוח" : "Prime Location"}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  North Square, NY
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Success View */}
        <AnimatePresence>
          {submitSuccess && confirmedDetails && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-emerald-100 max-w-2xl mx-auto text-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900">
                  {isRtl ? "הפגישה שוריינה בהצלחה!" : "Your Appointment is Confirmed!"}
                </h2>
                <p className="text-sm text-slate-600 mt-2">
                  {isRtl
                    ? `הודעת SMS עם כל הפרטים נשלחה כעת למספר ${confirmedDetails.phone}. נשמח לראותכם!`
                    : `A confirmation text message has been sent to ${confirmedDetails.phone}. We look forward to seeing you!`}
                </p>
              </div>

              {/* Confirmation Details Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 text-left rtl:text-right space-y-3.5 text-sm shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">{isRtl ? "תאריך ושעה" : "Date & Time"}</span>
                  <strong className="text-navy-900 text-base font-bold">
                    {confirmedDetails.date} @ {confirmedDetails.timeLabel}
                  </strong>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">{isRtl ? "כמות בגדים ומשך" : "Garments & Duration"}</span>
                  <strong className="text-navy-900">
                    {confirmedDetails.garmentsCount} {confirmedDetails.garmentsCount === 1 ? "garment" : "garments"}{" "}
                    ({confirmedDetails.duration} mins)
                  </strong>
                </div>

                {confirmedDetails.customerName && (
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">{isRtl ? "שם הלקוח" : "Customer"}</span>
                    <strong className="text-navy-900">{confirmedDetails.customerName}</strong>
                  </div>
                )}

                <div className="flex items-start justify-between pt-1">
                  <span className="text-slate-500 font-medium">{isRtl ? "כתובת המעבדה" : "Lab Address"}</span>
                  <div className="text-right rtl:text-left">
                    <span className="text-navy-900 font-bold block">{confirmedDetails.location || labAddress}</span>
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold mt-0.5"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>{isRtl ? "נווט עם Google Maps" : "Open in Google Maps"}</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-navy-900 hover:bg-navy-800 text-white transition-all shadow-md inline-flex items-center justify-center gap-2"
                >
                  <CalendarIcon className="w-4 h-4 text-gold-300" />
                  <span>{isRtl ? "הוסף ליומן Google" : "Add to Google Calendar"}</span>
                </a>

                <button
                  onClick={() => {
                    setSubmitSuccess(false);
                    setSelectedTime("");
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-navy-800 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
                >
                  {isRtl ? "קבע פגישה נוספת" : "Book Another"}
                </button>

                <Link
                  href="/"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-slate-600 hover:text-navy-900 transition-colors"
                >
                  {isRtl ? "חזרה לדף הבית" : "Return to Home"}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2-Column Luxury Booking Flow */}
        {!submitSuccess && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left / Main Column: The Interactive Stepper Form */}
            <div className="lg:col-span-8 space-y-6">
              <form onSubmit={handleSubmitBooking} className="space-y-6">
                {/* STEP 1: DATE SELECTION */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-navy-900 text-gold-300 flex items-center justify-center font-extrabold text-sm shadow-xs">
                        1
                      </div>
                      <div>
                        <h2 className="font-extrabold text-navy-900 text-lg">
                          {isRtl ? "בחר תאריך להגעה" : "Select Date"}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {isRtl ? "זמנים מעודכנים בחיבור חי ליומן המעבדה" : "Live laboratory availability schedule"}
                        </p>
                      </div>
                    </div>

                    {/* Week 1 / Week 2 Segmented Control */}
                    <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setWeekTab(0)}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          weekTab === 0
                            ? "bg-white text-navy-900 shadow-xs"
                            : "text-slate-500 hover:text-navy-900"
                        }`}
                      >
                        {isRtl ? "7 ימים קרובים" : "Upcoming 7 Days"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeekTab(1)}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          weekTab === 1
                            ? "bg-white text-navy-900 shadow-xs"
                            : "text-slate-500 hover:text-navy-900"
                        }`}
                      >
                        {isRtl ? "שבוע הבא" : "Next Week"}
                      </button>
                    </div>
                  </div>

                  {/* Day Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                    {displayedDays.map((day) => {
                      const status = getDayStatus(day);
                      const isOpen = status.isOpen;
                      const isSelected = selectedDate === day.dateStr;

                      return (
                        <button
                          key={day.dateStr}
                          type="button"
                          disabled={!isOpen}
                          onClick={() => setSelectedDate(day.dateStr)}
                          className={`p-3 min-h-[110px] rounded-2xl flex flex-col items-center justify-between transition-all border text-center relative group ${
                            isSelected
                              ? "bg-navy-900 text-white border-navy-900 shadow-md ring-2 ring-navy-900/20 scale-[1.02]"
                              : isOpen
                              ? "bg-white text-navy-900 border-slate-200 hover:border-slate-400 hover:shadow-sm hover:bg-slate-50/70"
                              : "bg-slate-50/80 text-slate-400 border-slate-200/60 cursor-not-allowed opacity-65"
                          }`}
                        >
                          {/* Relative Today / Tomorrow indicator */}
                          <div className="h-4 flex items-center justify-center">
                            {day.isToday && (
                              <span
                                className={`text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? "bg-gold-500 text-navy-900 font-black"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {isRtl ? "היום" : "Today"}
                              </span>
                            )}
                            {day.isTomorrow && (
                              <span
                                className={`text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {isRtl ? "מחר" : "Tomorrow"}
                              </span>
                            )}
                          </div>

                          {/* Day & Date */}
                          <div className="my-1">
                            <span className="text-xs font-bold block uppercase tracking-wide opacity-80">
                              {isRtl ? day.dayNameHe : day.dayNameEn}
                            </span>
                            <span className="text-sm font-extrabold tracking-tight mt-0.5 block">
                              {day.displayDate}
                            </span>
                            <span
                              className={`text-[11px] font-bold font-serif block mt-0.5 ${
                                isSelected ? "text-gold-300" : "text-slate-600"
                              }`}
                            >
                              {day.hebrewDateShort}
                            </span>
                          </div>

                          {/* Holiday / Parsha / Closed status badge - NO TRUNCATION */}
                          <div className="w-full flex items-center justify-center min-h-[18px]">
                            {day.dayOfWeek === 6 && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                                  isSelected ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-700"
                                }`}
                              >
                                {day.parsha ? `פרשת ${day.parsha}` : isRtl ? "שבת" : "Shabbos"}
                              </span>
                            )}

                            {day.dayOfWeek !== 6 && !isOpen && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none bg-rose-50 text-rose-600 border border-rose-100"
                                title={status.label || undefined}
                              >
                                {status.label || (isRtl ? "סגור" : "Closed")}
                              </span>
                            )}

                            {day.dayOfWeek !== 6 && isOpen && status.label && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                                  isSelected
                                    ? "bg-gold-500/20 text-gold-300"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                                title={status.label}
                              >
                                {status.label}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 2: NUMBER OF GARMENTS */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-navy-900 text-gold-300 flex items-center justify-center font-extrabold text-sm shadow-xs">
                        2
                      </div>
                      <div>
                        <h2 className="font-extrabold text-navy-900 text-lg">
                          {isRtl ? "כמות בגדים לבדיקה" : "Number of Garments"}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {isRtl ? "חישוב זמן אוטומטי בהתאם למספר הפריטים" : "Inspection time is adjusted dynamically"}
                        </p>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 text-amber-900 rounded-xl text-xs font-bold border border-amber-200 self-start sm:self-auto shadow-2xs">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        {isRtl ? `משך משוער: ${currentDuration} דקות` : `Estimated duration: ${currentDuration} mins`}
                      </span>
                    </div>
                  </div>

                  {/* Garment Selector: Stepper + Pills */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200 shadow-inner">
                        <button
                          type="button"
                          onClick={() => setGarmentsCount((prev) => Math.max(1, prev - 1))}
                          disabled={garmentsCount <= 1}
                          className="w-10 h-10 rounded-xl bg-white text-navy-900 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-all"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <div className="w-14 text-center">
                          <span className="text-xl font-black text-navy-900">{garmentsCount}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setGarmentsCount((prev) => Math.min(20, prev + 1))}
                          disabled={garmentsCount >= 20}
                          className="w-10 h-10 rounded-xl bg-white text-navy-900 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quick preset chips */}
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => {
                          const isSelected = garmentsCount === num;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setGarmentsCount(num)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                                isSelected
                                  ? "bg-navy-900 text-white border-navy-900 shadow-xs ring-2 ring-navy-900/10"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              {num} {num === 1 ? (isRtl ? "בגד" : "item") : isRtl ? "בגדים" : "items"}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      <Info className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        {isRtl
                          ? "בגד 1 = 5 דק' • 2-3 בגדים = 10 דק' • 4 ומעלה = תוספת 5 דק' לכל פריט נוסף."
                          : "1 garment = 5 mins • 2-3 garments = 10 mins • 4+ garments = 15+ mins."}
                      </span>
                    </div>
                  </div>
                </div>

                {/* STEP 3: AVAILABLE TIME SLOTS */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-navy-900 text-gold-300 flex items-center justify-center font-extrabold text-sm shadow-xs">
                        3
                      </div>
                      <div>
                        <h2 className="font-extrabold text-navy-900 text-lg">
                          {isRtl ? "בחר שעה פנויה" : "Select Available Time"}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {isRtl
                            ? selectedDate
                              ? `שעות פנויות לתאריך ${selectedDate}`
                              : "בחר תאריך תחילה"
                            : selectedDate
                            ? `Available openings for ${selectedDate}`
                            : "Choose a date above"}
                        </p>
                      </div>
                    </div>

                    {/* Available count badge */}
                    {availableSlots.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 self-start sm:self-auto">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {availableSlots.length} {isRtl ? "שעות פנויות כעת" : "slots available"}
                      </span>
                    )}
                  </div>

                  {/* Time of Day Filter Tabs */}
                  {availableSlots.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => setTimeFilter("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          timeFilter === "all"
                            ? "bg-navy-900 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {isRtl ? "כל השעות" : "All Slots"} ({availableSlots.length})
                      </button>

                      {categorizedSlots.morning.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTimeFilter("morning")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            timeFilter === "morning"
                              ? "bg-navy-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <Sunrise className="w-3.5 h-3.5 text-amber-500" />
                          <span>{isRtl ? "בוקר" : "Morning"}</span>
                          <span className="text-[11px] opacity-80">({categorizedSlots.morning.length})</span>
                        </button>
                      )}

                      {categorizedSlots.afternoon.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTimeFilter("afternoon")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            timeFilter === "afternoon"
                              ? "bg-navy-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5 text-amber-600" />
                          <span>{isRtl ? "צהריים" : "Afternoon"}</span>
                          <span className="text-[11px] opacity-80">({categorizedSlots.afternoon.length})</span>
                        </button>
                      )}

                      {categorizedSlots.evening.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTimeFilter("evening")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            timeFilter === "evening"
                              ? "bg-navy-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{isRtl ? "ערב" : "Evening"}</span>
                          <span className="text-[11px] opacity-80">({categorizedSlots.evening.length})</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Slots Content Area */}
                  {loadingSlots ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <div className="w-8 h-8 border-3 border-navy-900 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold tracking-wide">
                        {isRtl ? "בודק זמינות שעות מול יומן המעבדה..." : "Retrieving available lab times..."}
                      </span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-center text-amber-900 space-y-2">
                      <AlertCircle className="w-8 h-8 mx-auto text-amber-600" />
                      <p className="font-extrabold text-base">
                        {isRtl ? "אין שעות פנויות ביום זה" : "No Available Slots on This Date"}
                      </p>
                      <p className="text-xs text-amber-800/90 max-w-md mx-auto">
                        {isRtl
                          ? "המעבדה סגורה במועד זה או שכל התורים כבר נתפסו. אנא בחרו יום אחר בלוח השנה שלמעלה."
                          : "All spots are either booked or the lab is closed on this date. Please choose another date above."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {displayedSlots.map((slot) => {
                        const isSelected = selectedTime === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => setSelectedTime(slot.time)}
                            className={`py-3 px-3.5 rounded-2xl border transition-all flex items-center justify-between group ${
                              isSelected
                                ? "bg-navy-900 text-white border-navy-900 shadow-md ring-2 ring-navy-900/20 scale-[1.02]"
                                : "bg-white text-navy-900 border-slate-200 hover:border-slate-400 hover:shadow-xs hover:bg-slate-50"
                            }`}
                          >
                            <div className="text-left rtl:text-right">
                              <span className="text-sm font-extrabold block leading-tight">{slot.label}</span>
                              <span
                                className={`text-[10px] font-semibold block mt-0.5 ${
                                  isSelected ? "text-gold-300" : "text-slate-400"
                                }`}
                              >
                                {slot.duration} {isRtl ? "דקות" : "mins"}
                              </span>
                            </div>

                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                isSelected
                                  ? "bg-gold-500 text-navy-900"
                                  : "bg-slate-100 text-transparent group-hover:text-slate-400"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* STEP 4: CONTACT & NOTES */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-navy-900 text-gold-300 flex items-center justify-center font-extrabold text-sm shadow-xs">
                      4
                    </div>
                    <div>
                      <h2 className="font-extrabold text-navy-900 text-lg">
                        {isRtl ? "פרטי יצירת קשר ואישור" : "Your Details & Confirmation"}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isRtl ? "למשלוח אישור מיידי ותזכורת ב-SMS" : "For your automated SMS confirmation & reminders"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-navy-900 mb-1.5">
                        {isRtl ? "מספר טלפון לקבלת SMS *" : "Cell Phone Number (For SMS) *"}
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 rtl:left-auto rtl:right-3.5" />
                        <input
                          type="tel"
                          required
                          placeholder="845-552-4744"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-navy-900 focus:border-navy-900 focus:outline-none transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {isRtl ? "יישלח SMS מיידי בלבד – ללא פרסומות." : "Instant SMS confirmation only. No marketing."}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-navy-900 mb-1.5">
                        {isRtl ? "שם מלא (אופציונלי)" : "Full Name (Optional)"}
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 rtl:left-auto rtl:right-3.5" />
                        <input
                          type="text"
                          placeholder={isRtl ? "למשל: מנדי קליין" : "e.g. Mendy Klein"}
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-navy-900 focus:border-navy-900 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-navy-900 mb-1.5">
                      {isRtl ? "הערות על הבגדים (אופציונלי)" : "Garment Notes (Optional)"}
                    </label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 rtl:left-auto rtl:right-3.5" />
                      <input
                        type="text"
                        placeholder={
                          isRtl
                            ? "למשל: חליפת צמר חדשה לחג, מעיל חורף, בגדי ילדים..."
                            : "e.g. New holiday wool suit, winter coat, vintage jacket..."
                        }
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-navy-900 focus:border-navy-900 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Error Notification */}
                  {submitError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* High-Converting CTA Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting || !selectedDate || !selectedTime || !phone.trim()}
                      className="w-full py-4 px-6 rounded-2xl bg-navy-900 hover:bg-navy-800 disabled:opacity-40 text-white font-extrabold text-base shadow-lg shadow-navy-900/20 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:cursor-not-allowed group"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                          <span>{isRtl ? "קובע את הפגישה ומייצר אישור SMS..." : "Confirming your appointment & SMS..."}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-gold-400" />
                          <span>
                            {isRtl
                              ? `אשר פגישה (${selectedDate || "תאריך"} @ ${
                                  selectedTime ? formatTime12h(selectedTime).label : "שעה"
                                })`
                              : `Confirm Appointment (${selectedDate || "Date"} @ ${
                                  selectedTime ? formatTime12h(selectedTime).label : "Time"
                                })`}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gold-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Right / Side Column: Sticky Luxury Summary & Lab Details */}
            <div className="lg:col-span-4 sticky top-6 space-y-6">
              {/* Dynamic Appointment Summary Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-extrabold text-navy-900 text-base">
                    {isRtl ? "סיכום הפגישה שלך" : "Appointment Summary"}
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gold-50 text-gold-700 border border-gold-200">
                    {isRtl ? "תור פרטי" : "VIP Slot"}
                  </span>
                </div>

                <div className="space-y-4 text-sm">
                  {/* Date Item */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-navy-900 flex items-center justify-center shrink-0 mt-0.5">
                      <CalendarIcon className="w-4 h-4 text-navy-800" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">
                        {isRtl ? "תאריך" : "Selected Date"}
                      </span>
                      {selectedDate ? (
                        <>
                          <strong className="text-navy-900 font-bold block">
                            {selectedDayOption ? `${selectedDayOption.dayNameEn}, ${selectedDayOption.displayDate}` : selectedDate}
                          </strong>
                          {selectedDayOption?.hebrewDateShort && (
                            <span className="text-xs text-slate-600 font-serif block">
                              {selectedDayOption.hebrewDateShort}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          {isRtl ? "טרם נבחר תאריך" : "No date selected"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time & Duration Item */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-navy-900 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-navy-800" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">
                        {isRtl ? "שעה ומשך" : "Time & Duration"}
                      </span>
                      {selectedTime ? (
                        <strong className="text-navy-900 font-bold block">
                          {formatTime12h(selectedTime).label} ({currentDuration} {isRtl ? "דקות" : "mins"})
                        </strong>
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          {isRtl ? "טרם נבחרה שעה" : "Select an available time"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Garments Item */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-navy-900 flex items-center justify-center shrink-0 mt-0.5">
                      <Shirt className="w-4 h-4 text-navy-800" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">
                        {isRtl ? "כמות בגדים" : "Garments Count"}
                      </span>
                      <strong className="text-navy-900 font-bold block">
                        {garmentsCount} {garmentsCount === 1 ? (isRtl ? "בגד אחד" : "1 Garment") : (isRtl ? `${garmentsCount} בגדים` : `${garmentsCount} Garments`)}
                      </strong>
                    </div>
                  </div>

                  {/* Location Item */}
                  <div className="flex items-start gap-3 pt-3 border-t border-slate-100">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-navy-900 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-navy-800" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">
                        {isRtl ? "מיקום המעבדה" : "Lab Location"}
                      </span>
                      <strong className="text-navy-900 font-bold block leading-snug">
                        {labAddress}
                      </strong>
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-semibold mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{isRtl ? "פתיחה במפה / ניווט" : "Directions / Maps"}</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lab Quality & Standards Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-navy-900 font-extrabold text-sm">
                  <Award className="w-4 h-4 text-gold-500" />
                  <span>{isRtl ? "סטנדרט מעבדה מקצועי" : "Laboratory Standards"}</span>
                </div>

                <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      {isRtl
                        ? "בדיקה יסודית במיקרוסקופ אופטי ובדיקות כימיות בהתאם לצורך."
                        : "Microscopic and chemical fiber verification on every inspected seam."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      {isRtl
                        ? "הכנה: רצוי להביא בגדים עם תגיות יצרן / הרכב בד במידה וקיימות."
                        : "Preparation: Please bring garments with manufacturer fiber tags intact if available."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      {isRtl
                        ? "שירות מהיר: בדיקה מיידית על המקום ללא המתנה מיותרת."
                        : "Punctual service: We begin promptly at your scheduled arrival time."}
                    </span>
                  </li>
                </ul>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{isRtl ? "שאלות או שינוי מועד?" : "Need to reschedule?"}</span>
                  <a href="tel:8455524744" className="font-bold text-navy-900 hover:text-primary-600">
                    845-552-4744
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
