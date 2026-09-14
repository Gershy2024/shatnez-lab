"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar, 
  Package, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Flame, 
  ShieldCheck, 
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { Order, OrderStatus } from "@/lib/db";

interface OrderAnalyticsProps {
  orders: Order[];
  isRtl: boolean;
}

type TimeRange = "7d" | "14d" | "30d" | "90d" | "month" | "all";

interface TrendPoint {
  key: string;
  label: string;
  subLabel?: string;
  count: number;
  dateObj?: Date;
  statusBreakdown?: Record<string, number>;
}

export default function OrderAnalytics({ orders, isRtl }: OrderAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [hoveredPoint, setHoveredPoint] = useState<TrendPoint | null>(null);

  // Helper to parse order date safely
  const parseOrderDate = (order: Order): Date | null => {
    if (order.createdAt && typeof order.createdAt === "number") {
      const d = new Date(order.createdAt);
      if (!isNaN(d.getTime())) return d;
    }
    if (order.dateReceived) {
      // If formatted as YYYY-MM-DD
      const parts = order.dateReceived.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) return date;
      }
      const parsed = new Date(order.dateReceived);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };

  // Helper to format date in short locale
  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Current time & boundaries
  const now = useMemo(() => new Date(), []);
  
  // Calculate analytics data based on time range
  const {
    currentOrders,
    previousOrders,
    trendPoints,
    growthRate,
    avgOrdersPerDay,
    peakPoint,
    statusCounts,
    resultCounts,
    dayOfWeekDistribution,
    shatnezDetectionRate,
    completionRate,
    avgTurnaroundDays
  }: {
    currentOrders: Order[];
    previousOrders: Order[];
    trendPoints: TrendPoint[];
    growthRate: number | null;
    avgOrdersPerDay: string;
    peakPoint: TrendPoint | null;
    statusCounts: Record<OrderStatus, number>;
    resultCounts: { clean: number; shatnezFound: number; callToDiscuss: number; pendingResult: number };
    dayOfWeekDistribution: number[];
    shatnezDetectionRate: number;
    completionRate: number;
    avgTurnaroundDays: string;
  } = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    let daysInRange = 30;
    if (timeRange === "7d") daysInRange = 7;
    else if (timeRange === "14d") daysInRange = 14;
    else if (timeRange === "30d") daysInRange = 30;
    else if (timeRange === "90d") daysInRange = 90;
    else if (timeRange === "month") daysInRange = 180; // 6 months
    else if (timeRange === "all") daysInRange = 365; // up to full year or all

    const currentPeriodStart = new Date(today.getTime() - (daysInRange * 24 * 60 * 60 * 1000));
    currentPeriodStart.setHours(0, 0, 0, 0);

    const previousPeriodStart = new Date(currentPeriodStart.getTime() - (daysInRange * 24 * 60 * 60 * 1000));
    const previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);

    const currentPeriodOrders: Order[] = [];
    const previousPeriodOrders: Order[] = [];

    // Categorize orders into periods
    orders.forEach((ord) => {
      const d = parseOrderDate(ord);
      if (!d) return;

      if (timeRange === "all") {
        currentPeriodOrders.push(ord);
      } else {
        if (d >= currentPeriodStart && d <= today) {
          currentPeriodOrders.push(ord);
        } else if (d >= previousPeriodStart && d <= previousPeriodEnd) {
          previousPeriodOrders.push(ord);
        }
      }
    });

    // Growth Rate calculation
    let growth: number | null = null;
    if (timeRange !== "all") {
      const curCount = currentPeriodOrders.length;
      const prevCount = previousPeriodOrders.length;
      if (prevCount === 0) {
        growth = curCount > 0 ? 100 : 0;
      } else {
        growth = Math.round(((curCount - prevCount) / prevCount) * 100);
      }
    }

    // Build trend points depending on range
    const points: TrendPoint[] = [];

    if (timeRange === "7d" || timeRange === "14d" || timeRange === "30d") {
      // Day by day buckets
      const countMap: Record<string, { count: number; date: Date; statuses: Record<string, number> }> = {};
      
      for (let i = daysInRange - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
        const key = formatDateKey(d);
        countMap[key] = { count: 0, date: d, statuses: {} };
      }

      currentPeriodOrders.forEach((ord) => {
        const d = parseOrderDate(ord);
        if (!d) return;
        const key = formatDateKey(d);
        if (countMap[key]) {
          countMap[key].count++;
          countMap[key].statuses[ord.status] = (countMap[key].statuses[ord.status] || 0) + 1;
        }
      });

      const dayNamesHe = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
      const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      Object.entries(countMap).forEach(([k, item]) => {
        const d = item.date;
        const monthNum = d.getMonth() + 1;
        const dayNum = d.getDate();
        const dayOfWeek = d.getDay();
        const shortDay = isRtl ? dayNamesHe[dayOfWeek] : dayNamesEn[dayOfWeek];

        points.push({
          key: k,
          label: `${dayNum}/${monthNum}`,
          subLabel: shortDay,
          count: item.count,
          dateObj: d,
          statusBreakdown: item.statuses
        });
      });
    } else {
      // Group by Week or Month for 90d, month, all
      const groupMap: Record<string, { label: string; subLabel: string; count: number; date: Date; statuses: Record<string, number> }> = {};

      if (timeRange === "90d") {
        // Group by weeks
        const weeksCount = 12;
        for (let i = weeksCount - 1; i >= 0; i--) {
          const wEnd = new Date(today.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
          const wStart = new Date(wEnd.getTime() - (6 * 24 * 60 * 60 * 1000));
          const key = `w_${i}`;
          const label = `${wStart.getDate()}/${wStart.getMonth() + 1} - ${wEnd.getDate()}/${wEnd.getMonth() + 1}`;
          const subLabel = isRtl ? `שבוע ${weeksCount - i}` : `Wk ${weeksCount - i}`;
          groupMap[key] = { label, subLabel, count: 0, date: wEnd, statuses: {} };
        }

        currentPeriodOrders.forEach((ord) => {
          const d = parseOrderDate(ord);
          if (!d) return;
          const diffDays = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
          const weekIdx = Math.floor(diffDays / 7);
          const key = `w_${weekIdx}`;
          if (groupMap[key]) {
            groupMap[key].count++;
            groupMap[key].statuses[ord.status] = (groupMap[key].statuses[ord.status] || 0) + 1;
          }
        });
      } else {
        // Group by months
        const monthNamesHe = ["ינו'", "פבר'", "מרץ", "אפר'", "מאי", "יוני", "יולי", "אוג'", "ספט'", "אוק'", "נוב'", "דצמ'"];
        const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        const numMonths = timeRange === "month" ? 6 : 12;
        for (let i = numMonths - 1; i >= 0; i--) {
          const target = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const y = target.getFullYear();
          const m = target.getMonth();
          const key = `${y}-${m}`;
          const label = isRtl ? `${monthNamesHe[m]} ${y !== today.getFullYear() ? `'${String(y).slice(2)}` : ''}` : `${monthNamesEn[m]} ${y !== today.getFullYear() ? `'${String(y).slice(2)}` : ''}`;
          groupMap[key] = { label, subLabel: String(y), count: 0, date: target, statuses: {} };
        }

        currentPeriodOrders.forEach((ord) => {
          const d = parseOrderDate(ord);
          if (!d) return;
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (groupMap[key]) {
            groupMap[key].count++;
            groupMap[key].statuses[ord.status] = (groupMap[key].statuses[ord.status] || 0) + 1;
          }
        });
      }

      Object.entries(groupMap).forEach(([k, item]) => {
        points.push({
          key: k,
          label: item.label,
          subLabel: item.subLabel,
          count: item.count,
          dateObj: item.date,
          statusBreakdown: item.statuses
        });
      });
    }

    // Peak Point
    let maxPt: TrendPoint | null = null;
    for (const pt of points) {
      if (!maxPt || pt.count > maxPt.count) {
        maxPt = pt;
      }
    }

    // Average orders per day
    const effectiveDays = timeRange === "all" ? Math.max(1, Math.min(365, points.length * 30)) : daysInRange;
    const avgPerDay = (currentPeriodOrders.length / effectiveDays).toFixed(1);

    // Status counts in current period
    const statuses: Record<OrderStatus, number> = {
      received: 0,
      testing: 0,
      review: 0,
      ready: 0,
      delivered: 0,
      issue: 0,
    };

    // Result counts
    let clean = 0;
    let shatnezFound = 0;
    let callToDiscuss = 0;
    let pendingResult = 0;

    // Day of week distribution (0 = Sun, 6 = Sat)
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];

    // Turnaround days calculation
    let totalTurnaroundDays = 0;
    let completedOrdersCount = 0;

    currentPeriodOrders.forEach((ord) => {
      if (statuses[ord.status] !== undefined) {
        statuses[ord.status]++;
      }

      // Check results
      const res = ord.result || "";
      if (res.includes("Clean") || res.includes("נקי") || res.includes("כשר")) {
        clean++;
      } else if (res.includes("Shatnez Found") || res.includes("שעטנז")) {
        shatnezFound++;
      } else if (res.includes("Call") || res.includes("טלפון") || res.includes("בירור")) {
        callToDiscuss++;
      } else {
        pendingResult++;
      }

      // Day of week
      const d = parseOrderDate(ord);
      if (d) {
        dowCounts[d.getDay()]++;
      }

      // Turnaround (if completed/delivered and estimatedCompletion or createdAt)
      if (ord.status === "ready" || ord.status === "delivered") {
        completedOrdersCount++;
        if (ord.dateReceived && ord.estimatedCompletion) {
          const rec = new Date(ord.dateReceived).getTime();
          const est = new Date(ord.estimatedCompletion).getTime();
          if (!isNaN(rec) && !isNaN(est) && est >= rec) {
            totalTurnaroundDays += Math.round((est - rec) / (24 * 60 * 60 * 1000));
          } else {
            totalTurnaroundDays += 2; // Default 2 days benchmark
          }
        } else {
          totalTurnaroundDays += 2;
        }
      }
    });

    const totalOrdersCount = currentPeriodOrders.length;
    const totalTested = clean + shatnezFound + callToDiscuss;
    const shatnezPct = totalTested > 0 ? Math.round((shatnezFound / totalTested) * 100) : 0;
    const compPct = totalOrdersCount > 0 ? Math.round(((statuses.ready + statuses.delivered) / totalOrdersCount) * 100) : 0;
    const avgTurnaround = completedOrdersCount > 0 ? (totalTurnaroundDays / completedOrdersCount).toFixed(1) : "—";

    const peakPointResult: TrendPoint | null = (maxPt && (maxPt as TrendPoint).count > 0) ? maxPt : null;

    return {
      currentOrders: currentPeriodOrders,
      previousOrders: previousPeriodOrders,
      trendPoints: points,
      growthRate: growth,
      avgOrdersPerDay: avgPerDay,
      peakPoint: peakPointResult,
      statusCounts: statuses,
      resultCounts: { clean, shatnezFound, callToDiscuss, pendingResult },
      dayOfWeekDistribution: dowCounts,
      shatnezDetectionRate: shatnezPct,
      completionRate: compPct,
      avgTurnaroundDays: avgTurnaround
    };
  }, [orders, timeRange, now, isRtl]);

  // Max value for chart scaling
  const maxChartValue = useMemo(() => {
    const highest = Math.max(...trendPoints.map(p => p.count), 0);
    return highest === 0 ? 5 : Math.ceil(highest * 1.2);
  }, [trendPoints]);

  // Day names for Day of Week heatmap
  const dowLabels = useMemo(() => {
    return isRtl 
      ? ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  }, [isRtl]);

  const maxDowCount = Math.max(...dayOfWeekDistribution, 1);

  return (
    <div className="space-y-6">
      {/* Top Banner & Time Range Controls */}
      <div className="card p-6 bg-white border border-primary-200 shadow-sm">
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${isRtl ? "md:flex-row-reverse" : ""}`}>
          <div className={`space-y-1 ${isRtl ? "text-right" : "text-left"}`}>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-sm">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-navy-900">
                  {isRtl ? "ניתוח מגמות וקצב הזמנות" : "Order Trends & Flow Analytics"}
                </h2>
                <p className="text-xs text-primary-500 mt-0.5">
                  {isRtl 
                    ? "מעקב דינמי אחר היקף כניסת הזמנות, קצב עבודה, עומסים לאורך זמן ושיעור איתור שעטנז"
                    : "Real-time tracking of order intake volume, processing pace, day-of-week demand, and shatnez detection"}
                </p>
              </div>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 self-start md:self-auto overflow-x-auto max-w-full">
            {[
              { id: "7d", labelHe: "7 ימים", labelEn: "7 Days" },
              { id: "14d", labelHe: "14 ימים", labelEn: "14 Days" },
              { id: "30d", labelHe: "30 ימים", labelEn: "30 Days" },
              { id: "90d", labelHe: "3 חודשים", labelEn: "3 Months" },
              { id: "month", labelHe: "חצי שנתי", labelEn: "6 Months" },
              { id: "all", labelHe: "כל הזמנים", labelEn: "All Time" },
            ].map((tab) => {
              const active = timeRange === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTimeRange(tab.id as TimeRange)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? "bg-white text-navy-950 shadow-sm border border-slate-200/70"
                      : "text-slate-600 hover:text-navy-900 hover:bg-slate-200/60"
                  }`}
                >
                  {isRtl ? tab.labelHe : tab.labelEn}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Orders & Trend */}
        <div className="card p-5 bg-white border border-primary-150 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                {isRtl ? "הזמנות בתקופה" : "Total In Period"}
              </span>
              <div className="text-3xl font-black text-navy-900 font-mono">
                {currentOrders.length}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs ${isRtl ? "flex-row-reverse" : ""}`}>
            {growthRate !== null ? (
              growthRate > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  +{growthRate}%
                </span>
              ) : growthRate < 0 ? (
                <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  {growthRate}%
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-slate-500 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                  <Minus className="w-3 h-3" />
                  0%
                </span>
              )
            ) : null}
            <span className="text-[11px] text-primary-400">
              {timeRange === "all" 
                ? (isRtl ? "מתחילת הפעילות" : "Since inception")
                : (isRtl ? "לעומת התקופה הקודמת" : "vs previous period")}
            </span>
          </div>
        </div>

        {/* Daily Velocity */}
        <div className="card p-5 bg-white border border-primary-150 shadow-sm relative overflow-hidden group hover:border-sky-300 transition-all">
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                {isRtl ? "קצב יומי ממוצע" : "Daily Velocity"}
              </span>
              <div className="text-3xl font-black text-navy-900 font-mono">
                {avgOrdersPerDay}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-primary-400 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px]">
              {isRtl ? "בממוצע הזמנות ליום" : "avg orders per day"}
            </span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="card p-5 bg-white border border-primary-150 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                {isRtl ? "שיעור השלמה ומסירה" : "Completion Rate"}
              </span>
              <div className="text-3xl font-black text-emerald-600 font-mono">
                {completionRate}%
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-primary-400 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="text-[11px]">
              {isRtl 
                ? `${statusCounts.ready + statusCounts.delivered} מתוך ${currentOrders.length} הושלמו`
                : `${statusCounts.ready + statusCounts.delivered} of ${currentOrders.length} ready/delivered`}
            </span>
          </div>
        </div>

        {/* Turnaround Time */}
        <div className="card p-5 bg-white border border-primary-150 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                {isRtl ? "משך בדיקה ממוצע" : "Avg Turnaround"}
              </span>
              <div className="text-3xl font-black text-navy-900 font-mono">
                {avgTurnaroundDays} <span className="text-sm font-normal text-slate-500">{isRtl ? "ימים" : "days"}</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-primary-400 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="text-[11px]">
              {isRtl ? "מקבלת הבגד ועד סיום הבדיקה" : "from intake to completion"}
            </span>
          </div>
        </div>

        {/* Shatnez Detection Rate */}
        <div className="card p-5 bg-white border border-primary-150 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-all">
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                {isRtl ? "שיעור גילוי שעטנז" : "Shatnez Detected"}
              </span>
              <div className={`text-3xl font-black font-mono ${resultCounts.shatnezFound > 0 ? "text-rose-600" : "text-navy-900"}`}>
                {shatnezDetectionRate}%
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-primary-400 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="text-[11px]">
              {isRtl 
                ? `${resultCounts.shatnezFound} נמצא שעטנז • ${resultCounts.clean} כשר/נקי`
                : `${resultCounts.shatnezFound} found • ${resultCounts.clean} clean`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Chart Section */}
      <div className="card p-6 bg-white border border-primary-200 shadow-sm">
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-100 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
          <div className={isRtl ? "text-right" : "text-left"}>
            <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500" />
              {isRtl ? "גרף מגמת קבלת הזמנות לאורך זמן" : "Order Intake Trend & Volume Flow"}
            </h3>
            <p className="text-xs text-primary-500 mt-0.5">
              {isRtl 
                ? "העבר את העכבר מעל העמודות כדי לצפות בפרטי כל יום או תקופה"
                : "Hover over any bar or point to inspect detailed volume for that period"}
            </p>
          </div>

          {peakPoint ? (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold ${isRtl ? "flex-row-reverse" : ""}`}>
              <Flame className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {isRtl 
                  ? `יום שיא: ${(peakPoint as TrendPoint).label} (${(peakPoint as TrendPoint).count} הזמנות)`
                  : `Peak day: ${(peakPoint as TrendPoint).label} (${(peakPoint as TrendPoint).count} orders)`}
              </span>
            </div>
          ) : null}
        </div>

        {/* Visual Bar & Area Chart Container */}
        <div className="relative pt-6 pb-2">
          {trendPoints.length === 0 ? (
            <div className="py-16 text-center text-primary-400 text-sm">
              {isRtl ? "אין נתוני הזמנות להצגה בתקופה שנבחרה" : "No orders found in the selected time range"}
            </div>
          ) : (
            <div>
              {/* Chart Grid Lines & Benchmarks */}
              <div className="relative h-64 w-full flex items-end gap-1 sm:gap-2 px-2">
                {/* Horizontal reference lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                  <div className="border-b border-dashed border-slate-200 w-full flex justify-between text-[10px] text-slate-400">
                    <span>{maxChartValue}</span>
                  </div>
                  <div className="border-b border-dashed border-slate-200 w-full flex justify-between text-[10px] text-slate-400">
                    <span>{Math.round(maxChartValue * 0.5)}</span>
                  </div>
                  <div className="border-b border-slate-200 w-full flex justify-between text-[10px] text-slate-400">
                    <span>0</span>
                  </div>
                </div>

                {/* Bars */}
                {trendPoints.map((pt, idx) => {
                  const heightPercent = maxChartValue > 0 ? (pt.count / maxChartValue) * 100 : 0;
                  const isPeak = peakPoint && peakPoint.key === pt.key && pt.count > 0;
                  const isHovered = hoveredPoint?.key === pt.key;

                  return (
                    <div
                      key={pt.key}
                      className="relative flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(pt)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      {/* Top value label on hover or peak */}
                      <div className={`absolute -top-7 text-[11px] font-bold transition-all ${
                        isHovered 
                          ? "opacity-100 scale-110 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shadow-sm border border-amber-200 z-20" 
                          : pt.count > 0 
                            ? "opacity-60 text-slate-600 hidden sm:block" 
                            : "opacity-0"
                      }`}>
                        {pt.count}
                      </div>

                      {/* Bar fill */}
                      <motion.div
                        className={`w-full max-w-[36px] rounded-t-lg transition-colors relative overflow-hidden ${
                          isPeak
                            ? "bg-gradient-to-t from-amber-500 to-amber-400 shadow-sm"
                            : isHovered
                              ? "bg-sky-500 shadow-sm"
                              : pt.count > 0
                                ? "bg-slate-300 hover:bg-slate-400"
                                : "bg-slate-100 hover:bg-slate-200"
                        }`}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(heightPercent, pt.count > 0 ? 6 : 2)}%` }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: idx * 0.015 }}
                      >
                        {/* Shimmer on peak bar */}
                        {isPeak && (
                          <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
                        )}
                      </motion.div>

                      {/* X-axis label */}
                      <div className="mt-2 text-center select-none">
                        <div className={`text-[10px] sm:text-[11px] font-mono leading-tight ${
                          isHovered ? "font-bold text-amber-700" : "text-slate-500"
                        }`}>
                          {pt.label}
                        </div>
                        {pt.subLabel && (
                          <div className="text-[9px] text-slate-400 hidden sm:block">
                            {pt.subLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hover Tooltip Popup Card */}
              <AnimatePresence>
                {hoveredPoint && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className={`mt-4 p-3 rounded-xl bg-navy-950 text-white shadow-xl flex items-center justify-between text-xs ${
                      isRtl ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}>
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold font-mono">
                        {hoveredPoint.count}
                      </div>
                      <div>
                        <div className="font-bold text-white">
                          {isRtl ? `תאריך: ${hoveredPoint.label}` : `Date: ${hoveredPoint.label}`}
                          {hoveredPoint.subLabel && ` (${hoveredPoint.subLabel})`}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          {isRtl 
                            ? `${hoveredPoint.count} הזמנות התקבלו לטיפול במעבדה`
                            : `${hoveredPoint.count} orders registered at the lab`}
                        </div>
                      </div>
                    </div>

                    {hoveredPoint.statusBreakdown && Object.keys(hoveredPoint.statusBreakdown).length > 0 && (
                      <div className={`flex items-center gap-2 text-[11px] ${isRtl ? "flex-row-reverse" : ""}`}>
                        {Object.entries(hoveredPoint.statusBreakdown).map(([st, cnt]) => (
                          <span key={st} className="px-2 py-0.5 rounded bg-white/10 text-slate-200">
                            {st}: {cnt}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Grid: Pipeline Flow & Day of Week Demand */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status Pipeline Funnel - "איך ההזמנות מתקדמות" */}
        <div className="lg:col-span-7 card p-6 bg-white border border-primary-200 shadow-sm">
          <div className={`flex items-center justify-between mb-4 pb-2 border-b border-primary-100 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className={isRtl ? "text-right" : "text-left"}>
              <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-500" />
                {isRtl ? "צנרת שלבי הטיפול בהזמנות" : "Order Workflow Pipeline"}
              </h3>
              <p className="text-xs text-primary-500">
                {isRtl ? "פילוח התקדמות כלל ההזמנות שנרשמו בתקופה" : "Breakdown of order progress across lifecycle stages"}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {currentOrders.length} {isRtl ? "סך הכל" : "Total"}
            </span>
          </div>

          <div className="space-y-4">
            {[
              {
                id: "received",
                labelHe: "התקבל במעבדה (חדש)",
                labelEn: "Received (Intake)",
                count: statusCounts.received,
                color: "bg-slate-500",
                badgeBg: "bg-slate-50 text-slate-700 border-slate-200"
              },
              {
                id: "testing",
                labelHe: "בבדיקה מיקרוסקופית",
                labelEn: "Microscopic Testing",
                count: statusCounts.testing,
                color: "bg-amber-500",
                badgeBg: "bg-amber-50 text-amber-700 border-amber-200"
              },
              {
                id: "review",
                labelHe: "בדיקה חוזרת / אימות מומחה",
                labelEn: "Expert Review",
                count: statusCounts.review,
                color: "bg-indigo-500",
                badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200"
              },
              {
                id: "ready",
                labelHe: "מוכן לאיסוף הלקוח",
                labelEn: "Ready for Pickup",
                count: statusCounts.ready,
                color: "bg-emerald-500",
                badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200"
              },
              {
                id: "delivered",
                labelHe: "נמסר ללקוח (הושלם)",
                labelEn: "Delivered / Handed Over",
                count: statusCounts.delivered,
                color: "bg-sky-500",
                badgeBg: "bg-sky-50 text-sky-700 border-sky-200"
              },
              {
                id: "issue",
                labelHe: "תקלה / נדרש בירור לקוח",
                labelEn: "Issue / Customer Attention",
                count: statusCounts.issue,
                color: "bg-rose-500",
                badgeBg: "bg-rose-50 text-rose-700 border-rose-200"
              }
            ].map((step) => {
              const total = currentOrders.length || 1;
              const percent = Math.round((step.count / total) * 100);

              return (
                <div key={step.id} className="space-y-1.5">
                  <div className={`flex justify-between items-center text-xs font-semibold ${isRtl ? "flex-row-reverse" : ""}`}>
                    <span className="text-navy-900">{isRtl ? step.labelHe : step.labelEn}</span>
                    <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <span className="font-mono font-bold text-slate-700">{step.count}</span>
                      <span className="text-slate-400 font-mono text-[11px]">({percent}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${step.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day of Week Demand & Results Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Day of Week Volume */}
          <div className="card p-6 bg-white border border-primary-200 shadow-sm">
            <div className={`flex items-center justify-between mb-4 pb-2 border-b border-primary-100 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div className={isRtl ? "text-right" : "text-left"}>
                <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  {isRtl ? "עומסים לפי ימי השבוע" : "Day-of-Week Influx"}
                </h3>
                <p className="text-xs text-primary-500">
                  {isRtl ? "באילו ימים מגיעים הכי הרבה לקוחות למעבדה" : "Days with the highest garment drop-offs"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 items-end h-32 pt-6">
              {dayOfWeekDistribution.map((cnt, idx) => {
                const heightPct = maxDowCount > 0 ? (cnt / maxDowCount) * 100 : 0;
                const isTopDay = cnt === maxDowCount && cnt > 0;

                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group">
                    <span className={`text-[10px] font-mono font-bold mb-1 transition-all ${
                      isTopDay ? "text-amber-600 scale-110" : "text-slate-400"
                    }`}>
                      {cnt}
                    </span>
                    <motion.div
                      className={`w-full max-w-[28px] rounded-t-md ${
                        isTopDay 
                          ? "bg-gradient-to-t from-amber-500 to-amber-400" 
                          : cnt > 0 
                            ? "bg-slate-300 group-hover:bg-slate-400" 
                            : "bg-slate-100"
                      }`}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(heightPct, cnt > 0 ? 8 : 4)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                    <span className={`text-[10px] mt-1 font-medium select-none ${
                      isTopDay ? "text-amber-700 font-bold" : "text-slate-500"
                    }`}>
                      {dowLabels[idx].slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={`mt-3 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2 ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}>
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                {isRtl 
                  ? "תובנה: ימי ראשון ושני מאופיינים לרוב במסירות הגבוהות ביותר לאחר שבת."
                  : "Insight: Sundays & Mondays typically experience peak drop-offs following the weekend."}
              </span>
            </div>
          </div>

          {/* Garment Testing Results Distribution */}
          <div className="card p-6 bg-white border border-primary-200 shadow-sm">
            <h3 className={`text-base font-bold text-navy-900 mb-3 pb-2 border-b border-primary-100 ${isRtl ? "text-right" : "text-left"}`}>
              {isRtl ? "התפלגות תוצאות מעבדה" : "Laboratory Results Split"}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  {resultCounts.clean}
                </div>
                <div className="text-xs font-bold text-emerald-800 mt-0.5">
                  {isRtl ? "נקי משעטנז (כשר)" : "Clean / Kosher"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-center">
                <div className="text-2xl font-black text-rose-700 font-mono">
                  {resultCounts.shatnezFound}
                </div>
                <div className="text-xs font-bold text-rose-800 mt-0.5">
                  {isRtl ? "נמצא שעטנז!" : "Shatnez Found"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                <div className="text-2xl font-black text-amber-700 font-mono">
                  {resultCounts.callToDiscuss}
                </div>
                <div className="text-xs font-bold text-amber-800 mt-0.5">
                  {isRtl ? "לבירור עם לקוח" : "Call to Discuss"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div className="text-2xl font-black text-slate-700 font-mono">
                  {resultCounts.pendingResult}
                </div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  {isRtl ? "ממתין לבדיקה" : "Pending Inspection"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
