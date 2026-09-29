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
  ArrowLeft
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { calculateAppointmentDuration, AvailableSlot, formatTime12h } from "@/lib/appointmentSlots";

interface DayOption {
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  dayNameEn: string;
  dayNameHe: string;
  displayDate: string; // "Sep 30"
  isToday: boolean;
  isTomorrow: boolean;
}

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

      list.push({
        dateStr,
        dayOfWeek,
        dayNameEn: dayNamesEn[dayOfWeek],
        dayNameHe: dayNamesHe[dayOfWeek],
        displayDate: `${monthNamesEn[d.getMonth()]} ${d.getDate()}`,
        isToday: i === 0,
        isTomorrow: i === 1
      });
    }
    return list;
  }, []);

  // Set default date to first open day
  useEffect(() => {
    if (upcomingDays.length > 0 && !selectedDate) {
      // Pick first non-Saturday day
      const firstValid = upcomingDays.find((d) => d.dayOfWeek !== 6);
      if (firstValid) {
        setSelectedDate(firstValid.dateStr);
      }
    }
  }, [upcomingDays, selectedDate]);

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
          ? "אנא הזן מספר טלפון תקין בן 10 ספרות"
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
          timeLabel: data.timeLabel || selectedTime,
          location: data.location || labAddress
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
      label: isOpen ? null : (day.dayOfWeek === 6 ? (isRtl ? "שבת" : "Shabbos") : (isRtl ? "סגור" : "Closed")),
      isHoliday: false
    };
  };

  return (
    <div className={`min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 ${isRtl ? "rtl" : "ltr"}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100 text-primary-800 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary-600" />
            {isRtl ? "קביעת פגישה עצמאית במעבדה" : "Self-Service In-Person Appointments"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            {isRtl ? "תיאום הגעה לבדיקת שעטנז" : "Schedule Your Lab Visit"}
          </h1>
          <p className="mt-2 text-base sm:text-lg text-primary-600 max-w-2xl mx-auto">
            {isRtl
              ? "בחר את מועד הביקור המועדף עליך, ציין את כמות הבגדים, וקבל שריון מיידי עם אישור SMS לטלפון."
              : "Select your preferred date, tell us how many garments you have, and instantly reserve your testing spot."}
          </p>
        </div>

        {/* Success View */}
        <AnimatePresence>
          {submitSuccess && confirmedDetails && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-emerald-100 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">
                  {isRtl ? "הפגישה שלך נקבעה בהצלחה!" : "Your Appointment is Confirmed!"}
                </h2>
                <p className="text-sm text-primary-600 mt-1">
                  {isRtl
                    ? `הודעת SMS עם פרטי הפגישה נשלחה כעת למספר ${confirmedDetails.phone}.`
                    : `A confirmation text message has been sent to ${confirmedDetails.phone}.`}
                </p>
              </div>

              {/* Confirmation Details Card */}
              <div className="bg-primary-50/70 border border-primary-100 rounded-2xl p-6 text-left max-w-md mx-auto space-y-3.5 text-sm">
                <div className="flex items-center justify-between pb-3 border-b border-primary-200/60">
                  <span className="text-primary-500 font-medium">{isRtl ? "תאריך ושעה" : "Date & Time"}</span>
                  <strong className="text-navy-900 text-base">
                    {confirmedDetails.date} @ {confirmedDetails.timeLabel}
                  </strong>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-primary-200/60">
                  <span className="text-primary-500 font-medium">{isRtl ? "כמות בגדים" : "Garments"}</span>
                  <strong className="text-navy-900">
                    {confirmedDetails.garmentsCount} {confirmedDetails.garmentsCount === 1 ? "garment" : "garments"}{" "}
                    ({confirmedDetails.duration} mins)
                  </strong>
                </div>

                {confirmedDetails.customerName && (
                  <div className="flex items-center justify-between pb-3 border-b border-primary-200/60">
                    <span className="text-primary-500 font-medium">{isRtl ? "שם הלקוח" : "Customer"}</span>
                    <strong className="text-navy-900">{confirmedDetails.customerName}</strong>
                  </div>
                )}

                <div className="flex items-start justify-between pt-1">
                  <span className="text-primary-500 font-medium">{isRtl ? "כתובת המעבדה" : "Lab Address"}</span>
                  <span className="text-navy-900 font-semibold text-right max-w-[200px]">
                    {confirmedDetails.location || labAddress}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <button
                  onClick={() => {
                    setSubmitSuccess(false);
                    setSelectedTime("");
                  }}
                  className="btn-primary px-6 py-2.5 rounded-xl font-bold"
                >
                  {isRtl ? "קבע פגישה נוספת" : "Book Another Appointment"}
                </button>
                <Link
                  href="/"
                  className="px-6 py-2.5 rounded-xl font-semibold text-navy-800 bg-primary-100 hover:bg-primary-200 transition-colors"
                >
                  {isRtl ? "חזרה לדף הבית" : "Return to Home"}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Booking Form Card */}
        {!submitSuccess && (
          <div className="bg-white rounded-3xl shadow-xl border border-primary-100 overflow-hidden">
            <form onSubmit={handleSubmitBooking} className="p-6 sm:p-10 space-y-8">
              {/* Step 1: Select Date */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <label className="font-bold text-navy-900 text-base">
                      {isRtl ? "בחר תאריך רצוי" : "Select Date"}
                    </label>
                  </div>
                  <span className="text-xs text-primary-500">
                    {isRtl ? "זמנים מעודכנים בזמן אמת" : "Live availability"}
                  </span>
                </div>

                {/* Day selector pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {upcomingDays.map((day) => {
                    const status = getDayStatus(day);
                    const isOpen = status.isOpen;
                    const isSelected = selectedDate === day.dateStr;

                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        disabled={!isOpen}
                        onClick={() => setSelectedDate(day.dateStr)}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center transition-all border text-center relative ${
                          isSelected
                            ? "bg-primary-600 text-white border-primary-600 shadow-md scale-102"
                            : isOpen
                            ? "bg-white text-navy-900 border-primary-200 hover:border-primary-400 hover:bg-primary-50"
                            : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                        }`}
                      >
                        {day.isToday && (
                          <span
                            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full mb-1 ${
                              isSelected ? "bg-white/20 text-white" : "bg-primary-100 text-primary-700"
                            }`}
                          >
                            {isRtl ? "היום" : "Today"}
                          </span>
                        )}
                        {day.isTomorrow && (
                          <span
                            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full mb-1 ${
                              isSelected ? "bg-white/20 text-white" : "bg-primary-100 text-primary-700"
                            }`}
                          >
                            {isRtl ? "מחר" : "Tomorrow"}
                          </span>
                        )}
                        <span className="text-xs font-semibold">
                          {isRtl ? day.dayNameHe : day.dayNameEn}
                        </span>
                        <span className="text-xs font-bold mt-0.5">{day.displayDate}</span>
                        {!isOpen && (
                          <span
                            className="text-[9px] text-rose-500 font-semibold mt-1 truncate max-w-[85px]"
                            title={status.label || undefined}
                          >
                            {status.label || (isRtl ? "סגור" : "Closed")}
                          </span>
                        )}
                        {isOpen && status.label && (
                          <span
                            className={`text-[9px] font-medium mt-1 truncate max-w-[85px] ${
                              isSelected ? "text-primary-100" : "text-amber-700"
                            }`}
                            title={status.label}
                          >
                            {status.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Number of Garments */}
              <div className="space-y-3 pt-4 border-t border-primary-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <label className="font-bold text-navy-900 text-base">
                      {isRtl ? "כמות בגדים לבדיקה" : "Number of Garments"}
                    </label>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold border border-amber-200">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {isRtl ? `משך משוער: ${currentDuration} דקות` : `Estimated duration: ${currentDuration} mins`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const isSelected = garmentsCount === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setGarmentsCount(num)}
                        className={`w-12 h-12 rounded-2xl font-extrabold text-sm transition-all border flex items-center justify-center ${
                          isSelected
                            ? "bg-navy-900 text-white border-navy-900 shadow-md scale-105"
                            : "bg-white text-navy-800 border-primary-200 hover:border-primary-400 hover:bg-primary-50"
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-primary-500">
                  {isRtl
                    ? "בגד 1 = 5 דקות | 2-3 בגדים = 10 דקות | 4 ומעלה = 15 דקות ומעלה"
                    : "1 garment = 5 mins | 2-3 garments = 10 mins | 4+ garments = 15+ mins"}
                </p>
              </div>

              {/* Step 3: Choose Time Slot */}
              <div className="space-y-3 pt-4 border-t border-primary-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <label className="font-bold text-navy-900 text-base">
                      {isRtl ? "בחר שעה פנויה" : "Select Available Time"}
                    </label>
                  </div>
                  {availableSlots.length > 0 && (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {availableSlots.length} {isRtl ? "שעות פנויות" : "slots available"}
                    </span>
                  )}
                </div>

                {loadingSlots ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-primary-500">
                    <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-semibold">
                      {isRtl ? "טוען זמנים פנויים..." : "Searching available timeslots..."}
                    </span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 text-center text-amber-800 space-y-1">
                    <AlertCircle className="w-6 h-6 mx-auto text-amber-600" />
                    <p className="font-bold text-sm">
                      {isRtl ? "אין שעות פנויות בתאריך זה" : "No Available Slots on This Date"}
                    </p>
                    <p className="text-xs text-amber-700">
                      {isRtl
                        ? "המעבדה סגורה או שכל התורים ליום זה כבר נתפסו. אנא בחר תאריך אחר למעלה."
                        : "All slots are booked or the lab is closed. Please choose another date above."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setSelectedTime(slot.time)}
                          className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-0.5 ${
                            isSelected
                              ? "bg-primary-600 text-white border-primary-600 shadow-md scale-102 ring-2 ring-primary-300"
                              : "bg-white text-navy-900 border-primary-200 hover:border-primary-400 hover:bg-primary-50"
                          }`}
                        >
                          <span className="text-sm">{slot.label}</span>
                          <span
                            className={`text-[10px] font-medium ${
                              isSelected ? "text-white/80" : "text-primary-400"
                            }`}
                          >
                            {slot.duration} mins
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 4: Contact Details */}
              <div className="space-y-4 pt-4 border-t border-primary-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <label className="font-bold text-navy-900 text-base">
                    {isRtl ? "פרטי יצירת קשר" : "Your Details"}
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-navy-800 mb-1">
                      {isRtl ? "מספר טלפון לקבלת SMS *" : "Cell Phone Number (For SMS Confirmation) *"}
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-primary-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="845-552-4744"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-primary-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-navy-800 mb-1">
                      {isRtl ? "שם מלא (אופציונלי)" : "Full Name (Optional)"}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-primary-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="e.g. Mendy Klein"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-primary-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-800 mb-1">
                    {isRtl ? "הערות על הבגדים (אופציונלי)" : "Garment Notes (Optional)"}
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-primary-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder={isRtl ? "למשל: חליפת צמר חדשה, מעיל חורף..." : "e.g. Wool suit, winter coat..."}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-primary-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Lab Address Notice */}
              <div className="p-4 bg-primary-50 rounded-2xl border border-primary-200 flex items-start gap-3 text-xs text-primary-700">
                <MapPin className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-navy-900 block font-bold mb-0.5">
                    {isRtl ? "מיקום המעבדה לקבלת קהל:" : "Lab In-Person Location:"}
                  </strong>
                  <span>{labAddress}</span>
                </div>
              </div>

              {/* Error Message */}
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !selectedDate || !selectedTime || !phone.trim()}
                  className="w-full py-4 px-6 rounded-2xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white font-extrabold text-base shadow-lg shadow-primary-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{isRtl ? "קובע את הפגישה..." : "Reserving your appointment..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>
                        {isRtl
                          ? `אשר פגישה (${selectedDate || "תאריך"} @ ${selectedTime ? formatTime12h(selectedTime).label : "שעה"})`
                          : `Confirm Appointment (${selectedDate || "Date"} @ ${selectedTime ? formatTime12h(selectedTime).label : "Time"})`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
