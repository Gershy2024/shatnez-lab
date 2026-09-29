"use client";

import { useState, useEffect, useMemo } from "react";
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
  X
} from "lucide-react";
import {
  Appointment,
  AppointmentSettings,
  subscribeToAppointments,
  saveAppointment,
  deleteAppointment,
  updateAppointmentStatus,
  getAppointmentSettings,
  saveAppointmentSettings,
  DEFAULT_APPOINTMENT_SETTINGS
} from "@/lib/db";
import { formatTime12h, getNyDateString, calculateAppointmentDuration } from "@/lib/appointmentSlots";

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
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDate, setSelectedDate] = useState(() => getNyDateString().dateStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New appointment form state
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(() => getNyDateString().dateStr);
  const [newTime, setNewTime] = useState("10:00");
  const [newGarments, setNewGarments] = useState(1);
  const [newNotes, setNewNotes] = useState("");
  const [savingNewApt, setSavingNewApt] = useState(false);

  // Subscribe to real-time appointments
  useEffect(() => {
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
        source: "admin"
      };

      await saveAppointment(apt);
      setShowAddModal(false);
      setNewPhone("");
      setNewName("");
      setNewNotes("");
      setNewGarments(1);
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
                viewMode === "calendar" ? "bg-white text-navy-900 shadow-sm" : "text-primary-600 hover:text-navy-900"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Day Schedule
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "list" ? "bg-white text-navy-900 shadow-sm" : "text-primary-600 hover:text-navy-900"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              All Appointments
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
          {/* Search box */}
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

          {/* Status Filter */}
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
      {loading ? (
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
            <span>
              Showing <strong>{filteredAppointments.length}</strong> appointments for <strong>{selectedDate}</strong>
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

              return (
                <div
                  key={apt.id}
                  className={`card p-5 bg-white border rounded-2xl shadow-sm transition-all hover:shadow-md ${
                    apt.status === "scheduled"
                      ? "border-blue-200 bg-gradient-to-b from-white to-blue-50/20"
                      : "border-primary-100"
                  }`}
                >
                  {/* Top: Time & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-primary-100 text-primary-800 font-bold text-sm flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-primary-600" />
                        {friendlyTime}
                      </div>
                      <span className="text-xs text-primary-500 font-medium">
                        ({apt.duration || 15} mins)
                      </span>
                    </div>

                    <select
                      value={apt.status}
                      onChange={(e) => handleStatusChange(apt.id, e.target.value as any)}
                      className={`text-xs font-semibold rounded-full px-2.5 py-1 border transition-all ${conf.bg}`}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no-show">No-Show</option>
                    </select>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                      <User className="w-4 h-4 text-primary-400 shrink-0" />
                      <span>{apt.customerName || "Customer (In-person)"}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-primary-600">
                      <a
                        href={`tel:${apt.phone}`}
                        className="flex items-center gap-1.5 hover:text-primary-800 font-medium"
                      >
                        <Phone className="w-3.5 h-3.5 text-primary-400" />
                        {apt.phone || "No Phone"}
                      </a>
                      <span className="bg-primary-100 text-primary-800 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                        {apt.garmentsCount} {apt.garmentsCount === 1 ? "garment" : "garments"}
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
                    <span className="text-[11px] text-primary-400">
                      Via {apt.source === "phone" ? "Automated Phone Line" : "Admin"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`sms:${apt.phone}`}
                        className="p-1.5 text-primary-500 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-all"
                        title="Send SMS"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={`tel:${apt.phone}`}
                        className="p-1.5 text-primary-500 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-all"
                        title="Call Customer"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(apt.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete"
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
            <table className="w-full text-left text-xs">
              <thead className="bg-primary-50 border-b border-primary-200 text-primary-700 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Garments</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {filteredAppointments.map((apt) => {
                  const { label: friendlyTime } = formatTime12h(apt.time);
                  const conf = statusConfig[apt.status] || statusConfig.scheduled;

                  return (
                    <tr key={apt.id} className="hover:bg-primary-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-navy-900 whitespace-nowrap">
                        {apt.date} • {friendlyTime}
                        <span className="block text-[10px] text-primary-400 font-normal">
                          {apt.duration || 15} mins duration
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-navy-800">
                        {apt.customerName || "In-person Customer"}
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
                        <span className="font-semibold text-navy-900">{apt.garmentsCount}</span> items
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={apt.status}
                          onChange={(e) => handleStatusChange(apt.id, e.target.value as any)}
                          className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${conf.bg}`}
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="no-show">No-Show</option>
                        </select>
                      </td>

                      <td className="py-3 px-4 text-primary-500 capitalize">{apt.source || "phone"}</td>

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

      {/* ── Add Appointment Modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-primary-200"
            >
              <div className="flex items-center justify-between pb-3 border-b border-primary-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-navy-900">Schedule In-Person Appointment</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-primary-400 hover:text-primary-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddAppointment} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-navy-900 mb-1">Customer Phone Number *</label>
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
                  <label className="block font-semibold text-navy-900 mb-1">Customer Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-navy-900 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full px-3 py-2 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-navy-900 mb-1">Time (24h) *</label>
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
                    Number of Garments: <strong>{newGarments}</strong>
                    <span className="text-primary-500 font-normal">
                      {" "}
                      (Calculated duration: {calculateAppointmentDuration(newGarments, settings)} mins)
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
                    <span>1 garment</span>
                    <span>{settings.maxGarments || 10} garments</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-navy-900 mb-1">Notes / Instructions</label>
                  <textarea
                    rows={2}
                    placeholder="Specific questions, suits, or rush request..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-primary-300 rounded-xl text-primary-700 hover:bg-primary-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingNewApt}
                    className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                  >
                    {savingNewApt ? "Saving..." : "Confirm Booking"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Appointment Settings Modal / Drawer ── */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
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
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-primary-600 mb-1 font-medium">Minutes per Garment (4+)</label>
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
                        value={settings.bufferMinutes || 5}
                        onChange={(e) =>
                          setSettings({ ...settings, bufferMinutes: parseInt(e.target.value, 10) || 0 })
                        }
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
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
