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
  BarChart3,
  Zap,
  Radio,
  Sliders,
  Check,
  Info
} from "lucide-react";
import { Order, OrderStatus } from "@/lib/db";

interface OrderAnalyticsProps {
  orders: Order[];
  isRtl: boolean;
}

type TimeRange = "7d" | "14d" | "30d" | "90d" | "month" | "all";
type ChartMode = "spline" | "throughput" | "breakdown" | "bars";

interface TrendPoint {
  key: string;
  label: string;
  subLabel?: string;
  count: number;
  completedCount: number;
  shatnezCount: number;
  cleanCount: number;
  cumulativeIntake: number;
  cumulativeCompleted: number;
  dateObj?: Date;
  statusBreakdown?: Record<string, number>;
}

// Cubic Bézier spline generator for buttery smooth charts
function getSplinePath(points: { x: number; y: number }[], baseY: number = 250): { pathD: string; areaD: string } {
  if (!points || points.length === 0) return { pathD: "", areaD: "" };
  if (points.length === 1) {
    const pt = points[0];
    return {
      pathD: `M ${pt.x},${pt.y}`,
      areaD: `M ${pt.x},${pt.y} L ${pt.x},${baseY} L ${pt.x},${baseY} Z`,
    };
  }

  let pathD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  const startX = points[0].x.toFixed(1);
  const endX = points[points.length - 1].x.toFixed(1);
  const areaD = `${pathD} L ${endX},${baseY} L ${startX},${baseY} Z`;

  return { pathD, areaD };
}

export default function OrderAnalytics({ orders, isRtl }: OrderAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [chartMode, setChartMode] = useState<ChartMode>("spline");
  const [hoveredPoint, setHoveredPoint] = useState<TrendPoint | null>(null);
  const [showAverageLine, setShowAverageLine] = useState(true);

  // Helper to parse order date safely
  const parseOrderDate = (order: Order): Date | null => {
    if (order.createdAt && typeof order.createdAt === "number") {
      const d = new Date(order.createdAt);
      if (!isNaN(d.getTime())) return d;
    }
    if (order.dateReceived) {
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

  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const now = useMemo(() => new Date(), []);
  
  // Calculate analytics data
  const {
    currentOrders,
    trendPoints,
    growthRate,
    avgOrdersPerDay,
    peakPoint,
    statusCounts,
    resultCounts,
    dayOfWeekDistribution,
    shatnezDetectionRate,
    completionRate,
    avgTurnaroundDays,
    agingOrdersCount,
    activeBacklogCount
  } = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    let daysInRange = 30;
    if (timeRange === "7d") daysInRange = 7;
    else if (timeRange === "14d") daysInRange = 14;
    else if (timeRange === "30d") daysInRange = 30;
    else if (timeRange === "90d") daysInRange = 90;
    else if (timeRange === "month") daysInRange = 180;
    else if (timeRange === "all") daysInRange = 365;

    const currentPeriodStart = new Date(today.getTime() - (daysInRange * 24 * 60 * 60 * 1000));
    currentPeriodStart.setHours(0, 0, 0, 0);

    const previousPeriodStart = new Date(currentPeriodStart.getTime() - (daysInRange * 24 * 60 * 60 * 1000));
    const previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);

    const currentPeriodOrders: Order[] = [];
    const previousPeriodOrders: Order[] = [];

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

    // Growth Rate
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

    // Build trend points with cumulative & result tracking
    const rawPoints: Omit<TrendPoint, "cumulativeIntake" | "cumulativeCompleted">[] = [];

    if (timeRange === "7d" || timeRange === "14d" || timeRange === "30d") {
      const countMap: Record<string, { 
        count: number; 
        completedCount: number;
        shatnezCount: number;
        cleanCount: number;
        date: Date; 
        statuses: Record<string, number> 
      }> = {};
      
      for (let i = daysInRange - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
        const key = formatDateKey(d);
        countMap[key] = { count: 0, completedCount: 0, shatnezCount: 0, cleanCount: 0, date: d, statuses: {} };
      }

      currentPeriodOrders.forEach((ord) => {
        const d = parseOrderDate(ord);
        if (!d) return;
        const key = formatDateKey(d);
        if (countMap[key]) {
          countMap[key].count++;
          countMap[key].statuses[ord.status] = (countMap[key].statuses[ord.status] || 0) + 1;
          if (ord.status === "ready" || ord.status === "delivered") {
            countMap[key].completedCount++;
          }
          const res = ord.result || "";
          if (res.includes("Shatnez Found") || res.includes("שעטנז")) {
            countMap[key].shatnezCount++;
          } else if (res.includes("Clean") || res.includes("נקי") || res.includes("כשר")) {
            countMap[key].cleanCount++;
          }
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

        rawPoints.push({
          key: k,
          label: `${dayNum}/${monthNum}`,
          subLabel: shortDay,
          count: item.count,
          completedCount: item.completedCount,
          shatnezCount: item.shatnezCount,
          cleanCount: item.cleanCount,
          dateObj: d,
          statusBreakdown: item.statuses
        });
      });
    } else {
      const groupMap: Record<string, { 
        label: string; 
        subLabel: string; 
        count: number; 
        completedCount: number;
        shatnezCount: number;
        cleanCount: number;
        date: Date; 
        statuses: Record<string, number> 
      }> = {};

      if (timeRange === "90d") {
        const weeksCount = 12;
        for (let i = weeksCount - 1; i >= 0; i--) {
          const wEnd = new Date(today.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
          const wStart = new Date(wEnd.getTime() - (6 * 24 * 60 * 60 * 1000));
          const key = `w_${i}`;
          const label = `${wStart.getDate()}/${wStart.getMonth() + 1} - ${wEnd.getDate()}/${wEnd.getMonth() + 1}`;
          const subLabel = isRtl ? `שבוע ${weeksCount - i}` : `Wk ${weeksCount - i}`;
          groupMap[key] = { label, subLabel, count: 0, completedCount: 0, shatnezCount: 0, cleanCount: 0, date: wEnd, statuses: {} };
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
            if (ord.status === "ready" || ord.status === "delivered") {
              groupMap[key].completedCount++;
            }
            const res = ord.result || "";
            if (res.includes("Shatnez Found") || res.includes("שעטנז")) {
              groupMap[key].shatnezCount++;
            } else if (res.includes("Clean") || res.includes("נקי") || res.includes("כשר")) {
              groupMap[key].cleanCount++;
            }
          }
        });
      } else {
        const monthNamesHe = ["ינו'", "פבר'", "מרץ", "אפר'", "מאי", "יוני", "יולי", "אוג'", "ספט'", "אוק'", "נוב'", "דצמ'"];
        const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        const numMonths = timeRange === "month" ? 6 : 12;
        for (let i = numMonths - 1; i >= 0; i--) {
          const target = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const y = target.getFullYear();
          const m = target.getMonth();
          const key = `${y}-${m}`;
          const label = isRtl ? `${monthNamesHe[m]} ${y !== today.getFullYear() ? `'${String(y).slice(2)}` : ''}` : `${monthNamesEn[m]} ${y !== today.getFullYear() ? `'${String(y).slice(2)}` : ''}`;
          groupMap[key] = { label, subLabel: String(y), count: 0, completedCount: 0, shatnezCount: 0, cleanCount: 0, date: target, statuses: {} };
        }

        currentPeriodOrders.forEach((ord) => {
          const d = parseOrderDate(ord);
          if (!d) return;
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (groupMap[key]) {
            groupMap[key].count++;
            groupMap[key].statuses[ord.status] = (groupMap[key].statuses[ord.status] || 0) + 1;
            if (ord.status === "ready" || ord.status === "delivered") {
              groupMap[key].completedCount++;
            }
            const res = ord.result || "";
            if (res.includes("Shatnez Found") || res.includes("שעטנז")) {
              groupMap[key].shatnezCount++;
            } else if (res.includes("Clean") || res.includes("נקי") || res.includes("כשר")) {
              groupMap[key].cleanCount++;
            }
          }
        });
      }

      Object.entries(groupMap).forEach(([k, item]) => {
        rawPoints.push({
          key: k,
          label: item.label,
          subLabel: item.subLabel,
          count: item.count,
          completedCount: item.completedCount,
          shatnezCount: item.shatnezCount,
          cleanCount: item.cleanCount,
          dateObj: item.date,
          statusBreakdown: item.statuses
        });
      });
    }

    // Accumulate running cumulative totals
    let runningIntake = 0;
    let runningCompleted = 0;
    const points: TrendPoint[] = rawPoints.map(pt => {
      runningIntake += pt.count;
      runningCompleted += pt.completedCount;
      return {
        ...pt,
        cumulativeIntake: runningIntake,
        cumulativeCompleted: runningCompleted
      };
    });

    // Peak Point
    let maxPt: TrendPoint | null = null;
    for (const pt of points) {
      if (!maxPt || pt.count > maxPt.count) {
        maxPt = pt;
      }
    }

    const effectiveDays = timeRange === "all" ? Math.max(1, Math.min(365, points.length * 30)) : daysInRange;
    const avgPerDay = (currentPeriodOrders.length / effectiveDays).toFixed(1);

    const statuses: Record<OrderStatus, number> = {
      received: 0,
      testing: 0,
      review: 0,
      ready: 0,
      delivered: 0,
      issue: 0,
    };

    let clean = 0;
    let shatnezFound = 0;
    let callToDiscuss = 0;
    let pendingResult = 0;
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];
    let totalTurnaroundDays = 0;
    let completedOrdersCount = 0;
    let agingCount = 0;
    let backlog = 0;

    const twoDaysAgo = today.getTime() - (48 * 60 * 60 * 1000);

    currentPeriodOrders.forEach((ord) => {
      if (statuses[ord.status] !== undefined) {
        statuses[ord.status]++;
      }

      if (ord.status === "received" || ord.status === "testing" || ord.status === "review") {
        backlog++;
        const d = parseOrderDate(ord);
        if (d && d.getTime() < twoDaysAgo) {
          agingCount++;
        }
      }

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

      const d = parseOrderDate(ord);
      if (d) {
        dowCounts[d.getDay()]++;
      }

      if (ord.status === "ready" || ord.status === "delivered") {
        completedOrdersCount++;
        if (ord.dateReceived && ord.estimatedCompletion) {
          const rec = new Date(ord.dateReceived).getTime();
          const est = new Date(ord.estimatedCompletion).getTime();
          if (!isNaN(rec) && !isNaN(est) && est >= rec) {
            totalTurnaroundDays += Math.round((est - rec) / (24 * 60 * 60 * 1000));
          } else {
            totalTurnaroundDays += 2;
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
      trendPoints: points,
      growthRate: growth,
      avgOrdersPerDay: avgPerDay,
      peakPoint: peakPointResult,
      statusCounts: statuses,
      resultCounts: { clean, shatnezFound, callToDiscuss, pendingResult },
      dayOfWeekDistribution: dowCounts,
      shatnezDetectionRate: shatnezPct,
      completionRate: compPct,
      avgTurnaroundDays: avgTurnaround,
      agingOrdersCount: agingCount,
      activeBacklogCount: backlog
    };
  }, [orders, timeRange, now, isRtl]);

  // Dimensions & scaling for SVG charts (1000 x 300 viewBox)
  const svgWidth = 1000;
  const svgHeight = 280;
  const padLeft = 45;
  const padRight = 35;
  const padTop = 35;
  const padBottom = 45;
  const chartInnerWidth = svgWidth - padLeft - padRight;
  const chartInnerHeight = svgHeight - padTop - padBottom;

  // Scaling values based on current active chart mode
  const maxVolume = useMemo(() => {
    if (chartMode === "throughput") {
      const highest = Math.max(...trendPoints.map(p => Math.max(p.cumulativeIntake, p.cumulativeCompleted)), 0);
      return highest === 0 ? 5 : Math.ceil(highest * 1.15);
    }
    const highest = Math.max(...trendPoints.map(p => p.count), 0);
    return highest === 0 ? 5 : Math.ceil(highest * 1.25);
  }, [trendPoints, chartMode]);

  // Compute SVG coordinates for each point
  const chartCoords = useMemo(() => {
    const N = trendPoints.length;
    if (N === 0) return { splinePoints: [], completedSplinePoints: [], shatnezSplinePoints: [] };

    const getX = (idx: number) => N === 1 ? svgWidth / 2 : padLeft + (idx / (N - 1)) * chartInnerWidth;
    const getY = (val: number) => (padTop + chartInnerHeight) - (val / (maxVolume || 1)) * chartInnerHeight;

    const splinePoints = trendPoints.map((pt, idx) => ({
      x: getX(idx),
      y: getY(chartMode === "throughput" ? pt.cumulativeIntake : pt.count),
      pt
    }));

    const completedSplinePoints = trendPoints.map((pt, idx) => ({
      x: getX(idx),
      y: getY(chartMode === "throughput" ? pt.cumulativeCompleted : pt.completedCount),
      pt
    }));

    const shatnezSplinePoints = trendPoints.map((pt, idx) => ({
      x: getX(idx),
      y: getY(pt.shatnezCount),
      pt
    }));

    return { splinePoints, completedSplinePoints, shatnezSplinePoints };
  }, [trendPoints, maxVolume, chartMode, chartInnerWidth, chartInnerHeight]);

  // Generate SVG spline paths
  const mainPath = useMemo(() => {
    return getSplinePath(chartCoords.splinePoints, padTop + chartInnerHeight);
  }, [chartCoords.splinePoints, padTop, chartInnerHeight]);

  const completedPath = useMemo(() => {
    return getSplinePath(chartCoords.completedSplinePoints, padTop + chartInnerHeight);
  }, [chartCoords.completedSplinePoints, padTop, chartInnerHeight]);

  // Average line calculation in SVG Y
  const avgValNumber = parseFloat(avgOrdersPerDay) || 0;
  const avgLineY = (padTop + chartInnerHeight) - (avgValNumber / (maxVolume || 1)) * chartInnerHeight;

  // Day names for Day of Week heatmap
  const dowLabels = useMemo(() => {
    return isRtl 
      ? ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  }, [isRtl]);

  const maxDowCount = Math.max(...dayOfWeekDistribution, 1);

  // Speedometer calculation (0 to 100% completion / capacity)
  const gaugePercent = Math.min(100, Math.max(0, completionRate));
  const gaugeRadius = 70;
  const gaugeCircumference = Math.PI * gaugeRadius; // Semi-circle
  const gaugeOffset = gaugeCircumference - (gaugePercent / 100) * gaugeCircumference;

  return (
    <div className="space-y-6">
      {/* Dramatic Top Command Bar */}
      <div className="card p-6 bg-gradient-to-r from-slate-900 via-navy-900 to-slate-900 text-white border border-slate-700/80 shadow-2xl relative overflow-hidden">
        {/* Glow accents */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-sky-500/10 blur-3xl pointer-events-none" />

        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10 ${isRtl ? "lg:flex-row-reverse" : ""}`}>
          <div className={`space-y-1.5 ${isRtl ? "text-right" : "text-left"}`}>
            <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20">
                  <Activity className="w-6 h-6 animate-pulse" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
                </span>
              </div>
              <div>
                <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <h2 className="text-2xl font-black tracking-tight text-white">
                    {isRtl ? "חדר בקרה ואנליטיקה מתקדמת" : "Executive Analytics & Command Hub"}
                  </h2>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-light mt-0.5">
                  {isRtl 
                    ? "ניתוח בזמן אמת של זרימת פריטים, עומסי מעבדה, קצב בדיקה ושיעורי איתור שעטנז"
                    : "Real-time telemetry of garment throughput, lab backlog, inspection pace, and detection density"}
                </p>
              </div>
            </div>
          </div>

          {/* Time Range Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-950/70 backdrop-blur-md rounded-2xl border border-slate-700/80 self-start lg:self-auto overflow-x-auto max-w-full">
            {[
              { id: "7d", labelHe: "7 ימים", labelEn: "7 Days" },
              { id: "14d", labelHe: "14 ימים", labelEn: "14 Days" },
              { id: "30d", labelHe: "30 ימים", labelEn: "30 Days" },
              { id: "90d", labelHe: "רבעון", labelEn: "90 Days" },
              { id: "month", labelHe: "חצי שנה", labelEn: "6 Mos" },
              { id: "all", labelHe: "הכל", labelEn: "All Time" },
            ].map((tab) => {
              const active = timeRange === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTimeRange(tab.id as TimeRange)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {isRtl ? tab.labelHe : tab.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-time Telemetry Strip */}
        <div className={`mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs ${isRtl ? "text-right" : "text-left"}`}>
          <div>
            <div className="text-slate-400 text-[11px]">{isRtl ? "סטטוס בדיקות פעילות" : "Active Lab Backlog"}</div>
            <div className="font-mono text-base font-bold text-amber-400 mt-0.5">
              {activeBacklogCount} {isRtl ? "בגדים בתור" : "in queue"}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px]">{isRtl ? "בדיקות מעל 48 שעות" : "Delayed >48h (SLA)"}</div>
            <div className={`font-mono text-base font-bold mt-0.5 ${agingOrdersCount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {agingOrdersCount} {isRtl ? "בטיפול דחוף" : "flagged"}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px]">{isRtl ? "שיעור השלמה" : "Throughput Rate"}</div>
            <div className="font-mono text-base font-bold text-sky-400 mt-0.5">
              {completionRate}%
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px]">{isRtl ? "התראת שעטנז קריטית" : "Shatnez Detected"}</div>
            <div className={`font-mono text-base font-bold mt-0.5 ${resultCounts.shatnezFound > 0 ? "text-rose-400 flex items-center gap-1" : "text-slate-300"}`}>
              {resultCounts.shatnezFound > 0 && <AlertTriangle className="w-3.5 h-3.5 inline animate-bounce" />}
              {resultCounts.shatnezFound} {isRtl ? "מקרים אומתו" : "verified"}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Orders Card */}
        <div className="card p-5 bg-white border border-slate-200/90 hover:border-amber-400/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isRtl ? "הזמנות בתקופה" : "Total Intake"}
              </span>
              <div className="text-3xl font-black text-navy-950 font-mono tracking-tight">
                {currentOrders.length}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-600 flex items-center justify-center shrink-0">
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
            <span className="text-[11px] text-slate-400">
              {timeRange === "all" 
                ? (isRtl ? "מכלל הזמנות המעבדה" : "all-time registered")
                : (isRtl ? "לעומת התקופה הקודמת" : "vs previous window")}
            </span>
          </div>
        </div>

        {/* Velocity Card */}
        <div className="card p-5 bg-white border border-slate-200/90 hover:border-sky-400/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isRtl ? "קצב יומי ממוצע" : "Intake Velocity"}
              </span>
              <div className="text-3xl font-black text-navy-950 font-mono tracking-tight">
                {avgOrdersPerDay}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-200/70 text-sky-600 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 ${isRtl ? "flex-row-reverse" : ""}`}>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px]">
              {isRtl ? "ממוצע הזמנות ליממה" : "daily incoming rate"}
            </span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="card p-5 bg-white border border-slate-200/90 hover:border-emerald-400/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isRtl ? "שיעור השלמה ומסירה" : "Completion Rate"}
              </span>
              <div className="text-3xl font-black text-emerald-600 font-mono tracking-tight">
                {completionRate}%
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="text-[11px]">
              {isRtl 
                ? `${statusCounts.ready + statusCounts.delivered} מתוך ${currentOrders.length} מוכנים/נמסרו`
                : `${statusCounts.ready + statusCounts.delivered} of ${currentOrders.length} completed`}
            </span>
          </div>
        </div>

        {/* Turnaround Time */}
        <div className="card p-5 bg-white border border-slate-200/90 hover:border-indigo-400/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isRtl ? "זמן טיפול ממוצע" : "Avg Turnaround"}
              </span>
              <div className="text-3xl font-black text-navy-950 font-mono tracking-tight">
                {avgTurnaroundDays} <span className="text-sm font-normal text-slate-500">{isRtl ? "ימים" : "days"}</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200/70 text-indigo-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="text-[11px]">
              {isRtl ? "מקליטת הבגד ועד סיום הבדיקה" : "drop-off to verified result"}
            </span>
          </div>
        </div>

        {/* Shatnez Detection Rate */}
        <div className={`card p-5 bg-white border hover:shadow-md transition-all relative overflow-hidden group ${
          resultCounts.shatnezFound > 0 ? "border-rose-200 hover:border-rose-400" : "border-slate-200/90"
        }`}>
          <div className={`absolute top-0 right-0 w-2 h-full transition-opacity ${
            resultCounts.shatnezFound > 0 ? "bg-rose-500 opacity-100" : "bg-emerald-500 opacity-0 group-hover:opacity-100"
          }`} />
          <div className={`flex items-start justify-between ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isRtl ? "שיעור גילוי שעטנז" : "Shatnez Rate"}
              </span>
              <div className={`text-3xl font-black font-mono tracking-tight ${resultCounts.shatnezFound > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {shatnezDetectionRate}%
              </div>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              resultCounts.shatnezFound > 0 
                ? "bg-rose-50 border border-rose-200 text-rose-600 animate-pulse" 
                : "bg-emerald-50 border border-emerald-200 text-emerald-600"
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          
          <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="text-[11px]">
              {isRtl 
                ? `${resultCounts.shatnezFound} התגלו שעטנז • ${resultCounts.clean} כשרים`
                : `${resultCounts.shatnezFound} detected • ${resultCounts.clean} kosher`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Advanced Interactive Chart Section */}
      <div className="card p-6 bg-slate-950 text-white border border-slate-800 shadow-2xl rounded-2xl relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

        {/* Chart Header & Controls */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80 relative z-10 ${isRtl ? "md:flex-row-reverse" : ""}`}>
          <div className={isRtl ? "text-right" : "text-left"}>
            <div className={`flex items-center gap-2.5 ${isRtl ? "flex-row-reverse" : ""}`}>
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-black text-white tracking-wide">
                {isRtl ? "גרף גלי אינטראקטיבי וניתוח תפוקה" : "Curved Flow & Velocity Waveform"}
              </h3>
              {peakPoint && (
                <span className="text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  {isRtl ? `שיא: ${peakPoint.label} (${peakPoint.count})` : `Peak: ${peakPoint.label} (${peakPoint.count})`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isRtl 
                ? "העבר את העכבר על פני הנקודות בגרף לסריקת נפח, סוגי תוצאות וקצב עבודה מפורט"
                : "Hover across waveform nodes to inspect volume breakdown, turnaround, and status distribution"}
            </p>
          </div>

          {/* Chart Display Mode Switcher */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
              <button
                onClick={() => setChartMode("spline")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  chartMode === "spline"
                    ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{isRtl ? "שטח גלי" : "Spline Wave"}</span>
              </button>

              <button
                onClick={() => setChartMode("throughput")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  chartMode === "throughput"
                    ? "bg-sky-500 text-slate-950 font-black shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isRtl ? "כניסה מול יציאה" : "Throughput"}</span>
              </button>

              <button
                onClick={() => setChartMode("bars")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  chartMode === "bars"
                    ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{isRtl ? "עמודות" : "Columns"}</span>
              </button>
            </div>

            {/* Toggle Average Line */}
            <button
              onClick={() => setShowAverageLine(!showAverageLine)}
              className={`p-1.5 rounded-xl border text-xs font-bold transition-all hidden sm:flex items-center gap-1.5 ${
                showAverageLine
                  ? "bg-slate-800 text-amber-300 border-amber-500/30"
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
              title={isRtl ? "הצג/הסתר קו ממוצע" : "Toggle Average Guideline"}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-[11px]">{isRtl ? "קו ממוצע" : "Avg Line"}</span>
            </button>
          </div>
        </div>

        {/* Interactive SVG Chart Canvas */}
        <div className="relative w-full">
          {trendPoints.length === 0 ? (
            <div className="py-24 text-center text-slate-500 text-sm font-medium">
              {isRtl ? "אין נתוני הזמנות להצגה בתקופה שנבחרה" : "No telemetry data recorded in this period"}
            </div>
          ) : (
            <div className="relative">
              {/* Responsive SVG Container */}
              <div className="w-full overflow-hidden select-none">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-64 sm:h-72 overflow-visible"
                >
                  <defs>
                    {/* Glowing Area Gradients */}
                    <linearGradient id="amberWaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                      <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>

                    <linearGradient id="emeraldThroughputGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>

                    {/* Neon Glow Filter */}
                    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.5" />
                    </filter>

                    <filter id="neonGlowEmerald" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#10b981" floodOpacity="0.5" />
                    </filter>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = (padTop + chartInnerHeight) - pct * chartInnerHeight;
                    const val = Math.round(pct * maxVolume);
                    return (
                      <g key={i}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={svgWidth - padRight}
                          y2={y}
                          stroke="#334155"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                          strokeOpacity="0.4"
                        />
                        <text
                          x={padLeft - 10}
                          y={y + 3}
                          fill="#64748b"
                          fontSize="10"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Average Benchmark Guideline */}
                  {showAverageLine && avgValNumber > 0 && chartMode !== "throughput" && (
                    <g>
                      <line
                        x1={padLeft}
                        y1={avgLineY}
                        x2={svgWidth - padRight}
                        y2={avgLineY}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        strokeWidth="1.5"
                        strokeOpacity="0.75"
                      />
                      <text
                        x={svgWidth - padRight + 6}
                        y={avgLineY + 3}
                        fill="#f59e0b"
                        fontSize="9"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {isRtl ? `ממוצע ${avgOrdersPerDay}` : `Avg ${avgOrdersPerDay}`}
                      </text>
                    </g>
                  )}

                  {/* 1. Spline Wave Mode / Throughput Mode */}
                  {(chartMode === "spline" || chartMode === "throughput") && (
                    <>
                      {/* Secondary Throughput Fill (Completed/Delivered) */}
                      {chartMode === "throughput" && (
                        <>
                          <path
                            d={completedPath.areaD}
                            fill="url(#emeraldThroughputGradient)"
                          />
                          <path
                            d={completedPath.pathD}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            filter="url(#neonGlowEmerald)"
                          />
                        </>
                      )}

                      {/* Main Intake Area Fill & Spline Stroke */}
                      <path
                        d={mainPath.areaD}
                        fill="url(#amberWaveGradient)"
                      />
                      <path
                        d={mainPath.pathD}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="3"
                        filter="url(#neonGlow)"
                      />

                      {/* Interactive Data Point Dots */}
                      {chartCoords.splinePoints.map((pt, idx) => {
                        const isHovered = hoveredPoint?.key === pt.pt.key;
                        const isPeak = peakPoint?.key === pt.pt.key && pt.pt.count > 0;

                        return (
                          <g key={pt.pt.key} className="transition-all">
                            {/* Hover Pulse Ring */}
                            {isHovered && (
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r="12"
                                fill="#f59e0b"
                                fillOpacity="0.25"
                                className="animate-ping"
                              />
                            )}

                            {/* Outer Dot */}
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isHovered ? 6 : isPeak ? 5 : 3.5}
                              fill={isPeak ? "#fbbf24" : isHovered ? "#38bdf8" : "#f59e0b"}
                              stroke="#0f172a"
                              strokeWidth="2"
                              className="cursor-pointer transition-all duration-200"
                            />

                            {/* Secondary node if Throughput */}
                            {chartMode === "throughput" && (
                              <circle
                                cx={chartCoords.completedSplinePoints[idx]?.x || pt.x}
                                cy={chartCoords.completedSplinePoints[idx]?.y || pt.y}
                                r={isHovered ? 5 : 3}
                                fill="#10b981"
                                stroke="#0f172a"
                                strokeWidth="2"
                              />
                            )}
                          </g>
                        );
                      })}
                    </>
                  )}

                  {/* 2. Modern 3D Columns Mode */}
                  {chartMode === "bars" && (
                    <g>
                      {trendPoints.map((pt, idx) => {
                        const N = trendPoints.length;
                        const barWidth = Math.max(8, Math.min(32, chartInnerWidth / (N * 1.5)));
                        const xCenter = N === 1 ? svgWidth / 2 : padLeft + (idx / (N - 1)) * chartInnerWidth;
                        const barHeight = (pt.count / (maxVolume || 1)) * chartInnerHeight;
                        const yTop = (padTop + chartInnerHeight) - barHeight;
                        const isPeak = peakPoint?.key === pt.key && pt.count > 0;
                        const isHovered = hoveredPoint?.key === pt.key;

                        return (
                          <g key={pt.key}>
                            {/* Bar Body */}
                            <rect
                              x={xCenter - barWidth / 2}
                              y={pt.count > 0 ? yTop : padTop + chartInnerHeight - 4}
                              width={barWidth}
                              height={pt.count > 0 ? barHeight : 4}
                              rx={barWidth / 3}
                              fill={
                                isPeak
                                  ? "#f59e0b"
                                  : isHovered
                                    ? "#38bdf8"
                                    : pt.count > 0
                                      ? "#475569"
                                      : "#1e293b"
                              }
                              className="transition-colors duration-200 cursor-pointer"
                            />
                            {/* Bar Top Glowing Cap */}
                            {pt.count > 0 && (
                              <rect
                                x={xCenter - barWidth / 2}
                                y={yTop}
                                width={barWidth}
                                height={3}
                                rx={1.5}
                                fill={isPeak ? "#fef08a" : isHovered ? "#bae6fd" : "#94a3b8"}
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Laser Tracking Scanner Line on Hover */}
                  {hoveredPoint && (() => {
                    const matched = chartCoords.splinePoints.find(p => p.pt.key === hoveredPoint.key);
                    if (!matched) return null;
                    return (
                      <g>
                        <line
                          x1={matched.x}
                          y1={padTop}
                          x2={matched.x}
                          y2={padTop + chartInnerHeight}
                          stroke="#38bdf8"
                          strokeDasharray="3 3"
                          strokeWidth="1.5"
                          strokeOpacity="0.8"
                        />
                        <circle
                          cx={matched.x}
                          cy={matched.y}
                          r="5"
                          fill="#38bdf8"
                          className="animate-ping"
                        />
                      </g>
                    );
                  })()}

                  {/* X-Axis Labels */}
                  {trendPoints.map((pt, idx) => {
                    const N = trendPoints.length;
                    const x = N === 1 ? svgWidth / 2 : padLeft + (idx / (N - 1)) * chartInnerWidth;
                    const isHovered = hoveredPoint?.key === pt.key;

                    // Skip labels if too crowded on screen
                    const shouldShowLabel = N <= 14 || (idx % (N > 40 ? 5 : N > 20 ? 2 : 1) === 0) || idx === N - 1;
                    if (!shouldShowLabel) return null;

                    return (
                      <g key={pt.key} className="select-none">
                        <text
                          x={x}
                          y={padTop + chartInnerHeight + 18}
                          fill={isHovered ? "#38bdf8" : "#94a3b8"}
                          fontSize={isHovered ? "11" : "10"}
                          fontWeight={isHovered ? "bold" : "normal"}
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {pt.label}
                        </text>
                        {pt.subLabel && (
                          <text
                            x={x}
                            y={padTop + chartInnerHeight + 30}
                            fill={isHovered ? "#e2e8f0" : "#64748b"}
                            fontSize="9"
                            textAnchor="middle"
                          >
                            {pt.subLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Transparent Hover Hit Areas */}
                  {trendPoints.map((pt, idx) => {
                    const N = trendPoints.length;
                    const colWidth = chartInnerWidth / Math.max(1, N);
                    const x = N === 1 ? 0 : padLeft + (idx * colWidth) - (colWidth / 2);

                    return (
                      <rect
                        key={`hit_${pt.key}`}
                        x={x}
                        y={padTop}
                        width={colWidth}
                        height={chartInnerHeight + 40}
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Floating Glassmorphic HUD Inspector Card */}
              <AnimatePresence>
                {hoveredPoint && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className={`mt-4 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs ${
                      isRtl ? "md:flex-row-reverse" : ""
                    }`}
                  >
                    {/* Date & Volume Pillar */}
                    <div className={`flex items-center gap-3.5 ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}>
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex flex-col items-center justify-center font-bold font-mono shadow-inner">
                        <span className="text-base leading-none">{hoveredPoint.count}</span>
                        <span className="text-[9px] uppercase text-amber-300/80">{isRtl ? "הזמנות" : "orders"}</span>
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <span>{hoveredPoint.label}</span>
                          {hoveredPoint.subLabel && (
                            <span className="text-slate-400 text-xs font-normal">({hoveredPoint.subLabel})</span>
                          )}
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {isRtl 
                            ? `מתוכן הושלמו ונמסרו: ${hoveredPoint.completedCount}`
                            : `Completed & Delivered: ${hoveredPoint.completedCount}`}
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Chips */}
                    <div className={`flex items-center gap-2 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}>
                      {/* Kosher / Clean */}
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                        {isRtl ? "כשר / נקי" : "Kosher"}: {hoveredPoint.cleanCount}
                      </span>

                      {/* Shatnez Detected */}
                      {hoveredPoint.shatnezCount > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/25 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {isRtl ? "נמצא שעטנז" : "Shatnez"}: {hoveredPoint.shatnezCount}
                        </span>
                      )}

                      {/* Cumulative Metric if Throughput */}
                      {chartMode === "throughput" && (
                        <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                          {isRtl ? "מצטבר" : "Cumulative"}: {hoveredPoint.cumulativeIntake}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chart Legend Footer */}
              <div className={`mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-3 ${
                isRtl ? "flex-row-reverse" : ""
              }`}>
                <div className={`flex items-center gap-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 rounded-full bg-amber-500"></span>
                    <span>{chartMode === "throughput" ? (isRtl ? "סך כניסות מצטבר" : "Cumulative Intake") : (isRtl ? "נפח הזמנות חדשות" : "Intake Volume")}</span>
                  </div>
                  {chartMode === "throughput" && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-1 rounded-full bg-emerald-500"></span>
                      <span>{isRtl ? "סך השלמות ומסירות" : "Cumulative Completed"}</span>
                    </div>
                  )}
                  {showAverageLine && chartMode !== "throughput" && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 border-b border-dashed border-amber-400"></span>
                      <span>{isRtl ? "קו ממוצע תקופתי" : "Period Average"}</span>
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 font-mono">
                  {isRtl ? "ערכי ציר X: ימים/שבועות • ערכי ציר Y: נפח פריטים" : "X-Axis: Time Sequence • Y-Axis: Garment Count"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SLA & Backlog Critical Banner (If delays exist) */}
      {agingOrdersCount > 0 && (
        <div className={`p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-900 flex items-center justify-between gap-4 shadow-sm ${
          isRtl ? "flex-row-reverse text-right" : "text-left"
        }`}>
          <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-rose-950">
                {isRtl ? "התראת עומס: הזמנות שמתעכבות בבדיקה מעל 48 שעות" : "SLA Alert: Orders in inspection over 48 hours"}
              </div>
              <div className="text-xs text-rose-700 mt-0.5">
                {isRtl 
                  ? `נמצאו ${agingOrdersCount} פריטים שעדיין בבדיקה או ממתינים לאימות. מומלץ לתעדף אותם במעבדה.`
                  : `${agingOrdersCount} garments pending review beyond target SLA. Priority dispatch recommended.`}
              </div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-rose-200/80 text-rose-950 font-bold font-mono text-xs shrink-0">
            {agingOrdersCount} {isRtl ? "דחופים" : "flagged"}
          </span>
        </div>
      )}

      {/* Two Column Grid: Pipeline Flow & Radial Speedometer / Demand Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status Pipeline Funnel */}
        <div className="lg:col-span-7 card p-6 bg-white border border-slate-200/90 shadow-sm">
          <div className={`flex items-center justify-between mb-5 pb-3 border-b border-slate-100 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className={isRtl ? "text-right" : "text-left"}>
              <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-500" />
                {isRtl ? "צנרת שלבי הטיפול והסטטוסים" : "Order Lifecycle & Pipeline Flow"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRtl ? "התפלגות התקדמות כלל ההזמנות במחזור החיים הנוכחי" : "Live stage distribution across current period orders"}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
              {currentOrders.length} {isRtl ? "סך הכל" : "Total"}
            </span>
          </div>

          <div className="space-y-4">
            {[
              {
                id: "received",
                labelHe: "התקבל במעבדה (ממתין)",
                labelEn: "Received (Intake)",
                count: statusCounts.received,
                color: "bg-slate-500",
                badgeBg: "bg-slate-100 text-slate-700"
              },
              {
                id: "testing",
                labelHe: "בבדיקה מיקרוסקופית פעילה",
                labelEn: "Microscopic Testing",
                count: statusCounts.testing,
                color: "bg-amber-500",
                badgeBg: "bg-amber-50 text-amber-700 border border-amber-200/60"
              },
              {
                id: "review",
                labelHe: "בדיקה חוזרת / אימות מומחה",
                labelEn: "Expert Re-check",
                count: statusCounts.review,
                color: "bg-indigo-500",
                badgeBg: "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
              },
              {
                id: "ready",
                labelHe: "מוכן לאיסוף הלקוח (הושלם)",
                labelEn: "Ready for Pickup",
                count: statusCounts.ready,
                color: "bg-emerald-500",
                badgeBg: "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
              },
              {
                id: "delivered",
                labelHe: "נמסר ללקוח ביד",
                labelEn: "Delivered / Handed Over",
                count: statusCounts.delivered,
                color: "bg-sky-500",
                badgeBg: "bg-sky-50 text-sky-700 border border-sky-200/60"
              },
              {
                id: "issue",
                labelHe: "תקלה / נדרש בירור לקוח",
                labelEn: "Issue / Customer Follow-up",
                count: statusCounts.issue,
                color: "bg-rose-500",
                badgeBg: "bg-rose-50 text-rose-700 border border-rose-200/60"
              }
            ].map((step) => {
              const total = currentOrders.length || 1;
              const percent = Math.round((step.count / total) * 100);

              return (
                <div key={step.id} className="space-y-1.5 group">
                  <div className={`flex justify-between items-center text-xs font-semibold ${isRtl ? "flex-row-reverse" : ""}`}>
                    <span className="text-navy-950 font-bold">{isRtl ? step.labelHe : step.labelEn}</span>
                    <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold ${step.badgeBg}`}>
                        {step.count}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px] w-10 text-right">({percent}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${step.color} rounded-full transition-all`}
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

        {/* Speedometer Gauge & Day of Week Heatmap */}
        <div className="lg:col-span-5 space-y-6">
          {/* Radial Speedometer Gauge (Lab Throughput) */}
          <div className="card p-6 bg-white border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col items-center">
            <div className={`w-full flex items-center justify-between mb-2 pb-2 border-b border-slate-100 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div className={isRtl ? "text-right" : "text-left"}>
                <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  {isRtl ? "מד תפוקת מעבדה וסגירה" : "Lab Efficiency Speedometer"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isRtl ? "יחס השלמה ביחס לכלל ההזמנות" : "Completed vs In-progress throughput"}
                </p>
              </div>
            </div>

            {/* SVG Speedometer Gauge */}
            <div className="relative w-48 h-28 flex flex-col items-center justify-end mt-4">
              <svg viewBox="0 0 160 90" className="w-full h-full overflow-visible">
                {/* Background arc */}
                <path
                  d="M 10 80 A 70 70 0 0 1 150 80"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                {/* Progress colored arc */}
                <path
                  d="M 10 80 A 70 70 0 0 1 150 80"
                  fill="none"
                  stroke={gaugePercent > 70 ? "#10b981" : gaugePercent > 40 ? "#f59e0b" : "#6366f1"}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              {/* Gauge Center Readout */}
              <div className="absolute bottom-0 flex flex-col items-center">
                <span className="text-3xl font-black font-mono text-navy-950 leading-none">
                  {gaugePercent}%
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                  {gaugePercent >= 80 ? (isRtl ? "תפוקה מעולה" : "Optimal Pace") : (isRtl ? "קצב יציב" : "Steady Flow")}
                </span>
              </div>
            </div>

            <div className={`mt-4 w-full text-center text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-center gap-2 ${
              isRtl ? "flex-row-reverse" : ""
            }`}>
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                {isRtl 
                  ? `${statusCounts.ready + statusCounts.delivered} בגדים הושלמו • ${activeBacklogCount} עדיין בטיפול`
                  : `${statusCounts.ready + statusCounts.delivered} completed • ${activeBacklogCount} in queue`}
              </span>
            </div>
          </div>

          {/* Day of Week Volume Matrix */}
          <div className="card p-6 bg-white border border-slate-200/90 shadow-sm">
            <div className={`flex items-center justify-between mb-4 pb-2 border-b border-slate-100 ${isRtl ? "flex-row-reverse" : ""}`}>
              <div className={isRtl ? "text-right" : "text-left"}>
                <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  {isRtl ? "עומסים לפי ימי השבוע" : "Day-of-Week Influx"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isRtl ? "באילו ימים מגיעים הכי הרבה לקוחות למעבדה" : "Intake density by weekday"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 items-end h-28 pt-4">
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
                      className={`w-full max-w-[26px] rounded-t-md transition-all ${
                        isTopDay 
                          ? "bg-gradient-to-t from-amber-500 to-amber-300 shadow-sm shadow-amber-500/20" 
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
          </div>

          {/* Garment Testing Results Split */}
          <div className="card p-6 bg-white border border-slate-200/90 shadow-sm">
            <h3 className={`text-base font-bold text-navy-950 mb-3 pb-2 border-b border-slate-100 ${isRtl ? "text-right" : "text-left"}`}>
              {isRtl ? "התפלגות תוצאות מעבדה" : "Laboratory Results Split"}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  {resultCounts.clean}
                </div>
                <div className="text-xs font-bold text-emerald-800 mt-0.5">
                  {isRtl ? "נקי משעטנז (כשר)" : "Kosher / Clean"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-center relative overflow-hidden">
                {resultCounts.shatnezFound > 0 && (
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                )}
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
