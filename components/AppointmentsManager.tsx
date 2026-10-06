"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  Save,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  MessageSquare,
  Sparkles,
  PhoneCall,
  CalendarDays,
  List,
  MapPin,
  RefreshCw,
  X,
  CalendarOff,
  Ban,
  CalendarCheck,
  BookOpen,
  Globe,
  ShieldCheck
} from "lucide-react";
import {
  Appointment,
  AppointmentSettings,
  DateException,
  subscribeToAppointments,
  saveAppointment,
  deleteAppointment,
  updateAppointmentStatus,
  getAppointmentSettings,
  saveAppointmentSettings,
  DEFAULT_APPOINTMENT_SETTINGS
} from "@/lib/db";
import { formatTime12h, getNyDateString, calculateAppointmentDuration } from "@/lib/appointmentSlots";
import { getHebrewDayInfo, HebrewDayInfo } from "@/lib/hebrewCalendar";

interface Props {
  isRtl?: boolean;
}

export default function AppointmentsManager({ isRtl = false }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppointmentSettings>(DEFAULT_APPOINTMENT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "holidays">("calendar");
  const [selectedDate, setSelectedDate] = useState(() => getNyDateString().dateStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Holiday Calendar state
  const [holidayMonth, setHolidayMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [editingDateException, setEditingDateException] = useState<DateException | null>(null);
  const [exceptionType, setExceptionType] = useState<"closed" | "custom" | "regular">("closed");
  const [exceptionLabel, setExceptionLabel] = useState("");
  const [exceptionStart, setExceptionStart] = useState("10:00");
  const [exceptionEnd, setExceptionEnd] = useState("14:00");

  // New appointment form state
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(() => getNyDateString().dateStr);
  const [newTime, setNewTime] = useState("10:00");
  const [newGarments, setNewGarments] = useState(1);
  const [newNotes, setNewNotes] = useState("");
  const [newSource, setNewSource] = useState<"phone" | "admin" | "web">("phone");
  const [sendConfirmationSms, setSendConfirmationSms] = useState(true);
  const [savingNewApt, setSavingNewApt] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);

  // Subscribe to real-time appointments
  useEffect(() => {
    setIsClientMounted(true);
    let mounted = true;
    const unsubscribe = subscribeToAppointments((list) => {
      if (mounted) {
        setAppointments(list);
        setLoading(false);
      }
    });
    getAppointmentSettings().then((s) => {
      if (mounted) setSettings(s);
    });

    const timer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const renderPortal = (children: React.ReactNode) => {
    if (!isClientMounted || typeof document === "undefined") return null;
    return createPortal(children, document.body);
  };

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchesSearch =
        !searchQuery ||
        apt.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
      const matchesDate = viewMode === "list" || apt.date === selectedDate;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [appointments, searchQuery, statusFilter, selectedDate, viewMode]);

  // Daily statistics
  const todayStr = useMemo(() => getNyDateString().dateStr, []);
  const todayAppointments = useMemo(
    () => appointments.filter((a) => a.date === todayStr && a.status !== "cancelled"),
    [appointments, todayStr]
  );
  const scheduledCount = useMemo(
    () => appointments.filter((a) => a.status === "scheduled").length,
    [appointments]
  );
  const completedCount = useMemo(
    () => appointments.filter((a) => a.status === "completed").length,
    [appointments]
  );

  // Date Navigation
  const changeSelectedDate = (deltaDays: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + deltaDays);
    const newY = dateObj.getFullYear();
    const newM = String(dateObj.getMonth() + 1).padStart(2, "0");
    const newD = String(dateObj.getDate()).padStart(2, "0");
    setSelectedDate(`${newY}-${newM}-${newD}`);
  };

  // Weekdays definitions
  const WEEK_DAYS = [
    { day: 0, en: "Sunday", he: "יום ראשון" },
    { day: 1, en: "Monday", he: "יום שני" },
    { day: 2, en: "Tuesday", he: "יום שלישי" },
    { day: 3, en: "Wednesday", he: "יום רביעי" },
    { day: 4, en: "Thursday", he: "יום חמישי" },
    { day: 5, en: "Friday", he: "יום שישי" },
    { day: 6, en: "Saturday", he: "שבת קודש" }
  ];

  const getDayConfig = (day: number) => {
    const dayKey = String(day);
    const override = settings.dayOverrides?.[dayKey];
    const isDayInDaysOfWeek = (settings.daysOfWeek || [0, 1, 2, 3, 4]).includes(day);
    const isClosed = override?.closed !== undefined ? override.closed : !isDayInDaysOfWeek;
    const defaultStart = day === 5 ? "09:00" : (settings.startHour || "10:00");
    const defaultEnd = day === 5 ? "12:30" : (settings.endHour || "18:00");
    const start = override?.start || defaultStart;
    const end = override?.end || defaultEnd;
    return { isOpen: !isClosed, start, end };
  };

  const handleUpdateDay = (day: number, update: { isOpen?: boolean; start?: string; end?: string }) => {
    const current = getDayConfig(day);
    const newIsOpen = update.isOpen !== undefined ? update.isOpen : current.isOpen;
    const newStart = update.start !== undefined ? update.start : current.start;
    const newEnd = update.end !== undefined ? update.end : current.end;

    const overrides = { ...(settings.dayOverrides || {}) };
    overrides[String(day)] = {
      start: newStart,
      end: newEnd,
      closed: !newIsOpen
    };

    const daysSet = new Set(settings.daysOfWeek || [0, 1, 2, 3, 4]);
    if (newIsOpen) {
      daysSet.add(day);
    } else {
      daysSet.delete(day);
    }

    setSettings({
      ...settings,
      daysOfWeek: Array.from(daysSet).sort((a, b) => a - b),
      dayOverrides: overrides
    });
  };

  const handleApplyPresetHours = () => {
    const overrides = { ...(settings.dayOverrides || {}) };
    [0, 1, 2, 3, 4].forEach((d) => {
      overrides[String(d)] = { start: "10:00", end: "18:00", closed: false };
    });
    overrides["5"] = { start: "09:00", end: "12:30", closed: false };
    overrides["6"] = { start: "10:00", end: "18:00", closed: true };

    setSettings({
      ...settings,
      startHour: "10:00",
      endHour: "18:00",
      daysOfWeek: [0, 1, 2, 3, 4, 5],
      dayOverrides: overrides
    });
  };

  // Holiday / Date Exception Handlers
  const openDateEditor = (dateStr: string) => {
    const existing = settings.dateOverrides?.[dateStr];
    const hebrewInfo = getHebrewDayInfo(dateStr);
    if (existing) {
      setEditingDateException({ ...existing });
      setExceptionType(existing.closed ? "closed" : (existing.start ? "custom" : "regular"));
      setExceptionLabel(existing.label || hebrewInfo.primaryHoliday || "");
      setExceptionStart(existing.start || "10:00");
      setExceptionEnd(existing.end || "14:00");
    } else {
      const isBlackout = settings.blackoutDates?.includes(dateStr);
      setEditingDateException({
        date: dateStr,
        closed: isBlackout || true,
        label: hebrewInfo.primaryHoliday || ""
      });
      setExceptionType("closed");
      setExceptionLabel(hebrewInfo.primaryHoliday || "");
      setExceptionStart("10:00");
      setExceptionEnd("14:00");
    }
  };

  const handleSaveDateException = async () => {
    if (!editingDateException) return;
    const dateStr = editingDateException.date;
    const newOverrides = { ...(settings.dateOverrides || {}) };
    const blackoutSet = new Set(settings.blackoutDates || []);

    if (exceptionType === "regular") {
      delete newOverrides[dateStr];
      blackoutSet.delete(dateStr);
    } else if (exceptionType === "closed") {
      newOverrides[dateStr] = {
        date: dateStr,
        closed: true,
        label: exceptionLabel.trim() || (isRtl ? "סגור / חג" : "Holiday / Closed")
      };
      blackoutSet.add(dateStr);
    } else if (exceptionType === "custom") {
      newOverrides[dateStr] = {
        date: dateStr,
        closed: false,
        label: exceptionLabel.trim() || (isRtl ? "שעות מיוחדות" : "Special Hours"),
        start: exceptionStart,
        end: exceptionEnd
      };
      blackoutSet.delete(dateStr);
    }

    const updatedSettings: AppointmentSettings = {
      ...settings,
      dateOverrides: newOverrides,
      blackoutDates: Array.from(blackoutSet).sort()
    };

    setSettings(updatedSettings);
    setEditingDateException(null);
    await saveAppointmentSettings(updatedSettings);
  };

  const handleRemoveDateException = async (dateStr: string) => {
    const newOverrides = { ...(settings.dateOverrides || {}) };
    delete newOverrides[dateStr];
    const blackoutSet = new Set(settings.blackoutDates || []);
    blackoutSet.delete(dateStr);

    const updatedSettings: AppointmentSettings = {
      ...settings,
      dateOverrides: newOverrides,
      blackoutDates: Array.from(blackoutSet).sort()
    };
    setSettings(updatedSettings);
    await saveAppointmentSettings(updatedSettings);
  };

  const monthCalendarDays = useMemo(() => {
    const year = holidayMonth.getFullYear();
    const month = holidayMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = prevMonthDays - i;
      const prevM = String(month === 0 ? 12 : month).padStart(2, "0");
      const prevY = month === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${prevM}-${String(prevDate).padStart(2, "0")}`;
      days.push({
        dayNumber: prevDate,
        dateStr,
        isCurrentMonth: false,
        dayOfWeek: (firstDayIndex - 1 - i + 7) % 7,
        hebrew: getHebrewDayInfo(dateStr)
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const curM = String(month + 1).padStart(2, "0");
      const dateStr = `${year}-${curM}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = (firstDayIndex + d - 1) % 7;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        dayOfWeek,
        hebrew: getHebrewDayInfo(dateStr)
      });
    }

    // Trailing padding to fill 35 or 42 grid cells
    const targetTotal = days.length > 35 ? 42 : 35;
    const remaining = targetTotal - days.length;
    for (let nextD = 1; nextD <= remaining; nextD++) {
      const nextM = String(month === 11 ? 1 : month + 2).padStart(2, "0");
      const nextY = month === 11 ? year + 1 : year;
      const dateStr = `${nextY}-${nextM}-${String(nextD).padStart(2, "0")}`;
      days.push({
        dayNumber: nextD,
        dateStr,
        isCurrentMonth: false,
        dayOfWeek: (days.length) % 7,
        hebrew: getHebrewDayInfo(dateStr)
      });
    }

    return days;
  }, [holidayMonth]);

  const hebrewMonthRange = useMemo(() => {
    const year = holidayMonth.getFullYear();
    const month = holidayMonth.getMonth();
    const curM = String(month + 1).padStart(2, "0");
    const firstDateStr = `${year}-${curM}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const lastDateStr = `${year}-${curM}-${String(lastDay).padStart(2, "0")}`;

    const hFirst = getHebrewDayInfo(firstDateStr);
    const hLast = getHebrewDayInfo(lastDateStr);

    if (hFirst.hebrewMonth === hLast.hebrewMonth) {
      return `${hFirst.hebrewMonth} ${hFirst.hebrewYear}`;
    }
    return `${hFirst.hebrewMonth} - ${hLast.hebrewMonth} ${hLast.hebrewYear}`;
  }, [holidayMonth]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveAppointmentSettings(settings);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim() || !newDate || !newTime) return;

    setSavingNewApt(true);
    try {
      const duration = calculateAppointmentDuration(newGarments, settings);

      const apt: Appointment = {
        id: `apt_${Date.now()}_${newPhone.replace(/\D/g, "").slice(-4) || "0000"}`,
        phone: newPhone.trim(),
        customerName: newName.trim(),
        date: newDate,
        time: newTime,
        duration,
        garmentsCount: newGarments,
        status: "scheduled",
        notes: newNotes.trim(),
        createdAt: Date.now(),
        source: newSource
      };

      await saveAppointment(apt);

      // If SMS confirmation was requested, dispatch through serverless notification endpoint
      if (sendConfirmationSms && newPhone.trim()) {
        try {
          await fetch("/api/appointment/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: newPhone.trim(),
              customerName: newName.trim(),
              date: newDate,
              time: newTime,
              garmentsCount: newGarments,
              duration,
              notes: newNotes.trim(),
              source: newSource,
              sendCustomerSms: true,
              sendAdminSms: true
            })
          });
        } catch (smsErr) {
          console.warn("Failed to dispatch appointment notification SMS:", smsErr);
        }
      }

      setShowAddModal(false);
      setNewPhone("");
      setNewName("");
      setNewNotes("");
      setNewGarments(1);
      setNewSource("phone");
      setSendConfirmationSms(true);
    } catch (e) {
      console.error("Failed to save appointment:", e);
    } finally {
      setSavingNewApt(false);
    }
  };

  const handleStatusChange = async (aptId: string, status: Appointment["status"]) => {
    try {
      await updateAppointmentStatus(aptId, status);
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  const handleDelete = async (aptId: string) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    try {
      await deleteAppointment(aptId);
    } catch (e) {
      console.error("Failed to delete appointment:", e);
    }
  };

  // Status colors & labels
  const statusConfig = {
    scheduled: { label: "Scheduled", bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
    completed: { label: "Completed", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    cancelled: { label: "Cancelled", bg: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
    "no-show": { label: "No-Show", bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-gradient-to-br from-white to-primary-50 border border-primary-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary-500 uppercase tracking-wider">Today&apos;s Appointments</p>
            <h3 className="text-2xl font-bold text-navy-900 mt-1">{todayAppointments.length}</h3>
            <p className="text-xs text-primary-600 mt-0.5">
              {todayAppointments.filter((a) => a.status === "scheduled").length} pending arrival
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
            <CalendarIcon className="w-6 h-6" />
          </div>
        </div>

        <div className="card p-5 bg-gradient-to-br from-white to-blue-50 border border-blue-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">All Scheduled</p>
            <h3 className="text-2xl font-bold text-navy-900 mt-1">{scheduledCount}</h3>
            <p className="text-xs text-blue-600 mt-0.5">Upcoming on calendar</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="card p-5 bg-gradient-to-br from-white to-emerald-50 border border-emerald-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Completed Visits</p>
            <h3 className="text-2xl font-bold text-navy-900 mt-1">{completedCount}</h3>
            <p className="text-xs text-emerald-600 mt-0.5">Successfully served</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="card p-5 bg-gradient-to-br from-white to-amber-50 border border-amber-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Average Duration</p>
            <h3 className="text-2xl font-bold text-navy-900 mt-1">{settings.minutesPerGarment || 5} min</h3>
            <p className="text-xs text-amber-600 mt-0.5">per tested garment</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Toolbar: Controls & Filters ── */}
      <div className="card p-4 bg-white border border-primary-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Left side: View switcher & Date Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="bg-primary-100 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "calendar" ? "bg-white text-navy-900 shadow-sm font-bold" : "text-primary-600 hover:text-navy-900"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {isRtl ? "לוח יומי" : "Day Schedule"}
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "list" ? "bg-white text-navy-900 shadow-sm font-bold" : "text-primary-600 hover:text-navy-900"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              {isRtl ? "כל הפגישות" : "All Appointments"}
            </button>
            <button
              onClick={() => setViewMode("holidays")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "holidays" ? "bg-white text-rose-700 shadow-sm font-bold" : "text-primary-600 hover:text-navy-900"
              }`}
            >
              <CalendarOff className="w-3.5 h-3.5 text-rose-500" />
              {isRtl ? "לוח חגים וסגירות" : "Holidays & Closures"}
            </button>
          </div>

          {/* Date Selector in Calendar Mode */}
          {viewMode === "calendar" && (
            <div className="flex items-center gap-1 bg-white border border-primary-200 rounded-xl px-2 py-1 shadow-sm">
              <button
                onClick={() => changeSelectedDate(-1)}
                className="p-1 text-primary-500 hover:text-navy-900 rounded hover:bg-primary-50"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-semibold text-navy-900 bg-transparent border-0 focus:ring-0 cursor-pointer"
              />

              <button
                onClick={() => setSelectedDate(todayStr)}
                className="text-[11px] font-medium text-primary-600 hover:text-primary-900 px-1.5 py-0.5 rounded hover:bg-primary-50"
              >
                Today
              </button>

              <button
                onClick={() => changeSelectedDate(1)}
                className="p-1 text-primary-500 hover:text-navy-900 rounded hover:bg-primary-50"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right side: Search, Filter, Add & Settings buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box & Status Filter (Hidden in Holidays View) */}
          {viewMode !== "holidays" && (
            <>
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
                <input
                  type="text"
                  placeholder="Search phone or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-primary-50 border border-primary-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-primary-50 border border-primary-200 rounded-xl px-2.5 py-1.5 text-navy-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no-show">No-Show</option>
              </select>
            </>
          )}

          {/* Add Appointment Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Appointment
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary-200 hover:bg-primary-50 text-navy-800 rounded-xl text-xs font-semibold shadow-sm transition-all"
            title="Appointment Hours & Rules"
          >
            <Settings className="w-3.5 h-3.5 text-primary-600" />
            Settings
          </button>
        </div>
      </div>

      {/* ── Main View Content ── */}
      {viewMode === "holidays" ? null : loading ? (
        <div className="card p-12 bg-white text-center text-primary-500 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
          <p className="text-sm">Loading appointments...</p>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="card p-12 bg-white border border-dashed border-primary-200 text-center flex flex-col items-center justify-center gap-3">
          <CalendarIcon className="w-12 h-12 text-primary-300" />
          <h4 className="text-base font-bold text-navy-900">No appointments found</h4>
          <p className="text-xs text-primary-500 max-w-sm">
            {viewMode === "calendar"
              ? `There are no appointments scheduled for ${selectedDate}.`
              : "No appointments match your search or filter criteria."}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 flex items-center gap-1 px-4 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-xl text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Book Appointment For This Date
          </button>
        </div>
      ) : viewMode === "calendar" ? (
        /* ── Calendar / Timeline Schedule View ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-primary-600 px-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span>
                {isRtl ? "מציג" : "Showing"} <strong>{filteredAppointments.length}</strong> {isRtl ? "פגישות לתאריך" : "appointments for"} <strong>{selectedDate}</strong>
              </span>
              {selectedDate === todayStr && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs border border-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  <span>{isRtl ? "תורי היום!" : "Today's Schedule!"}</span>
                </span>
              )}
              {(() => {
                const h = getHebrewDayInfo(selectedDate);
                return (
                  <span className="inline-flex flex-wrap items-center gap-1.5 text-navy-900 font-serif font-bold">
                    <span>• {h.hebrewDateFull}</span>
                    {h.parsha && (
                      <span className="font-sans text-[10px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                        פרשת {h.parsha}
                      </span>
                    )}
                    {h.primaryHoliday && (
                      <span className="font-sans text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                        🕯️ {h.primaryHoliday}
                      </span>
                    )}
                  </span>
                );
              })()}
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Scheduled
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Completed
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Cancelled
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAppointments.map((apt) => {
              const { label: friendlyTime } = formatTime12h(apt.time);
              const conf = statusConfig[apt.status] || statusConfig.scheduled;
              const isToday = apt.date === todayStr;

              return (
                <div
                  key={apt.id}
                  className={`card p-5 bg-white border rounded-2xl shadow-sm transition-all hover:shadow-md relative overflow-hidden ${
                    isToday
                      ? "border-amber-400 ring-2 ring-amber-400/25 bg-gradient-to-b from-amber-50/25 via-white to-white"
                      : apt.status === "scheduled"
                      ? "border-blue-200 bg-gradient-to-b from-white to-blue-50/20"
                      : "border-primary-100"
                  }`}
                >
                  {/* Top: Time & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="p-2 rounded-xl bg-primary-100 text-primary-800 font-bold text-sm flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-primary-600" />
                        {friendlyTime}
                      </div>
                      <span className="text-xs text-primary-500 font-medium">
                        ({apt.duration || 5} {isRtl ? "דק'" : "mins"})
                      </span>
                      {isToday && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs border border-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          <span>{isRtl ? "היום!" : "TODAY!"}</span>
                        </span>
                      )}
                    </div>

                    <select
                      value={apt.status}
                      onChange={(e) => handleStatusChange(apt.id, e.target.value as any)}
                      className={`text-xs font-semibold rounded-full px-2.5 py-1 border transition-all ${conf.bg}`}
                    >
                      <option value="scheduled">{isRtl ? "מתוזמן" : "Scheduled"}</option>
                      <option value="completed">{isRtl ? "הושלם" : "Completed"}</option>
                      <option value="cancelled">{isRtl ? "בוטל" : "Cancelled"}</option>
                      <option value="no-show">{isRtl ? "לא הגיע" : "No-Show"}</option>
                    </select>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                      <User className="w-4 h-4 text-primary-400 shrink-0" />
                      <span>{apt.customerName || (isRtl ? "לקוח (פרונטלי)" : "Customer (In-person)")}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-primary-600">
                      <a
                        href={`tel:${apt.phone}`}
                        className="flex items-center gap-1.5 hover:text-primary-800 font-medium"
                      >
                        <Phone className="w-3.5 h-3.5 text-primary-400" />
                        {apt.phone || (isRtl ? "אין טלפון" : "No Phone")}
                      </a>
                      <span className="bg-primary-100 text-primary-800 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                        {apt.garmentsCount} {apt.garmentsCount === 1 ? (isRtl ? "בגד" : "garment") : (isRtl ? "בגדים" : "garments")}
                      </span>
                    </div>

                    {apt.notes && (
                      <p className="text-xs text-primary-500 bg-primary-50 p-2 rounded-lg mt-2 italic">
                        &ldquo;{apt.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-primary-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      {apt.source === "phone" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          <Phone className="w-3 h-3 text-sky-600" />
                          <span>{isRtl ? "ע״י טלפון" : "Via Phone Line"}</span>
                        </span>
                      ) : apt.source === "web" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Globe className="w-3 h-3 text-indigo-600" />
                          <span>{isRtl ? "דרך האתר" : "Via Website"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <ShieldCheck className="w-3 h-3 text-purple-600" />
                          <span>{isRtl ? "ע״י מנהל" : "Via Admin"}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`sms:${apt.phone}`}
                        className="p-1.5 text-primary-500 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-all"
                        title={isRtl ? "שלח SMS" : "Send SMS"}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={`tel:${apt.phone}`}
                        className="p-1.5 text-primary-500 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-all"
                        title={isRtl ? "התקשר ללקוח" : "Call Customer"}
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(apt.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title={isRtl ? "מחק פגישה" : "Delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── List / Table View ── */
        <div className="card overflow-hidden bg-white border border-primary-200 shadow-sm rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-primary-50 border-b border-primary-200 text-primary-700 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">{isRtl ? "תאריך ושעה" : "Date & Time"}</th>
                  <th className="py-3 px-4">{isRtl ? "לקוח" : "Customer"}</th>
                  <th className="py-3 px-4">{isRtl ? "טלפון" : "Phone"}</th>
                  <th className="py-3 px-4">{isRtl ? "בגדים" : "Garments"}</th>
                  <th className="py-3 px-4">{isRtl ? "סטטוס" : "Status"}</th>
                  <th className="py-3 px-4">{isRtl ? "מקור הזמנה" : "Source"}</th>
                  <th className="py-3 px-4 text-right rtl:text-left">{isRtl ? "פעולות" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {filteredAppointments.map((apt) => {
                  const { label: friendlyTime } = formatTime12h(apt.time);
                  const conf = statusConfig[apt.status] || statusConfig.scheduled;
                  const isToday = apt.date === todayStr;

                  return (
                    <tr key={apt.id} className={`hover:bg-primary-50/50 transition-colors ${isToday ? "bg-amber-50/30" : ""}`}>
                      <td className="py-3 px-4 font-semibold text-navy-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{apt.date} • {friendlyTime}</span>
                          {isToday && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-xs">
                              {isRtl ? "היום" : "Today"}
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-primary-400 font-normal">
                          {apt.duration || 5} {isRtl ? "דקות משך" : "mins duration"}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-navy-800">
                        {apt.customerName || (isRtl ? "לקוח (פרונטלי)" : "In-person Customer")}
                      </td>

                      <td className="py-3 px-4">
                        <a
                          href={`tel:${apt.phone}`}
                          className="text-primary-600 hover:underline font-mono"
                        >
                          {apt.phone}
                        </a>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-navy-900">{apt.garmentsCount}</span> {isRtl ? "פריטים" : "items"}
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={apt.status}
                          onChange={(e) => handleStatusChange(apt.id, e.target.value as any)}
                          className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${conf.bg}`}
                        >
                          <option value="scheduled">{isRtl ? "מתוזמן" : "Scheduled"}</option>
                          <option value="completed">{isRtl ? "הושלם" : "Completed"}</option>
                          <option value="cancelled">{isRtl ? "בוטל" : "Cancelled"}</option>
                          <option value="no-show">{isRtl ? "לא הגיע" : "No-Show"}</option>
                        </select>
                      </td>

                      <td className="py-3 px-4">
                        {apt.source === "phone" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            <Phone className="w-3 h-3 text-sky-600" />
                            <span>{isRtl ? "ע״י טלפון" : "Via Phone"}</span>
                          </span>
                        ) : apt.source === "web" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Globe className="w-3 h-3 text-indigo-600" />
                            <span>{isRtl ? "דרך האתר" : "Via Web"}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <ShieldCheck className="w-3 h-3 text-purple-600" />
                            <span>{isRtl ? "ע״י מנהל" : "Via Admin"}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`sms:${apt.phone}`}
                            className="p-1.5 text-primary-500 hover:text-primary-800 hover:bg-primary-100 rounded-lg"
                            title="SMS"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`tel:${apt.phone}`}
                            className="p-1.5 text-primary-500 hover:text-primary-800 hover:bg-primary-100 rounded-lg"
                            title="Call"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => handleDelete(apt.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Holidays & Date Exceptions View ── */}
      {viewMode === "holidays" && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="card p-6 bg-gradient-to-br from-white via-rose-50/30 to-amber-50/30 border border-primary-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <CalendarOff className="w-4 h-4" />
                </span>
                <h3 className="text-xl font-bold text-navy-900">
                  {isRtl ? "ניהול חגים, שבתונים וסגירות מיוחדות" : "Holidays, Blackouts & Special Closures"}
                </h3>
              </div>
              <p className="text-xs text-primary-600 mt-1 max-w-2xl">
                {isRtl
                  ? "הגדר באילו ימים ספציפיים המעבדה סגורה לחלוטין (חגים, חופשות וכו') ללא אפשרות לקביעת פגישות בטלפון או באתר, או קבע שעות פעילות מקוצרות לתאריך מסוים."
                  : "Block specific dates (Jewish holidays, vacations, family events) where no appointments are allowed on phone or web, or set special custom hours for a specific date."}
              </p>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center gap-2 bg-white border border-primary-200 rounded-2xl p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  const prev = new Date(holidayMonth);
                  prev.setMonth(prev.getMonth() - 1);
                  setHolidayMonth(prev);
                }}
                className="p-1.5 text-primary-500 hover:text-navy-900 rounded-lg hover:bg-primary-50 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="px-3 min-w-[160px] text-center flex flex-col items-center">
                <span className="text-sm font-bold text-navy-900 leading-tight">
                  {holidayMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
                </span>
                <span className="text-[11px] font-bold text-primary-600 mt-0.5">
                  {hebrewMonthRange}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = new Date(holidayMonth);
                  next.setMonth(next.getMonth() + 1);
                  setHolidayMonth(next);
                }}
                className="p-1.5 text-primary-500 hover:text-navy-900 rounded-lg hover:bg-primary-50 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Monthly Calendar Grid */}
          <div className="card p-6 bg-white border border-primary-200 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  {isRtl ? "לחץ על יום כדי לשנות סטטוס (פתוח / סגור לחג)" : "Click on any day to set holiday / closure status"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-primary-600">{isRtl ? "פתוח כרגיל" : "Regular Open"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-primary-600">{isRtl ? "חג / סגור" : "Holiday / Closed"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-primary-600">{isRtl ? "שעות מיוחדות" : "Custom Hours"}</span>
                </div>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-primary-500 uppercase tracking-wider">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
                <div key={dayName} className="py-1">
                  {isRtl ? ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"][idx] : dayName}
                </div>
              ))}
            </div>

            {/* Month Days Grid */}
            <div className="grid grid-cols-7 gap-2">
              {monthCalendarDays.map((cell) => {
                const exception = settings.dateOverrides?.[cell.dateStr];
                const isBlackout = settings.blackoutDates?.includes(cell.dateStr);
                const isClosed = exception?.closed || isBlackout;
                const hasCustomHours = exception && !exception.closed && exception.start;
                const isSaturday = cell.dayOfWeek === 6;
                const isWeekdayClosed = !isSaturday && !(settings.daysOfWeek || [0, 1, 2, 3, 4]).includes(cell.dayOfWeek);

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => openDateEditor(cell.dateStr)}
                    className={`min-h-[105px] p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all group relative ${
                      !cell.isCurrentMonth
                        ? "opacity-35 bg-primary-50/30 border-dashed border-primary-200"
                        : isClosed
                        ? "bg-rose-50/80 border-rose-300 hover:border-rose-500 hover:shadow-md"
                        : hasCustomHours
                        ? "bg-amber-50/80 border-amber-300 hover:border-amber-500 hover:shadow-md"
                        : isSaturday
                        ? "bg-indigo-50/30 border-indigo-100/80 text-navy-900"
                        : isWeekdayClosed
                        ? "bg-primary-50/60 border-primary-200 text-primary-400"
                        : "bg-white border-primary-200 hover:border-primary-400 hover:bg-primary-50/50 hover:shadow-sm"
                    }`}
                  >
                    {/* Top Row: Gregorian Day & Hebrew Day */}
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-extrabold ${cell.isCurrentMonth ? "text-navy-900" : "text-primary-400"}`}>
                          {cell.dayNumber}
                        </span>
                        {cell.hebrew?.isRoshChodesh && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs">
                            ר״ח
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-bold font-serif ${
                            cell.isCurrentMonth ? "text-primary-700" : "text-primary-400"
                          }`}
                          title={cell.hebrew?.hebrewDateFull}
                        >
                          {cell.hebrew?.hebrewDay === "א׳"
                            ? `${cell.hebrew?.hebrewDay} ${cell.hebrew?.hebrewMonth}`
                            : cell.hebrew?.hebrewDay}
                        </span>
                        {isClosed ? (
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        ) : hasCustomHours ? (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        ) : !isSaturday && !isWeekdayClosed ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500/60 shrink-0" />
                        ) : null}
                      </div>
                    </div>

                    {/* Middle: Hebrew Holiday & Parsha */}
                    <div className="my-1 space-y-1 w-full overflow-hidden">
                      {/* Shabbat Parsha */}
                      {isSaturday && cell.hebrew?.parsha && (
                        <div
                          className="bg-indigo-100/80 border border-indigo-200 text-indigo-950 text-[10px] font-bold px-1.5 py-0.5 rounded-lg truncate flex items-center gap-1 shadow-2xs"
                          title={`פרשת ${cell.hebrew.parsha}`}
                        >
                          <BookOpen className="w-3 h-3 text-indigo-700 shrink-0" />
                          <span className="truncate">פרשת {cell.hebrew.parsha}</span>
                        </div>
                      )}

                      {/* Jewish Holidays (if any on this day) */}
                      {cell.hebrew?.holidays && cell.hebrew.holidays.length > 0 && (
                        <div
                          className="bg-amber-100/90 border border-amber-300 text-amber-950 text-[10px] font-bold px-1.5 py-0.5 rounded-lg truncate flex items-center gap-1 shadow-2xs"
                          title={cell.hebrew.holidays.join(", ")}
                        >
                          <span className="text-[10px] leading-none">🕯️</span>
                          <span className="truncate">{cell.hebrew.holidays.join(", ")}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Lab Open/Closed Status */}
                    <div className="w-full overflow-hidden">
                      {isClosed ? (
                        <div className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate">
                          ⛔ {exception?.label || (isRtl ? "חג / סגור" : "Closed")}
                        </div>
                      ) : hasCustomHours ? (
                        <div className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate">
                          🕒 {exception.start}-{exception.end}
                        </div>
                      ) : isSaturday ? (
                        <span className="text-[10px] text-indigo-900/60 font-semibold block">{isRtl ? "שבת קודש" : "Shabbos"}</span>
                      ) : isWeekdayClosed ? (
                        <span className="text-[10px] text-primary-400 font-medium italic block">{isRtl ? "סגור" : "Closed"}</span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-medium block">{isRtl ? "פתוח כרגיל" : "Open"}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Defined Holidays & Exceptions Summary List */}
          <div className="card p-6 bg-white border border-primary-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-primary-100">
              <div>
                <h4 className="font-bold text-navy-900 text-sm">
                  {isRtl ? "רשימת חגים, שבתונים וימים חריגים שהוגדרו" : "Defined Holidays & Date Exceptions"}
                </h4>
                <p className="text-xs text-primary-500">
                  {isRtl ? "ימים אלו חוסמים קביעת פגישות או קובעים שעות מיוחדות" : "These dates override regular schedules for phone and website bookings"}
                </p>
              </div>
              <span className="text-xs font-bold text-primary-700 bg-primary-100 px-3 py-1 rounded-xl">
                {Object.keys(settings.dateOverrides || {}).length} {isRtl ? "תאריכים מוגדרים" : "dates set"}
              </span>
            </div>

            {Object.keys(settings.dateOverrides || {}).length === 0 ? (
              <div className="py-8 text-center text-primary-400 text-xs">
                {isRtl
                  ? "לא הוגדרו עדיין חגים או ימי סגירה מיוחדים. לחץ על כל יום בלוח שלמעלה כדי להגדירו כחג."
                  : "No holiday or closure dates set yet. Click any day on the calendar above to set it as closed."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(settings.dateOverrides || {})
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dateStr, exc]) => (
                    <div
                      key={dateStr}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        exc.closed
                          ? "bg-rose-50/60 border-rose-200 text-rose-900"
                          : "bg-amber-50/60 border-amber-200 text-amber-900"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <strong className="block text-sm font-bold">{dateStr}</strong>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span
                            className={`w-2 h-2 rounded-full ${exc.closed ? "bg-rose-500" : "bg-amber-500"}`}
                          />
                          <span>{exc.label || (exc.closed ? "Closed" : "Special Hours")}</span>
                        </div>
                        {!exc.closed && exc.start && (
                          <span className="text-[11px] text-amber-800 font-medium block">
                            {exc.start} - {exc.end}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openDateEditor(dateStr)}
                          className="p-1.5 text-primary-600 hover:text-navy-900 hover:bg-white rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDateException(dateStr)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded-lg transition-colors"
                          title="Delete / Revert to normal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Date Exception / Holiday Editor Modal ── */}
      {renderPortal(
        <AnimatePresence>
          {editingDateException && (() => {
            const modalHebrewInfo = getHebrewDayInfo(editingDateException.date);
            return (
              <motion.div
                key="date-exception-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-primary-200"
                >
                <div className="flex items-center justify-between pb-3 border-b border-primary-100 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                      <CalendarOff className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-navy-900">
                        {isRtl ? "הגדרת יום / חג לתאריך" : "Configure Date Exception"}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-primary-500 font-mono font-semibold">
                          {editingDateException.date}
                        </span>
                        <span className="text-xs font-bold text-navy-900 font-serif">
                          • {modalHebrewInfo.hebrewDateFull}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingDateException(null)}
                    className="p-1 text-primary-400 hover:text-primary-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Hebrew Date & Parsha Banner */}
                  <div className="bg-primary-50/80 border border-primary-200/80 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-navy-900 block font-serif">
                        {modalHebrewInfo.hebrewDateFull}
                      </span>
                      <span className="text-[11px] text-primary-600 font-medium">
                        {modalHebrewInfo.parsha ? `פרשת ${modalHebrewInfo.parsha}` : ""}
                        {modalHebrewInfo.primaryHoliday ? ` • ${modalHebrewInfo.primaryHoliday}` : ""}
                      </span>
                    </div>
                    {modalHebrewInfo.isRoshChodesh && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        ראש חודש
                      </span>
                    )}
                  </div>

                  {/* Exception Type Radio */}
                  <div className="space-y-2">
                    <label className="block font-bold text-navy-900">
                      {isRtl ? "סטטוס התאריך" : "Day Status"}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setExceptionType("regular")}
                        className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                          exceptionType === "regular"
                            ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                            : "bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100"
                        }`}
                      >
                        {isRtl ? "פתוח כרגיל" : "Regular Open"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExceptionType("closed")}
                        className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                          exceptionType === "closed"
                            ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                            : "bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100"
                        }`}
                      >
                        {isRtl ? "סגור / חג" : "Holiday / Closed"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExceptionType("custom")}
                        className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                          exceptionType === "custom"
                            ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                            : "bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100"
                        }`}
                      >
                        {isRtl ? "שעות מיוחדות" : "Custom Hours"}
                      </button>
                    </div>
                  </div>

                  {/* Holiday / Event Name */}
                  {exceptionType !== "regular" && (
                    <div>
                      <label className="block font-semibold text-navy-900 mb-1">
                        {isRtl ? "שם החג / סיבת הסגירה" : "Holiday Name or Closure Reason"}
                      </label>
                      <input
                        type="text"
                        placeholder={isRtl ? "למשל: ראש השנה, ערב סוכות, חופשה..." : "e.g. Rosh Hashanah, Vacation..."}
                        value={exceptionLabel}
                        onChange={(e) => setExceptionLabel(e.target.value)}
                        className="w-full px-3 py-2 border border-primary-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />

                      {/* Fast selection chips */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {modalHebrewInfo.holidays.map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setExceptionLabel(h)}
                            className="px-2.5 py-1 rounded-lg bg-amber-100/90 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[11px] font-bold transition-colors"
                          >
                            🕯️ {h}
                          </button>
                        ))}
                        {(isRtl
                          ? ["ערב חג", "חג", "צום", "חול המועד", "חופשה"]
                          : ["Holiday", "Eve of Holiday", "Fast Day", "Chol HaMoed", "Vacation"]
                        ).map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setExceptionLabel(tag)}
                            className="px-2 py-1 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-700 text-[10px] font-semibold transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Custom Hours inputs */}
                {exceptionType === "custom" && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl">
                    <div>
                      <label className="block text-primary-600 mb-1 font-medium">{isRtl ? "שעת פתיחה" : "Start Time"}</label>
                      <input
                        type="time"
                        value={exceptionStart}
                        onChange={(e) => setExceptionStart(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-primary-300 rounded-xl bg-white text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-primary-600 mb-1 font-medium">{isRtl ? "שעת סגירה" : "End Time"}</label>
                      <input
                        type="time"
                        value={exceptionEnd}
                        onChange={(e) => setExceptionEnd(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-primary-300 rounded-xl bg-white text-xs font-semibold"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-primary-100">
                  <button
                    type="button"
                    onClick={() => setEditingDateException(null)}
                    className="px-4 py-2 border border-primary-300 rounded-xl text-primary-700 hover:bg-primary-50 font-semibold"
                  >
                    {isRtl ? "ביטול" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDateException}
                    className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-sm"
                  >
                    {isRtl ? "שמור הגדרת יום" : "Save Date Rule"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
        </AnimatePresence>
      )}

      {/* ── Add Appointment Modal ── */}
      {renderPortal(
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              key="add-apt-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.18 }}
                className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-primary-200"
              >
              <div className="flex items-center justify-between pb-3 border-b border-primary-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-navy-900">
                      {isRtl ? "קביעת פגישה חדשה במעבדה" : "Schedule In-Person Appointment"}
                    </h3>
                    <p className="text-[11px] text-primary-500">
                      {isRtl ? "הזנת תור עבור לקוח שהתקשר או הגיע" : "Enter appointment for caller or walk-in client"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-primary-400 hover:text-primary-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddAppointment} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-navy-900 mb-1">
                    {isRtl ? "מספר טלפון של הלקוח לקבלת SMS *" : "Customer Phone Number *"}
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="845-123-4567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-navy-900 mb-1">
                    {isRtl ? "שם הלקוח (אופציונלי)" : "Customer Name (Optional)"}
                  </label>
                  <input
                    type="text"
                    placeholder={isRtl ? "למשל: מנדי קליין" : "e.g. Mendy Klein"}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-navy-900 mb-1">
                      {isRtl ? "תאריך *" : "Date *"}
                    </label>
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full px-3 py-2 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-navy-900 mb-1">
                      {isRtl ? "שעה (24h) *" : "Time (24h) *"}
                    </label>
                    <input
                      type="time"
                      required
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full px-3 py-2 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-navy-900 mb-1">
                    {isRtl ? "כמות בגדים לבדיקה: " : "Number of Garments: "}
                    <strong>{newGarments}</strong>
                    <span className="text-primary-500 font-normal">
                      {" "}
                      ({isRtl ? "משך מחושב:" : "Calculated duration:"} {calculateAppointmentDuration(newGarments, settings)} {isRtl ? "דק'" : "mins"})
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={settings.maxGarments || 10}
                    value={newGarments}
                    onChange={(e) => setNewGarments(parseInt(e.target.value, 10))}
                    className="w-full accent-primary-600"
                  />
                  <div className="flex justify-between text-[10px] text-primary-400 mt-0.5">
                    <span>1 {isRtl ? "בגד" : "garment"}</span>
                    <span>{settings.maxGarments || 10} {isRtl ? "בגדים" : "garments"}</span>
                  </div>
                </div>

                {/* Source Selection (How the client booked) */}
                <div>
                  <label className="block font-semibold text-navy-900 mb-1">
                    {isRtl ? "איך הוזמנה הפגישה? (מקור)" : "Booking Channel (Source)"}
                  </label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value as any)}
                    className="w-full px-3 py-2 border border-primary-300 rounded-xl bg-white font-semibold text-navy-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="phone">
                      {isRtl ? "📞 ע״י טלפון (הלקוח חייג לקו / מענה קולי)" : "📞 Via Phone Line (Caller / IVR)"}
                    </option>
                    <option value="web">
                      {isRtl ? "🌐 דרך האתר (הזמנה אונליין)" : "🌐 Via Website (Online Booking)"}
                    </option>
                    <option value="admin">
                      {isRtl ? "🛡️ ע״י מנהל (הזנה ידנית במערכת)" : "🛡️ Via Admin (Manual Entry)"}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-navy-900 mb-1">
                    {isRtl ? "הערות / הנחיות מיוחדות" : "Notes / Instructions"}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={isRtl ? "למשל: חליפת צמר, מעיל חורף..." : "Specific questions, suits, or rush request..."}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                {/* SMS Confirmation Checkbox */}
                <div className="p-3 rounded-2xl bg-primary-50/80 border border-primary-200 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-navy-900 block text-xs">
                      {isRtl ? "שלח אישור SMS ללקוח והתראה למנהל" : "Send SMS Confirmation & Admin Alert"}
                    </span>
                    <span className="text-[11px] text-primary-500 block">
                      {isRtl
                        ? "הלקוח יקבל SMS מיידי עם פרטי התור והכתובת"
                        : "Sends instant text details to customer and an alert to admin"}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={sendConfirmationSms}
                    onChange={(e) => setSendConfirmationSms(e.target.checked)}
                    className="w-4 h-4 accent-primary-600 rounded cursor-pointer shrink-0"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-primary-300 rounded-xl text-primary-700 hover:bg-primary-50 font-semibold cursor-pointer"
                  >
                    {isRtl ? "ביטול" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={savingNewApt}
                    className="px-5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-bold shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {savingNewApt && (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    <span>
                      {savingNewApt
                        ? isRtl
                          ? "שומר..."
                          : "Saving..."
                        : isRtl
                        ? "אשר ושמור פגישה"
                        : "Confirm Booking"}
                    </span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      )}

      {/* ── Appointment Settings Modal / Drawer ── */}
      {renderPortal(
        <AnimatePresence>
          {showSettingsModal && (
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.18 }}
                className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-primary-200"
              >
              <div className="flex items-center justify-between pb-3 border-b border-primary-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-navy-900">Appointment System Settings</h3>
                    <p className="text-xs text-primary-500">Configure phone booking hours, slots, and time limits</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 text-primary-400 hover:text-primary-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5 text-xs">
                {/* Active switch */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-primary-50 border border-primary-200">
                  <div>
                    <h4 className="font-bold text-navy-900">Enable Phone Appointments</h4>
                    <p className="text-[11px] text-primary-500">
                      When enabled, callers pressing 5 can book automated appointment slots.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                    className="w-5 h-5 accent-primary-600 rounded cursor-pointer"
                  />
                </div>

                {/* Per-Day Schedule & Hours */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-navy-900 uppercase tracking-wider text-[11px] text-primary-600">
                        {isRtl ? "שעות קבלה יומיות (לפי כל יום בשבוע)" : "Daily Reception Hours (Per Day)"}
                      </h4>
                      <p className="text-xs text-primary-500">
                        {isRtl ? "קבע את שעות הפתיחה והסגירה המדויקות לכל יום בנפרד" : "Set exact open hours and availability for each specific day"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyPresetHours}
                      className="text-xs font-semibold text-primary-700 hover:text-primary-900 bg-primary-100 hover:bg-primary-200 px-2.5 py-1 rounded-lg transition-colors border border-primary-200"
                    >
                      {isRtl ? "איפוס לשעות ברירת מחדל" : "Reset Standard Hours"}
                    </button>
                  </div>

                  <div className="border border-primary-200 rounded-2xl overflow-hidden divide-y divide-primary-100 bg-white">
                    {WEEK_DAYS.map(({ day, en, he }) => {
                      const cfg = getDayConfig(day);
                      return (
                        <div
                          key={day}
                          className={`p-3 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                            cfg.isOpen ? "bg-white" : "bg-primary-50/40 opacity-70"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-[150px]">
                            <button
                              type="button"
                              onClick={() => handleUpdateDay(day, { isOpen: !cfg.isOpen })}
                              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                                cfg.isOpen
                                  ? "bg-emerald-500 text-white border-emerald-600 shadow-xs hover:bg-emerald-600"
                                  : "bg-primary-100 text-primary-600 border-primary-200 hover:bg-primary-200"
                              }`}
                            >
                              {cfg.isOpen ? (isRtl ? "פתוח" : "Open") : (isRtl ? "סגור" : "Closed")}
                            </button>
                            <span className="font-bold text-sm text-navy-900">
                              {isRtl ? he : en}
                            </span>
                          </div>

                          {cfg.isOpen ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-primary-500 font-medium">{isRtl ? "משעה" : "From"}</span>
                              <input
                                type="time"
                                value={cfg.start}
                                onChange={(e) => handleUpdateDay(day, { start: e.target.value })}
                                className="px-2.5 py-1 text-xs font-semibold border border-primary-300 rounded-xl bg-primary-50/50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                              />
                              <span className="text-xs text-primary-400 font-medium">{isRtl ? "עד" : "to"}</span>
                              <input
                                type="time"
                                value={cfg.end}
                                onChange={(e) => handleUpdateDay(day, { end: e.target.value })}
                                className="px-2.5 py-1 text-xs font-semibold border border-primary-300 rounded-xl bg-primary-50/50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-primary-400 font-medium italic">
                              {isRtl ? "אין קבלת קהל / סגור לפגישות" : "Closed for appointments"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Duration Rules */}
                <div className="space-y-3">
                  <h4 className="font-bold text-navy-900 uppercase tracking-wider text-[11px] text-primary-600">
                    Timing & Calculation Rules
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-primary-600 mb-1 font-medium">Minutes / Garment (4+)</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={settings.minutesPerGarment || 5}
                        onChange={(e) =>
                          setSettings({ ...settings, minutesPerGarment: parseInt(e.target.value, 10) || 5 })
                        }
                        className="w-full px-3 py-2 border border-primary-300 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-primary-600 mb-1 font-medium">Base Slot (2-3 items)</label>
                      <input
                        type="number"
                        min={5}
                        max={60}
                        value={settings.minDuration || 10}
                        onChange={(e) =>
                          setSettings({ ...settings, minDuration: parseInt(e.target.value, 10) || 10 })
                        }
                        className="w-full px-3 py-2 border border-primary-300 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-primary-600 mb-1 font-medium">Buffer Between Visits</label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={settings.bufferMinutes !== undefined && !isNaN(settings.bufferMinutes) ? settings.bufferMinutes : 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setSettings({ ...settings, bufferMinutes: isNaN(val) ? 0 : Math.max(0, val) });
                        }}
                        className="w-full px-3 py-2 border border-primary-300 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-primary-600 mb-1 font-medium">Slot Interval (Minutes)</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={settings.slotInterval !== undefined && !isNaN(settings.slotInterval) ? settings.slotInterval : 5}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setSettings({ ...settings, slotInterval: isNaN(val) ? 5 : Math.max(1, val) });
                        }}
                        className="w-full px-3 py-2 border border-primary-300 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Lab Address for Confirmation SMS */}
                <div>
                  <label className="block font-semibold text-navy-900 mb-1">
                    Lab Address (Included in Customer Confirmation SMS)
                  </label>
                  <input
                    type="text"
                    value={settings.locationText || "14 Buchanan Rd, North Square, NY"}
                    onChange={(e) => setSettings({ ...settings, locationText: e.target.value })}
                    className="w-full px-3 py-2 border border-primary-300 rounded-xl"
                  />
                </div>

                {/* Admin Alert Phone for New Bookings */}
                <div>
                  <label className="block font-semibold text-navy-900 mb-1">
                    {isRtl ? "מספר לקבלת התראת SMS על כל פגישה שנקבעת" : "Admin SMS Alert Number (Receive text on new bookings)"}
                  </label>
                  <input
                    type="tel"
                    placeholder="845-552-4744"
                    value={settings.adminNotificationPhone || ""}
                    onChange={(e) => setSettings({ ...settings, adminNotificationPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-primary-300 rounded-xl"
                  />
                  <p className="text-[11px] text-primary-500 mt-1">
                    {isRtl
                      ? "הודעת SMS תישלח למספר זה באופן אוטומטי בכל פעם שלקוח קובע פגישה באתר או בטלפון."
                      : "You will receive an instant text notification whenever a client schedules an appointment."}
                  </p>
                </div>

                {settingsSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Settings updated successfully!
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-primary-100">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 border border-primary-300 rounded-xl text-primary-700 hover:bg-primary-50 font-semibold"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="flex items-center gap-1.5 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {savingSettings ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      )}
    </div>
  );
}
