"use client";

import { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Lock, Plus, Trash2, Save, X, Package, Search, LogOut, Printer, Volume2, Copy, Music, FileAudio, Play, Pause, FileText, Network, Webhook, Sliders, CreditCard, RefreshCw, Download, Archive, ArchiveRestore, Upload, Send, BarChart3, Menu, CheckCircle2, XCircle, Clock, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import PrintCard from "@/components/PrintCard";
import VirtualPhone from "@/components/VirtualPhone";
import Script from "next/script";
import { Order, OrderStatus, subscribeToOrders, saveOrder, deleteOrder, getAdminSettings, saveAdminSettings, getAudioFiles, uploadAudioFile, deleteAudioFile, AudioFileInfo, Voicemail, subscribeToVoicemails, markVoicemailRead, deleteVoicemail as dbDeleteVoicemail, CallRecord, subscribeToCalls, logCallEvent, SmsMessage, subscribeToSmsMessages, markSmsThreadRead, DeliveryRequest, subscribeToDeliveryRequests, saveDeliveryRequest, deleteDeliveryRequest } from "@/lib/db";
import { Settings, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, MessageSquare, Info, Microscope, ShieldCheck, MapPin, Mic, User } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

function formatDateTime(timestamp: number): string {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  } catch (e) {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
  }
}

function formatDuration(durationInput: string | number | undefined, isRtl: boolean): string {
  if (durationInput === undefined || durationInput === null) return "—";
  const durationStr = String(durationInput).trim();
  if (!durationStr || durationStr === "—") return "—";
  
  const sec = parseInt(durationStr.replace("s", ""), 10);
  if (isNaN(sec)) return durationStr;
  
  if (sec < 60) {
    return isRtl ? `${sec} ש'` : `${sec}s`;
  }
  const mins = Math.floor(sec / 60);
  const remainingSecs = sec % 60;
  if (remainingSecs === 0) {
    return isRtl ? `${mins} דק'` : `${mins}m`;
  }
  return isRtl 
    ? `${mins} דק' ${remainingSecs} ש'` 
    : `${mins}m ${remainingSecs}s`;
}

function formatPrice(priceInput: string | number | undefined, priceUnitInput?: string): string {
  if (priceInput === undefined || priceInput === null || priceInput === "") return "—";
  const num = Math.abs(parseFloat(String(priceInput)));
  if (isNaN(num)) return "—";
  if (num === 0) return "$0.00";
  
  const unit = priceUnitInput || "USD";
  const symbol = unit === "USD" ? "$" : `${unit} `;
  
  if (num < 0.01) {
    return `${symbol}${num.toFixed(4)}`;
  }
  return `${symbol}${num.toFixed(3)}`;
}

function parseCallAction(action: string) {
  if (action.startsWith("Voice input:")) {
    const hasQuotes = action.includes('"');
    if (hasQuotes) {
      const quoteMatch = action.match(/"([^"]*)"/);
      const transcript = quoteMatch ? quoteMatch[1] : "";
      
      const actionMatch = action.match(/Action:\s*([^,)]+)/i);
      const orderIdMatch = action.match(/orderId:\s*([^,)]+)/i);
      const statusMatch = action.match(/status:\s*([^,)]+)/i);
      const resultMatch = action.match(/result:\s*([^,)]+)/i);
      const phoneMatch = action.match(/phone:\s*([^,)]+)/i);

      const parsedAction = actionMatch ? actionMatch[1].trim() : "none";
      const parsedOrderId = orderIdMatch ? orderIdMatch[1].trim() : "none";
      const parsedStatus = statusMatch ? statusMatch[1].trim() : "none";
      const parsedResult = resultMatch ? resultMatch[1].trim() : "none";
      const parsedPhone = phoneMatch ? phoneMatch[1].trim() : "none";

      return {
        type: "voice",
        transcript,
        action: parsedAction !== "none" ? parsedAction : null,
        orderId: parsedOrderId !== "none" ? parsedOrderId : null,
        status: parsedStatus !== "none" ? parsedStatus : null,
        result: parsedResult !== "none" ? parsedResult : null,
        phone: parsedPhone !== "none" ? parsedPhone : null,
        raw: action
      };
    } else {
      const command = action.substring("Voice input:".length).trim();
      return {
        type: "system",
        label: `🗣️ פקודה קולית: "${command}"`,
        labelEn: `🗣️ Voice Command: "${command}"`
      };
    }
  }
  
  return {
    type: "system",
    label: action,
    labelEn: action
  };
}

function translateSystemLabel(parsed: { label?: string; labelEn?: string }, isRtl: boolean): string {
  const label = parsed.label || "";
  const labelEn = parsed.labelEn || label;
  
  const mapHe: Record<string, string> = {
    "Call started": "📞 השיחה התחילה",
    "Welcome Menu": "🏠 תפריט פתיח ראשי",
    "Requested Representative": "🙋 ביקש נציג",
    "Redirected to Voicemail (Holiday Mode)": "🏝️ הופנה לתא קולי (מצב חופשה)",
    "Redirected to Voicemail (Outside Hours)": "🌙 הופנה לתא קולי (מחוץ לשעות הפעילות)",
    "Redirected to Voicemail (DND Mode)": "📴 הופנה לתא קולי (נא לא להפריע)",
    "Forwarded to Representative": "↗️ שיחה הועברה לנציג",
    "Voice cancel detected. Redirecting to admin menu.": "🔙 ביטול קולי - חזרה לתפריט הניהול",
    "Voice input: exit": "🗣️ פקודה קולית: exit",
    "Voice input: cancel": "🗣️ פקודה קולית: cancel",
    "Voice input: main menu": "🗣️ פקודה קולית: main menu",
    "Voice input: go back": "🗣️ פקודה קולית: go back",
    "Voice input: welcome": "🗣️ פקודה קולית: welcome",
    "Voice input: star": "🗣️ פקודה קולית: star",
    "Pressed Option 1 (Garment Dropoff)": "הקיש אופציה 1 (הוראות מסירה ומחירים)",
    "Pressed Option 2 (Check Order Status)": "הקיש אופציה 2 (בדיקת סטטוס הזמנה)",
    "Pressed Option 3 (Special Services)": "הקיש אופציה 3 (שירותים מיוחדים)",
    "Pressed Option 4 (Leave Voicemail)": "הקיש אופציה 4 (השארת הודעה קולית)",
    "Pressed Option 5 (Delivery Services)": "הקיש אופציה 5 (שירותי איסוף ומשלוח)",
    "Pressed Option 9 (Admin Access Request)": "הקיש אופציה 9 (בקשת גישה לניהול)",
    "Confirmed Delivery Request": "👍 אישר הזמנת איסוף ומשלוח",
    "Auto Caller Lookup": "🔍 חיפוש אוטומטי לפי מזהה מתקשר",
    "Selected search by Caller ID": "🔍 בחר חיפוש לפי מזהה מתקשר",
    "Selected manual order lookup": "⌨️ בחר חיפוש ידני של הזמנה",
    "Admin PIN matched - Entering Admin Menu": "🔑 קוד מנהל תקין - כניסה לתפריט ניהול",
    "Admin PIN Failed": "❌ קוד מנהל שגוי",
    "Admin Logged In (PIN check)": "🔑 מנהל התחבר בהצלחה",
    "Admin selection: List recent orders": "📋 בחירת מנהל: רשימת הזמנות אחרונות",
    "Admin selection: Update order status": "✏️ בחירת מנהל: עדכון סטטוס הזמנה",
    "Admin selection: Phone lookup": "📞 בחירת מנהל: חיפוש לפי טלפון",
    "Admin selection: Add new order": "➕ בחירת מנהל: הוספת הזמנה חדשה",
    "Admin selection: Call customer by digits": "☎️ בחירת מנהל: התקשרות ללקוח לפי מספר",
    "Outbound VoIP Call": "📞 שיחה יוצאת מהמערכת",
  };
  
  if (isRtl) {
    if (mapHe[label]) return mapHe[label];
    
    // Dynamic patterns
    if (label.startsWith("Pressed Option")) {
      const match = label.match(/Pressed Option\s*([0-9*#]+)/i);
      if (match) {
        const digit = match[1];
        let desc = "";
        if (label.includes("Garment Dropoff")) desc = " (הוראות מסירה ומחירים)";
        else if (label.includes("Check Order Status")) desc = " (בדיקת סטטוס הזמנה)";
        else if (label.includes("Special Services")) desc = " (שירותים מיוחדים)";
        else if (label.includes("Delivery Services")) desc = " (שירותי איסוף ומשלוח)";
        else if (label.includes("Admin Access Request")) desc = " (בקשת גישה לניהול)";
        return `⌨️ הקיש אופציה ${digit}${desc}`;
      }
    }
    
    if (label.startsWith("Typed status check:")) {
      return `⌨️ הקיש מספר הזמנה/טלפון לחיפוש: ${label.substring("Typed status check:".length).trim()}`;
    }
    
    if (label.startsWith("Looked up:")) {
      return `🔍 חיפש במערכת: ${label.substring("Looked up:".length).trim()}`;
    }
    
    if (label.startsWith("Admin PIN mismatch:")) {
      return `❌ קוד מנהל שגוי שהוקש: ${label.substring("Admin PIN mismatch:".length).trim()}`;
    }
    
    if (label.startsWith("Admin input: Call target via digits:")) {
      return `☎️ מנהל הקיש מספר להתקשרות: ${label.substring("Admin input: Call target via digits:".length).trim()}`;
    }
    
    if (label.startsWith("Outbound Bridged Call to")) {
      return `📞 שיחה יוצאת מקשרת אל: ${label.substring("Outbound Bridged Call to".length).trim()}`;
    }
    
    if (label.startsWith("Bridged Call to") && label.includes("ended")) {
      const target = label.substring("Bridged Call to".length, label.indexOf("ended")).trim();
      return `🔚 שיחה מקשרת אל ${target} הסתיימה`;
    }
    
    if (label.startsWith("Admin completed update:")) {
      return `✅ ${label.replace("Admin completed update:", "מנהל השלים עדכון:")}`;
    }
    
    if (label.startsWith("Admin completed add:")) {
      return `✅ ${label.replace("Admin completed add:", "מנהל השלים הוספת הזמנה:")}`;
    }
    
    if (label.startsWith("Voicemail Left")) {
      const match = label.match(/\d+/);
      const secs = match ? match[0] : "";
      return `📥 הושארה הודעה קולית${secs ? ` (${secs} שניות)` : ""}`;
    }
    
    if (label.startsWith("SMS:")) {
      return `💬 הודעת SMS נכנסת: ${label.substring("SMS:".length).trim()}`;
    }
    
    if (label.startsWith("SMS Outbound:")) {
      return `💬 הודעת SMS יוצאת: ${label.substring("SMS Outbound:".length).trim()}`;
    }

    if (label.startsWith("Call ended")) {
      const reason = label.substring("Call ended".length).replace(/[()]/g, "").trim();
      let reasonHe = reason;
      if (reason === "completed") reasonHe = "הושלמה בהצלחה";
      else if (reason === "no-answer") reasonHe = "אין מענה";
      else if (reason === "busy") reasonHe = "תפוס";
      else if (reason === "failed") reasonHe = "נכשלה";
      else if (reason === "canceled") reasonHe = "בוטלה";
      return `🔚 השיחה הסתיימה (${reasonHe})`;
    }
    
    return label;
  }
  return labelEn;
}

function getCallSelectionBadge(call: CallRecord, isRtl: boolean) {
  if (!call.actions || call.actions.length === 0) return null;
  
  let pressedOption = "";
  
  for (const action of call.actions) {
    if (action.includes("Option 5") || action.includes("Confirmed Delivery")) {
      pressedOption = isRtl ? "משלוח (5)" : "Delivery (5)";
      break;
    }
    if (action.includes("Option 1")) {
      pressedOption = isRtl ? "פרטי מסירה (1)" : "Dropoff Info (1)";
    }
    if (action.includes("Option 2") || action.includes("Looked up")) {
      pressedOption = isRtl ? "בדיקת סטטוס (2)" : "Check Status (2)";
    }
    if (action.includes("Option 3")) {
      pressedOption = isRtl ? "שירותים מיוחדים (3)" : "Special VIP (3)";
    }
    if (action.includes("Option 4") || action.includes("Voicemail Left") || action.includes("voicemail")) {
      pressedOption = isRtl ? "תא קולי (4)" : "Voicemail (4)";
    }
    if (action.includes("Option 9") || action.includes("Admin PIN")) {
      pressedOption = isRtl ? "ניהול (9)" : "Admin PIN (9)";
    }
    if (action.includes("Representative") || action.includes("Forwarded")) {
      pressedOption = isRtl ? "נציג (0)" : "Representative (0)";
    }
  }

  if (!pressedOption) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-normal text-slate-400 mt-1 whitespace-nowrap">
      {pressedOption}
    </span>
  );
}

function getTimelineIcon(parsed: any) {
  if (parsed.type === "voice") {
    return <Mic className="w-3 h-3 text-gold-600" />;
  }
  const label = (parsed.label || "").toLowerCase();
  if (label.includes("started") || label.includes("התחילה")) {
    return <Phone className="w-3 h-3 text-emerald-600" />;
  }
  if (label.includes("voicemail") || label.includes("קולי")) {
    return <Volume2 className="w-3 h-3 text-rose-600" />;
  }
  if (label.includes("representative") || label.includes("נציג")) {
    return <PhoneIncoming className="w-3 h-3 text-sky-600" />;
  }
  if (label.includes("welcome") || label.includes("תפריט") || label.includes("pressed option") || label.includes("הקיש")) {
    return <Sliders className="w-3 h-3 text-indigo-600" />;
  }
  if (label.includes("voice command") || label.includes("פקודה קולית")) {
    return <Mic className="w-3 h-3 text-gold-600" />;
  }
  return <Info className="w-3 h-3 text-primary-500" />;
}

function getRelativeTime(timestamp: number, isRtl: boolean): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  
  if (isRtl) {
    if (mins < 1) return "עכשיו";
    if (mins < 60) return `לפני ${mins} דקות`;
    if (hours < 24) return `לפני ${hours} שעות`;
    return `לפני ${days} ימים`;
  } else {
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
}

function splitActionText(text: string): { main: string; secondary: string } {
  if (!text) return { main: "", secondary: "" };
  
  const openParenIdx = text.indexOf("(");
  const closeParenIdx = text.lastIndexOf(")");
  
  if (openParenIdx !== -1 && closeParenIdx !== -1 && closeParenIdx > openParenIdx) {
    const main = text.substring(0, openParenIdx).trim();
    const secondary = text.substring(openParenIdx + 1, closeParenIdx).trim();
    return { main, secondary };
  }
  
  const dashIdx = text.indexOf(" - ");
  if (dashIdx !== -1) {
    const main = text.substring(0, dashIdx).trim();
    const secondary = text.substring(dashIdx + 3).trim();
    return { main, secondary };
  }
  
  return { main: text, secondary: "" };
}

function getStepTimeIndicator(action: string, idx: number, totalSteps: number, call: any, isRtl: boolean) {
  if (idx === 0 && call.timestamp) {
    try {
      const date = new Date(call.timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  }
  
  if (idx === totalSteps - 1 && call.duration) {
    return isRtl ? `משך: ${call.duration}` : `Duration: ${call.duration}`;
  }
  
  const matchSeconds = action.match(/\((\d+)\s*seconds?\)/i);
  if (matchSeconds) {
    return `${matchSeconds[1]}s`;
  }
  const matchDuration = action.match(/duration:\s*([^\s)]+)/i);
  if (matchDuration) {
    return matchDuration[1];
  }
  
  return "";
}

interface DeliveryRequestCardProps {
  request: DeliveryRequest;
  isRtl: boolean;
  onUpdate: (id: string, updates: Partial<DeliveryRequest>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCall: (phone: string, name: string) => void;
}

function DeliveryRequestCard({ request, isRtl, onUpdate, onDelete, onCall }: DeliveryRequestCardProps) {
  const [name, setName] = useState(request.customerName || "");
  const [notes, setNotes] = useState(request.notes || "");
  const [status, setStatus] = useState(request.status);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(request.customerName || "");
  }, [request.customerName]);

  useEffect(() => {
    setNotes(request.notes || "");
  }, [request.notes]);

  useEffect(() => {
    setStatus(request.status);
  }, [request.status]);

  const handleStatusChange = async (newStatus: any) => {
    setStatus(newStatus);
    await onUpdate(request.id, { status: newStatus });
  };

  const handleBlur = async () => {
    setIsSaving(true);
    await onUpdate(request.id, { customerName: name, notes });
    setIsSaving(false);
  };

  const statusOptions = [
    { value: "pending", label: isRtl ? "ממתין" : "Pending", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "called", label: isRtl ? "נוצר קשר/תוזמן" : "Called/Scheduled", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { value: "completed", label: isRtl ? "הושלם" : "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { value: "cancelled", label: isRtl ? "בוטל" : "Cancelled", color: "bg-slate-50 text-slate-700 border-slate-200" }
  ];

  const currentOption = statusOptions.find(o => o.value === status) || statusOptions[0];

  return (
    <div className={`card p-5 bg-white border border-primary-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200 relative ${
      status === "pending" ? "border-l-4 border-l-gold-500" : ""
    }`}>
      <div>
        {/* Card Header */}
        <div className={`flex justify-between items-center mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer ${
              currentOption.color
            } ${isRtl ? "text-right" : ""}`}
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-white text-navy-950">{opt.label}</option>
            ))}
          </select>
          
          <button
            onClick={() => { if (confirm(isRtl ? "האם למחוק בקשת משלוח זו?" : "Are you sure you want to delete this request?")) onDelete(request.id); }}
            className="p-1 text-primary-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
            title={isRtl ? "מחק בקשה" : "Delete Request"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Phone and Name Inputs */}
        <div className="space-y-3 mb-4">
          <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="font-bold text-navy-950 font-mono text-base">{request.phone}</span>
            <button
              onClick={() => onCall(request.phone, name)}
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-150 transition-colors shrink-0 flex items-center justify-center"
              title={isRtl ? "התקשר ללקוח" : "Call Customer"}
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
            <a
              href={`tel:${request.phone}`}
              className="p-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg border border-primary-150 transition-colors shrink-0 flex items-center justify-center"
              title={isRtl ? "חיוג במכשיר" : "Call on device"}
            >
              <PhoneCall className="w-3.5 h-3.5" />
            </a>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-primary-500 mb-1 uppercase">
              {isRtl ? "שם הלקוח:" : "Customer Name:"}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleBlur}
              placeholder={isRtl ? "הזן שם לקוח..." : "Enter customer name..."}
              className={`w-full px-3 py-1.5 rounded-lg border border-primary-200 text-xs focus:ring-1 focus:ring-gold-400 focus:outline-none bg-primary-50/20 ${isRtl ? "text-right" : ""}`}
            />
          </div>
        </div>

        {/* Time requested */}
        <div className={`text-[10px] text-primary-400 font-medium mb-4 ${isRtl ? "text-right" : ""}`}>
          <div dir="ltr">{formatDateTime(request.timestamp)}</div>
          <div className="mt-0.5">{getRelativeTime(request.timestamp, isRtl)}</div>
        </div>

        {/* Notes text area */}
        <div className="mb-4">
          <label className="block text-[10px] font-semibold text-primary-500 mb-1 uppercase">
            {isRtl ? "הערות (כתובת, שעות וכו'):" : "Notes (Address, times, etc.):"}
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleBlur}
            placeholder={isRtl ? "הוסף הערות לגבי המשלוח..." : "Add notes about the delivery..."}
            className={`w-full px-3 py-1.5 rounded-lg border border-primary-200 text-xs focus:ring-1 focus:ring-gold-400 focus:outline-none bg-primary-50/20 resize-none leading-relaxed ${isRtl ? "text-right" : ""}`}
          />
        </div>
      </div>

      {/* Footer / Status indication */}
      {isSaving && (
        <div className="text-[10px] text-gold-650 font-medium animate-pulse absolute bottom-2 right-5">
          {isRtl ? "שומר..." : "Saving..."}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { t, isRtl } = useLanguage();
  const dragControls = useDragControls();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    status: "received",
    dateReceived: new Date().toISOString().split("T")[0],
    estimatedCompletion: "",
    notes: "",
    result: "",
    phone: "",
    location: "14 Buchanan Rd",
  });
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminPin, setAdminPin] = useState("1234");
  const [adminUser, setAdminUser] = useState("Gershy");
  const [adminEmail, setAdminEmail] = useState("gershybraun@gmail.com");
  const [forwardingNumber, setForwardingNumber] = useState("8455524744");
  const [forwardingHoursStart, setForwardingHoursStart] = useState("09:00");
  const [forwardingHoursEnd, setForwardingHoursEnd] = useState("21:00");
  const [callerIdType, setCallerIdType] = useState<"caller" | "twilio">("caller");
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [callSearchQuery, setCallSearchQuery] = useState("");
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [callLogSubTab, setCallLogSubTab] = useState<"timeline" | "sms">("timeline");
  const [smsInput, setSmsInput] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [selectedSmsPhone, setSelectedSmsPhone] = useState<string | null>(null);
  const [holidayModeActive, setHolidayModeActive] = useState(false);
  const [dndActive, setDndActive] = useState(false);
  const [ivrHolidayMsgEn, setIvrHolidayMsgEn] = useState("");
  const [ivrHolidayMsgHe, setIvrHolidayMsgHe] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newAdminUser, setNewAdminUser] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newForwardingNumber, setNewForwardingNumber] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [ivrGeneralEn, setIvrGeneralEn] = useState("");
  const [ivrGeneralHe, setIvrGeneralHe] = useState("");
  const [ivrSpecialEn, setIvrSpecialEn] = useState("");
  const [ivrSpecialHe, setIvrSpecialHe] = useState("");
  const [outboundMsgEn, setOutboundMsgEn] = useState("");
  const [outboundMsgHe, setOutboundMsgHe] = useState("");

  const [voicemailEmail, setVoicemailEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [twilioApiKey, setTwilioApiKey] = useState("");
  const [twilioApiSecret, setTwilioApiSecret] = useState("");
  const [twilioTwimlAppSid, setTwilioTwimlAppSid] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [newGeminiApiKey, setNewGeminiApiKey] = useState("");

  const [audioFiles, setAudioFiles] = useState<AudioFileInfo[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isReplacingName, setIsReplacingName] = useState<string | null>(null);

  const [playingName, setPlayingName] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [manualCallPhone, setManualCallPhone] = useState("");
  const [manualCallOrderId, setManualCallOrderId] = useState("");
  const [callPromptData, setCallPromptData] = useState<{orderId: string, phone: string} | null>(null);
  const [activeBlueprintTab, setActiveBlueprintTab] = useState("flow");
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const [adminNotes, setAdminNotes] = useState("");
  const [activeAdminTab, setActiveAdminTab] = useState<"orders" | "voicemails" | "audio" | "settings" | "calls" | "archive" | "analytics" | "billing" | "deliveries">("orders");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{orderId: string, field: string} | null>(null);

  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [deliverySearchQuery, setDeliverySearchQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "pending" | "called" | "completed" | "cancelled">("all");

  const [billingData, setBillingData] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "daily">("monthly");

  const fetchBilling = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/twilio/billing");
      const data = await res.json();
      if (data.success) {
        setBillingData(data);
      } else {
        setBillingError(data.error || "Failed to fetch billing data");
      }
    } catch (err: any) {
      setBillingError(err.message || String(err));
    } finally {
      setBillingLoading(false);
    }
  };
  
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [isAddingOrderInModal, setIsAddingOrderInModal] = useState(false);
  const [modalNewOrder, setModalNewOrder] = useState<Partial<Order>>({
    status: "received",
    location: "14 Buchanan Rd",
    notes: "",
    result: "",
    estimatedCompletion: "",
    dateReceived: new Date().toISOString().split("T")[0]
  });

  const openCustomerModal = (phone: string, customerName: string) => {
    setSelectedCustomerPhone(phone);
    setSelectedCustomerName(customerName);
    setIsAddingOrderInModal(false);
    setShowCustomerModal(true);
  };

  const handleUpdateCustomerProfile = async (newName: string, newPhone: string) => {
    if (!selectedCustomerPhone) return;
    const cleanOldPhone = selectedCustomerPhone.replace(/\D/g, "");
    const cleanNewPhone = newPhone.replace(/\D/g, "");
    if (!newName || !cleanNewPhone) {
      showToast(isRtl ? "שם ומספר טלפון לא יכולים להיות ריקים!" : "Name and phone number cannot be empty!", "error");
      return;
    }
    
    // Find all orders matching the old phone number
    const matchingOrders = orders.filter(o => o.phone && o.phone.replace(/\D/g, "") === cleanOldPhone);
    for (const o of matchingOrders) {
      await saveOrder({
        ...o,
        customerName: newName,
        phone: newPhone
      });
    }
    setSelectedCustomerPhone(newPhone);
    setSelectedCustomerName(newName);
    showToast(isRtl ? "פרטי הלקוח עודכנו בהצלחה!" : "Customer profile updated successfully!", "success");
  };

  const handleCreateOrderInModal = async () => {
    if (!selectedCustomerPhone || !selectedCustomerName) return;
    const nextId = generateNextId();
    const order: Order = {
      id: nextId,
      customerName: selectedCustomerName,
      phone: selectedCustomerPhone,
      status: (modalNewOrder.status as OrderStatus) || "received",
      dateReceived: modalNewOrder.dateReceived || new Date().toISOString().split("T")[0],
      estimatedCompletion: modalNewOrder.estimatedCompletion || "",
      notes: modalNewOrder.notes || "",
      result: modalNewOrder.result || "",
      createdAt: Date.now(),
      location: modalNewOrder.location || "14 Buchanan Rd"
    };

    await saveOrder(order);
    setIsAddingOrderInModal(false);
    setModalNewOrder({
      status: "received",
      location: "14 Buchanan Rd",
      notes: "",
      result: "",
      estimatedCompletion: "",
      dateReceived: new Date().toISOString().split("T")[0]
    });
    showToast(isRtl ? "הזמנה חדשה נוספה בהצלחה!" : "New order successfully added!", "success");
  };

  const handleUpdateModalOrderField = async (orderId: string, field: string, value: any) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    await saveOrder({
      ...order,
      [field]: value
    });
  };

  const handleDeleteModalOrder = async (orderId: string) => {
    if (confirm(isRtl ? `האם אתה בטוח שברצונך למחוק לצמיתות את הזמנה ${orderId}?` : `Are you sure you want to permanently delete order ${orderId}?`)) {
      await deleteOrder(orderId);
      showToast(isRtl ? "הזמנה נמחקה לצמיתות" : "Order permanently deleted", "success");
    }
  };

  const handleToggleArchiveModalOrder = async (orderId: string, currentArchived: boolean) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    await saveOrder({
      ...order,
      archived: !currentArchived
    });
    showToast(
      isRtl 
        ? (!currentArchived ? "ההזמנה הועברה לארכיון" : "ההזמנה שוחזרה מהארכיון")
        : (!currentArchived ? "Order archived" : "Order restored from archive"),
      "success"
    );
  };

  const getStatusBadgeClasses = (status: string): string => {
    const map: Record<string, string> = {
      received: 'bg-slate-100 text-slate-700 border border-slate-200',
      testing: 'bg-amber-50 text-amber-700 border border-amber-200',
      review: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      ready: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      delivered: 'bg-sky-50 text-sky-700 border border-sky-200',
      issue: 'bg-red-50 text-red-700 border border-red-200',
    };
    return map[status] || 'bg-gray-100 text-gray-700 border border-gray-200';
  };

  const getResultBadgeClasses = (result: string): string => {
    if (!result) return 'bg-gray-50 text-gray-400 border border-gray-200 italic';
    if (result.includes('Clean')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (result.includes('Shatnez Found')) return 'bg-red-50 text-red-700 border border-red-200';
    if (result.includes('Call')) return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-gray-50 text-gray-600 border border-gray-200';
  };
  
  const activeInboundCall = calls.find(c => c.status === "active" && Date.now() - c.timestamp < 90000 && c.direction !== "outbound");
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: "success" | "error" | "info" }[]>([]);

  const getCallAnalytics = () => {
    let totalInbound = 0;
    let totalOutbound = 0;
    let totalSms = 0;
    let totalVoice = 0;
    let totalDurationSec = 0;
    let callsWithDuration = 0;
    
    const keypressCount: Record<string, number> = {
      "1": 0,
      "2": 0,
      "3": 0,
      "9": 0,
      "0": 0
    };

    calls.forEach(c => {
      const isOutbound = c.direction === "outbound" || c.actions.some(act => act.toLowerCase().includes("outbound"));
      const isSms = c.actions.some(act => act.trim().startsWith("SMS:") || act.includes("SMS:"));
      
      if (isSms) {
        totalSms++;
      } else {
        totalVoice++;
        if (isOutbound) {
          totalOutbound++;
        } else {
          totalInbound++;
        }
        
        if (c.duration) {
          const sec = parseInt(c.duration.replace("s", ""), 10);
          if (!isNaN(sec)) {
            totalDurationSec += sec;
            callsWithDuration++;
          }
        }
      }

      c.actions.forEach(act => {
        if (act.includes("Pressed Option 1") || act.includes("הקיש אופציה 1")) keypressCount["1"]++;
        if (act.includes("Pressed Option 2") || act.includes("הקיש אופציה 2") || act.includes("Auto Caller Lookup") || act.includes("Typed status check")) keypressCount["2"]++;
        if (act.includes("Pressed Option 3") || act.includes("הקיש אופציה 3")) keypressCount["3"]++;
        if (act.includes("Pressed Option 9") || act.includes("הקיש אופציה 9") || act.includes("Admin Logged In") || act.includes("Admin PIN Failed")) keypressCount["9"]++;
        if (act.includes("Requested Representative") || act.includes("ביקש נציג") || act.includes("Forwarded to Representative")) keypressCount["0"]++;
      });
    });

    const avgDuration = callsWithDuration > 0 ? Math.round(totalDurationSec / callsWithDuration) : 0;

    return {
      totalInbound,
      totalOutbound,
      totalSms,
      totalVoice,
      avgDuration,
      keypressCount
    };
  };

  const handleMarkCallCompleted = async (callId: string, phone: string) => {
    try {
      await logCallEvent(callId, phone, isRtl ? "סומן כהושלם ידנית" : "Manually completed", "completed");
      showToast(isRtl ? "השיחה סומנה כהושלמה" : "Call marked as completed", "success");
    } catch (err) {
      console.error("Failed to mark call completed:", err);
      showToast(isRtl ? "שגיאה בסימון השיחה" : "Failed to mark call completed", "error");
    }
  };

  const handleSyncCallPrices = async () => {
    setIsSyncingPrices(true);
    try {
      const res = await fetch("/api/twilio/sync-prices");
      const data = await res.json();
      if (data.success) {
        if (data.synced > 0) {
          showToast(
            isRtl 
              ? `סונכרנו בהצלחה עלויות עבור ${data.synced} שיחות` 
              : `Successfully synced costs for ${data.synced} calls`,
            "success"
          );
        } else {
          showToast(
            isRtl 
              ? "כל עלויות השיחות מעודכנות" 
              : "All call costs are up to date",
            "info"
          );
        }
      } else {
        throw new Error(data.error || "Failed to sync");
      }
    } catch (err: any) {
      console.error("Failed to sync call prices:", err);
      showToast(
        isRtl 
          ? `שגיאה בסנכרון עלויות: ${err.message || err}` 
          : `Failed to sync costs: ${err.message || err}`,
        "error"
      );
    } finally {
      setIsSyncingPrices(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  };

  const downloadCardSvg = (side: "front" | "back") => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(origin + "/track")}`;
    
    let svgContent = "";
    if (side === "front") {
      svgContent = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 600" width="1050" height="600">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a5f" />
      <stop offset="100%" stop-color="#0d1b2a" />
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="1050" height="600" fill="url(#bgGrad)" rx="30" />
  <!-- Gold Border -->
  <rect x="25" y="25" width="1000" height="550" fill="none" stroke="#d4af37" stroke-width="8" rx="20" />
  <rect x="35" y="35" width="980" height="530" fill="none" stroke="#d4af37" stroke-width="2" stroke-opacity="0.4" rx="15" />
  
  <!-- Microscope Emblem -->
  <g transform="translate(495, 100) scale(2)">
    <rect width="32" height="32" rx="8" fill="#d4af37" />
    <path d="M12 22h8M16 18v4M9 22h14M16 12v3M14 6c0-2 2-2 2-2s2 0 2 2v6c0 1-1 2-2 2s-2-1-2-2V6z" fill="none" stroke="#0d1b2a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- Typography -->
  <text x="525" y="320" font-family="'Inter', 'Arial', sans-serif" font-weight="900" font-size="54" fill="#ffffff" text-anchor="middle" letter-spacing="2">THE SHATNEZ <tspan fill="#d4af37">LAB</tspan></text>
  <text x="525" y="375" font-family="'Inter', 'Arial', sans-serif" font-weight="700" font-size="22" fill="#d4af37" text-anchor="middle" letter-spacing="4">PROFESSIONAL SHATNEZ INSPECTION</text>
  <text x="525" y="415" font-family="'Inter', 'Arial', sans-serif" font-weight="700" font-size="18" fill="#ffffff" fill-opacity="0.8" text-anchor="middle" letter-spacing="3">בדיקת שעטנז מקצועית ומוסמכת</text>
  
  <!-- Footer Contact -->
  <text x="525" y="500" font-family="'Courier New', monospace" font-weight="bold" font-size="28" fill="#d4af37" text-anchor="middle" letter-spacing="1">📞 845-552-4744</text>
</svg>`;
    } else {
      svgContent = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 600" width="1050" height="600">
  <!-- Background -->
  <rect width="1050" height="600" fill="#ffffff" rx="30" />
  <!-- Navy Border -->
  <rect x="25" y="25" width="1000" height="550" fill="none" stroke="#1e3a5f" stroke-width="10" rx="20" />
  
  <!-- Left Side Info -->
  <g transform="translate(80, 80)">
    <!-- Title -->
    <text x="0" y="40" font-family="'Inter', 'Arial', sans-serif" font-weight="900" font-size="44" fill="#1e3a5f">The Shatnez Lab</text>
    <text x="0" y="75" font-family="'Inter', 'Arial', sans-serif" font-weight="700" font-size="20" fill="#d4af37">Spring Valley, NY</text>
    
    <!-- Info Items -->
    <text x="0" y="150" font-family="'Inter', 'Arial', sans-serif" font-weight="bold" font-size="28" fill="#0d1b2a">📞 Phone: 845-552-4744</text>
    <text x="0" y="210" font-family="'Inter', 'Arial', sans-serif" font-weight="bold" font-size="24" fill="#4a5568">📍 Drop-off: 14 Buchanan Rd</text>
    <text x="0" y="270" font-family="'Inter', 'Arial', sans-serif" font-weight="bold" font-size="24" fill="#4a5568">🕒 Hours: 24/7 Automated System</text>
    
    <!-- Pricing Tier Tags -->
    <!-- Tag 1 -->
    <rect x="0" y="340" width="220" height="60" rx="10" fill="#f7fafc" stroke="#e2e8f0" stroke-width="2" />
    <text x="110" y="378" font-family="'Inter', 'Arial', sans-serif" font-weight="bold" font-size="20" fill="#0d1b2a" text-anchor="middle">Simple Garment: $5</text>
    
    <!-- Tag 2 -->
    <rect x="240" y="340" width="260" height="60" rx="10" fill="#f7fafc" stroke="#e2e8f0" stroke-width="2" />
    <text x="370" y="378" font-family="'Inter', 'Arial', sans-serif" font-weight="bold" font-size="20" fill="#0d1b2a" text-anchor="middle">Lined (Suits/Coats): $10</text>

    <!-- Hebrew Tag 1 -->
    <rect x="0" y="420" width="220" height="60" rx="10" fill="#f7fafc" stroke="#e2e8f0" stroke-width="2" />
    <text x="110" y="458" font-family="'Inter', 'Arial', sans-serif" font-weight="bold" font-size="20" fill="#0d1b2a" text-anchor="middle">בגד פשוט: $5</text>
    
    <!-- Hebrew Tag 2 -->
    <rect x="240" y="420" width="260" height="60" rx="10" fill="#f7fafc" stroke="#e2e8f0" stroke-width="2" />
    <text x="370" y="458" font-family="'Inter', 'Arial', sans-serif" font-weight="bold" font-size="20" fill="#0d1b2a" text-anchor="middle">בגד עם בטנה: $10</text>
  </g>
  
  <!-- Right Side QR Code -->
  <g transform="translate(680, 130)">
    <rect x="0" y="0" width="280" height="280" fill="#ffffff" stroke="#e2e8f0" stroke-width="4" rx="15" />
    <image x="15" y="15" width="250" height="250" href="${qrUrl}" />
    <text x="140" y="320" font-family="'Inter', 'Arial', sans-serif" font-weight="bold" font-size="18" fill="#4a5568" text-anchor="middle" letter-spacing="1">SCAN TO TRACK ORDER</text>
    <text x="140" y="345" font-family="'Inter', 'Arial', sans-serif" font-weight="bold" font-size="18" fill="#4a5568" text-anchor="middle" letter-spacing="1">סרוק למעקב הזמנה</text>
  </g>
</svg>`;
    }

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shatnez_lab_card_${side}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(isRtl ? "קובץ וקטורי (SVG) ירד בהצלחה!" : "Vector SVG file downloaded successfully!", "success");
  };

  const statusOptions: { value: OrderStatus; label: string }[] = [
    { value: "received", label: t("status_received") },
    { value: "testing", label: t("status_testing") },
    { value: "review", label: t("status_review") },
    { value: "ready", label: t("status_ready") },
    { value: "delivered", label: t("status_delivered") },
    { value: "issue", label: t("status_issue") },
  ];

  const resultOptions = [
    { value: "", label: isRtl ? "אין תוצאה" : "No result yet" },
    { value: "Clean / No Shatnez", label: isRtl ? "נקי משעטנז" : "Clean / No Shatnez" },
    { value: "Shatnez Found", label: isRtl ? "נמצא שעטנז" : "Shatnez Found" },
    { value: "Call to Discuss", label: isRtl ? "נא להתקשר לפרטים" : "Call to Discuss" },
  ];

  useEffect(() => {
    const persistedAuth = localStorage.getItem("admin_authenticated");
    if (persistedAuth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    
    localStorage.setItem("admin_authenticated", "true");
    
    getAdminSettings().then(s => {
      setAdminPin(s.pin);
      setAdminUser(s.adminUser || "Gershy");
      setAdminEmail(s.adminEmail || "gershybraun@gmail.com");
      setForwardingNumber(s.forwardingNumber);
      setForwardingHoursStart(s.forwardingHoursStart || "09:00");
      setForwardingHoursEnd(s.forwardingHoursEnd || "21:00");
      setCallerIdType(s.callerIdType || "caller");
      setHolidayModeActive(!!s.holidayModeActive);
      setDndActive(!!s.dndActive);
      setIvrHolidayMsgEn(s.ivrHolidayMsgEn || "Our office is currently closed for the holidays. Please leave a message after the beep.");
      setIvrHolidayMsgHe(s.ivrHolidayMsgHe || "המשרד סגור כעת לרגל החג. אנא השאירו הודעה לאחר הצפצוף.");
      setNewPin(s.pin);
      setNewAdminUser(s.adminUser || "Gershy");
      setNewAdminEmail(s.adminEmail || "gershybraun@gmail.com");
      setNewForwardingNumber(s.forwardingNumber);
      setIvrGeneralEn(s.ivrGeneralEn || "");
      setIvrGeneralHe(s.ivrGeneralHe || "");
      setIvrSpecialEn(s.ivrSpecialEn || "");
      setIvrSpecialHe(s.ivrSpecialHe || "");
      setOutboundMsgEn(s.outboundMsgEn || "");
      setOutboundMsgHe(s.outboundMsgHe || "");
      setAdminNotes(s.adminNotes || "");
      setVoicemailEmail(s.voicemailEmail || "");
      setSmtpHost(s.smtpHost || "");
      setSmtpPort(s.smtpPort || "");
      setSmtpUser(s.smtpUser || "");
      setSmtpPass(s.smtpPass || "");
      setTwilioAccountSid(s.twilioAccountSid || "");
      setTwilioAuthToken(s.twilioAuthToken || "");
      setTwilioPhoneNumber(s.twilioPhoneNumber || "");
      setTwilioApiKey(s.twilioApiKey || "");
      setTwilioApiSecret(s.twilioApiSecret || "");
      setTwilioTwimlAppSid(s.twilioTwimlAppSid || "");
      setGeminiApiKey(s.geminiApiKey || "");
      setNewGeminiApiKey(s.geminiApiKey || "");
    });

    loadAudioFiles();
    fetchBilling();

    // Sync call costs silently in background on load
    fetch("/api/twilio/sync-prices").catch((err) => console.error("Silent sync error:", err));

    const unsub = subscribeToOrders((data) => {
      setOrders(data);
      setLoading(false);
    });
    
    const unsubVm = subscribeToVoicemails((data) => {
      setVoicemails(data);
    });

    const unsubCalls = subscribeToCalls((data) => {
      setCalls(data);
      if (data.length > 0) {
        setSelectedCallId(prev => prev || data[0].id);
        // Auto-complete extremely old active calls in background
        data.forEach(call => {
          if (call.status === "active" && Date.now() - call.timestamp > 15 * 60 * 1000) {
            logCallEvent(call.id, call.phone, "Call ended (auto-completed)", "completed", "0s");
          }
        });
      }
    });

    const unsubSms = subscribeToSmsMessages(setSmsMessages);

    const unsubDeliveries = subscribeToDeliveryRequests((data) => {
      setDeliveries(data);
    });

    return () => {
      unsub();
      unsubVm();
      unsubCalls();
      unsubSms();
      unsubDeliveries();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    getAdminSettings().then(s => {
      setAdminPin(s.pin);
      setAdminUser(s.adminUser || "Gershy");
      setAdminEmail(s.adminEmail || "gershybraun@gmail.com");
      setForwardingNumber(s.forwardingNumber);
      setCallerIdType(s.callerIdType || "caller");
      setHolidayModeActive(!!s.holidayModeActive);
      setDndActive(!!s.dndActive);
      setIvrHolidayMsgEn(s.ivrHolidayMsgEn || "Our office is currently closed for the holidays. Please leave a message after the beep.");
      setIvrHolidayMsgHe(s.ivrHolidayMsgHe || "המשרד סגור כעת לרגל החג. אנא השאירו הודעה לאחר הצפצוף.");
      setNewPin(s.pin);
      setNewAdminUser(s.adminUser || "Gershy");
      setNewAdminEmail(s.adminEmail || "gershybraun@gmail.com");
      setNewForwardingNumber(s.forwardingNumber);
      setIvrGeneralEn(s.ivrGeneralEn || "");
      setIvrGeneralHe(s.ivrGeneralHe || "");
      setIvrSpecialEn(s.ivrSpecialEn || "");
      setIvrSpecialHe(s.ivrSpecialHe || "");
      setOutboundMsgEn(s.outboundMsgEn || "");
      setOutboundMsgHe(s.outboundMsgHe || "");
      setAdminNotes(s.adminNotes || "");
      setVoicemailEmail(s.voicemailEmail || "");
      setSmtpHost(s.smtpHost || "");
      setSmtpPort(s.smtpPort || "");
      setSmtpUser(s.smtpUser || "");
      setSmtpPass(s.smtpPass || "");
      setTwilioAccountSid(s.twilioAccountSid || "");
      setTwilioAuthToken(s.twilioAuthToken || "");
      setTwilioPhoneNumber(s.twilioPhoneNumber || "");
      setTwilioApiKey(s.twilioApiKey || "");
      setTwilioApiSecret(s.twilioApiSecret || "");
      setTwilioTwimlAppSid(s.twilioTwimlAppSid || "");
      setGeminiApiKey(s.geminiApiKey || "");
      setNewGeminiApiKey(s.geminiApiKey || "");
    });
    if (isAuthenticated) {
      loadAudioFiles();
    }
  }, [isAuthenticated]);

  // Group SMS Messages by Phone number
  const smsThreads = (() => {
    const groups: Record<string, { lastMessage: SmsMessage; messages: SmsMessage[]; customerName?: string }> = {};
    smsMessages.forEach(msg => {
      const cleanPhone = msg.phone.replace(/\D/g, "");
      if (!groups[cleanPhone]) {
        const matchedOrder = orders.find(o => o.phone && o.phone.replace(/\D/g, "") === cleanPhone);
        groups[cleanPhone] = {
          lastMessage: msg,
          messages: [],
          customerName: matchedOrder?.customerName
        };
      }
      groups[cleanPhone].messages.push(msg);
      if (msg.timestamp > groups[cleanPhone].lastMessage.timestamp) {
        groups[cleanPhone].lastMessage = msg;
      }
    });

    return Object.entries(groups)
      .map(([phone, data]) => ({
        phone,
        ...data
      }))
      .sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
  })();

  useEffect(() => {
    if (!selectedSmsPhone && smsThreads.length > 0) {
      setSelectedSmsPhone(smsThreads[0].phone);
    }
  }, [smsThreads, selectedSmsPhone]);

  const loadAudioFiles = async () => {
    try {
      const list = await getAudioFiles();
      setAudioFiles(list || []);
    } catch (err) {
      console.error("Failed to load audio files:", err);
    }
  };

  const handleUploadAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile || !audioName) return;

    if (audioFile.size > 1024 * 1024) {
      showToast(isRtl ? "גודל הקובץ עולה על 1MB. אנא בחר קובץ קטן יותר." : "File size exceeds 1MB. Please choose a smaller file.", "error");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          await uploadAudioFile(audioName, base64);
          setAudioFile(null);
          setAudioName("");
          
          // Clear file input manually
          const fileInput = document.getElementById("audio-file-input") as HTMLInputElement;
          if (fileInput) fileInput.value = "";
          const fileInputModal = document.getElementById("audio-file-input-modal") as HTMLInputElement;
          if (fileInputModal) fileInputModal.value = "";

          showToast(isRtl ? "קובץ השמע הועלה בהצלחה!" : "Audio file uploaded successfully!", "success");
          loadAudioFiles();
        } catch (err) {
          console.error(err);
          showToast(isRtl ? "שגיאה בהעלאת הקובץ." : "Error uploading file.", "error");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(audioFile);
    } catch (err) {
      console.error(err);
      showToast(isRtl ? "שגיאה בקריאת הקובץ." : "Error reading file.", "error");
      setIsUploading(false);
    }
  };

  const handleDeleteAudio = async (name: string) => {
    if (confirm(isRtl ? `האם אתה בטוח שברצונך למחוק את קובץ השמע ${name}?` : `Are you sure you want to delete audio file ${name}?`)) {
      try {
        await deleteAudioFile(name);
        showToast(isRtl ? "קובץ השמע נמחק בהצלחה!" : "Audio file deleted successfully!", "success");
        loadAudioFiles();
      } catch (err) {
        console.error(err);
        showToast(isRtl ? "שגיאה במחיקת הקובץ." : "Error deleting file.", "error");
      }
    }
  };

  const handleReplaceAudio = async (name: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (file.size > 1024 * 1024) {
      showToast(isRtl ? "גודל הקובץ עולה על 1MB. אנא בחר קובץ קטן יותר." : "File size exceeds 1MB. Please choose a smaller file.", "error");
      return;
    }

    setIsReplacingName(name);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          await uploadAudioFile(name, base64);
          
          showToast(isRtl ? `קובץ השמע ${name} הוחלף בהצלחה!` : `Audio file ${name} replaced successfully!`, "success");
          loadAudioFiles();
        } catch (err) {
          console.error(err);
          showToast(isRtl ? "שגיאה בהחלפת הקובץ." : "Error replacing file.", "error");
        } finally {
          setIsReplacingName(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      showToast(isRtl ? "שגיאה בקריאת הקובץ." : "Error reading file.", "error");
      setIsReplacingName(null);
    }
  };

  const handleCopyAudioUrl = (name: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/audio?name=${name.toLowerCase().trim()}`;
    navigator.clipboard.writeText(url);
    showToast(isRtl ? `הקישור הועתק ללוח ויכול לשמש ב-Twilio!` : `Link copied to clipboard for use in Twilio!`, "success");
  };

  const handleTogglePlay = (name: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/audio?name=${name.toLowerCase().trim()}&t=${Date.now()}`;

    if (playingName === name && currentAudio) {
      currentAudio.pause();
      setPlayingName(null);
      setCurrentAudio(null);
    } else {
      if (currentAudio) {
        currentAudio.pause();
      }
      const audio = new Audio(url);
      audio.play().catch(err => console.error("Playback failed:", err));
      audio.onended = () => {
        setPlayingName(null);
        setCurrentAudio(null);
      };
      setCurrentAudio(audio);
      setPlayingName(name);
    }
  };

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, [currentAudio]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === adminPin && username.toLowerCase() === adminUser.toLowerCase()) {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (!auth) {
        showToast("Firebase Auth not initialized.", "error");
        return;
      }
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email?.toLowerCase() === adminEmail.toLowerCase()) {
        setIsAuthenticated(true);
        setPinError(false);
      } else {
        await auth.signOut();
        showToast(isRtl ? "אימייל זה אינו מורשה להתחבר." : "This email is not authorized.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast(isRtl ? "שגיאה בהתחברות עם גוגל." : "Error signing in with Google.", "error");
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const updatedPin = newPin.length === 4 ? newPin : adminPin;
      const updatedForwarding = newForwardingNumber || forwardingNumber;
      
      await saveAdminSettings({ 
        pin: updatedPin,
        adminUser: newAdminUser || adminUser,
        adminEmail: newAdminEmail || adminEmail,
        forwardingNumber: updatedForwarding,
        forwardingHoursStart,
        forwardingHoursEnd,
        ivrGeneralEn,
        ivrGeneralHe,
        ivrSpecialEn,
        ivrSpecialHe,
        outboundMsgEn,
        outboundMsgHe,
        adminNotes,
        voicemailEmail,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        twilioAccountSid,
        twilioAuthToken,
        twilioPhoneNumber,
        twilioApiKey,
        twilioApiSecret,
        twilioTwimlAppSid,
        callerIdType,
        holidayModeActive,
        ivrHolidayMsgEn,
        ivrHolidayMsgHe,
        dndActive,
        geminiApiKey: newGeminiApiKey || geminiApiKey
      });
      
      setAdminPin(updatedPin);
      setAdminUser(newAdminUser || adminUser);
      setAdminEmail(newAdminEmail || adminEmail);
      setForwardingNumber(updatedForwarding);
      setNewPin(updatedPin);
      setNewAdminUser(newAdminUser || adminUser);
      setNewAdminEmail(newAdminEmail || adminEmail);
      setNewForwardingNumber(updatedForwarding);
      setGeminiApiKey(newGeminiApiKey || geminiApiKey);
      setNewGeminiApiKey(newGeminiApiKey || geminiApiKey);
      setSaveSuccess(true);
      
      showToast(isRtl ? "הגדרות עודכנו בהצלחה!" : "Settings updated successfully!", "success");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update settings:", err);
      showToast(isRtl ? "שגיאה בשמירת ההגדרות. נסה שוב." : "Error saving settings. Please try again.", "error");
    }
  };

  const generateNextId = (): string => {
    const existing = orders.map((o) => {
      const match = o.id.match(/^(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        return val < 1000000 ? val : 0;
      }
      return 0;
    });
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    const next = max < 1000 ? 1000 : max + 1;
    return String(next);
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.customerName || !newOrder.phone) {
      showToast(isRtl ? "אנא הזן שם לקוח ומספר טלפון!" : "Please enter customer name and phone number!", "error");
      return;
    }

    const cleanPhone = newOrder.phone.replace(/\D/g, "");
    if (!cleanPhone) {
      showToast(isRtl ? "מספר טלפון לא תקין!" : "Invalid phone number!", "error");
      return;
    }

    const nextId = generateNextId();
    const order: Order = {
      id: nextId,
      customerName: newOrder.customerName,
      phone: newOrder.phone,
      status: (newOrder.status as OrderStatus) || "received",
      dateReceived: newOrder.dateReceived || new Date().toISOString().split("T")[0],
      estimatedCompletion: newOrder.estimatedCompletion || "",
      notes: newOrder.notes || "",
      result: newOrder.result || "",
      createdAt: Date.now(),
      location: newOrder.location || "14 Buchanan Rd"
    };

    await saveOrder(order);
    setShowAddForm(false);
    setNewOrder({
      status: "received",
      dateReceived: new Date().toISOString().split("T")[0],
      estimatedCompletion: "",
      notes: "",
      result: "",
      phone: "",
      location: "14 Buchanan Rd",
    });
  };

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    
    const oldStatus = order.status;
    await saveOrder({ ...order, status });
    
    // If status changed to ready, ask to call
    if (status === "ready" && oldStatus !== "ready" && order.phone) {
      setCallPromptData({ orderId: order.id, phone: order.phone });
    }
  };

  const handleCallPromptConfirm = async () => {
    if (!callPromptData) return;
    try {
      await fetch("/api/twilio/trigger-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: callPromptData.orderId, phone: callPromptData.phone })
      });
      showToast(isRtl ? "שיחה נשלחה בהצלחה" : "Call sent successfully");
    } catch (e) {
      console.error(e);
      showToast(isRtl ? "שגיאה בשליחת השיחה" : "Error sending call", "error");
    } finally {
      setCallPromptData(null);
    }
  };

  const updateResult = async (orderId: string, result: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    await saveOrder({ ...order, result });
  };

  const updateLocation = async (orderId: string, location: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    await saveOrder({ ...order, location });
  };

  const handleArchive = async (order: Order) => {
    if (confirm(isRtl ? `האם אתה בטוח שברצונך להעביר את הזמנה ${order.id} לארכיון?` : `Are you sure you want to archive order ${order.id}?`)) {
      await saveOrder({ ...order, archived: true });
      showToast(isRtl ? "ההזמנה הועברה לארכיון בהצלחה!" : "Order archived successfully!", "success");
    }
  };

  const handleUnarchive = async (order: Order) => {
    if (confirm(isRtl ? `האם אתה בטוח שברצונך להחזיר את הזמנה ${order.id} מהארכיון?` : `Are you sure you want to restore order ${order.id} from archive?`)) {
      await saveOrder({ ...order, archived: false });
      showToast(isRtl ? "ההזמנה הוחזרה מהארכיון בהצלחה!" : "Order restored from archive successfully!", "success");
    }
  };

  const handleDeletePermanent = async (orderId: string) => {
    if (confirm(isRtl ? "האם אתה בטוח שברצונך למחוק הזמנה זו לצמיתות? לא ניתן יהיה לשחזר אותה." : "Are you sure you want to permanently delete this order? This action cannot be undone.")) {
      await deleteOrder(orderId);
      showToast(isRtl ? "ההזמנה נמחקה לצמיתות!" : "Order permanently deleted!", "success");
    }
  };

  const triggerOutboundCallFromAdmin = async (orderId: string, phone: string) => {
    if (!phone) {
      showToast(isRtl ? "שגיאה: אין מספר טלפון להזמנה זו" : "Error: No phone number associated with this order", "error");
      return;
    }
    
    if (!forwardingNumber) {
      showToast(isRtl ? "שגיאה: אנא הגדר תחילה מספר להעברת שיחות (Forwarding Number) בלשונית הגדרות" : "Error: Please configure a forwarding phone number first in Settings", "error");
      return;
    }

    const order = orders.find(o => o.id === orderId);
    const customerName = order ? order.customerName : "";

    if (confirm(isRtl 
      ? `האם להתקשר ללקוח בטלפון ${phone}? המערכת תתקשר לטלפון שלך (${forwardingNumber}) תחילה ותחבר אותך.` 
      : `Call customer at ${phone}? The system will ring your phone (${forwardingNumber}) first to connect you.`
    )) {
      try {
        showToast(isRtl ? "מתקשר לטלפון שלך כעת..." : "Calling your phone now...", "info");
        const res = await fetch("/api/twilio/bridge-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            phone, 
            adminPhone: forwardingNumber,
            customerName,
            orderId
          })
        });
        if (res.ok) {
          showToast(isRtl ? "השיחה הופעלה! המתן לצלצול בטלפון שלך." : "Call triggered! Answer your phone to connect.", "success");
        } else {
          const errData = await res.json();
          showToast(isRtl ? `שגיאה בהפעלת השיחה: ${errData.error || ""}` : `Error triggering call: ${errData.error || ""}`, "error");
        }
      } catch (err) {
        console.error(err);
        showToast(isRtl ? "שגיאה בהפעלת השיחה" : "Error triggering call", "error");
      }
    }
  };

  const triggerOutboundCallFromDelivery = async (phone: string, customerName: string) => {
    if (!phone) {
      showToast(isRtl ? "שגיאה: אין מספר טלפון" : "Error: No phone number provided", "error");
      return;
    }
    
    if (!forwardingNumber) {
      showToast(isRtl ? "שגיאה: אנא הגדר תחילה מספר להעברת שיחות (Forwarding Number) בלשונית הגדרות" : "Error: Please configure a forwarding phone number first in Settings", "error");
      return;
    }

    if (confirm(isRtl 
      ? `האם להתקשר ללקוח בטלפון ${phone}? המערכת תתקשר לטלפון שלך (${forwardingNumber}) תחילה ותחבר אותך.` 
      : `Call customer at ${phone}? The system will ring your phone (${forwardingNumber}) first to connect you.`
    )) {
      try {
        showToast(isRtl ? "מתקשר לטלפון שלך כעת..." : "Calling your phone now...", "info");
        const res = await fetch("/api/twilio/bridge-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            phone, 
            adminPhone: forwardingNumber,
            customerName
          })
        });
        if (res.ok) {
          showToast(isRtl ? "השיחה הופעלה! המתן לצלצול בטלפון שלך." : "Call triggered! Answer your phone to connect.", "success");
        } else {
          const errData = await res.json();
          showToast(isRtl ? `שגיאה בהפעלת השיחה: ${errData.error || ""}` : `Error triggering call: ${errData.error || ""}`, "error");
        }
      } catch (err) {
        console.error(err);
        showToast(isRtl ? "שגיאה בהפעלת השיחה" : "Error triggering call", "error");
      }
    }
  };

  const handleSendSms = async () => {
    const selectedCall = calls.find(c => c.id === selectedCallId) || calls[0];
    if (!smsInput.trim() || !selectedCall) return;
    setSendingSms(true);
    try {
      const res = await fetch("/api/twilio/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedCall.phone, message: smsInput })
      });
      if (res.ok) {
        setSmsInput("");
      } else {
        const errData = await res.json();
        showToast(isRtl ? `שגיאה בשליחת ה-SMS: ${errData.error || ""}` : `Error sending SMS: ${errData.error || ""}`, "error");
      }
    } catch (error) {
      console.error("Failed to send SMS:", error);
      showToast(isRtl ? "שגיאה בחיבור לשרת" : "Network error sending SMS", "error");
    } finally {
      setSendingSms(false);
    }
  };

  const sendSmsFromVirtualPhone = async (phone: string, message: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/twilio/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message })
      });
      if (res.ok) {
        showToast(isRtl ? "הודעה נשלחה בהצלחה" : "Message sent successfully", "success");
        return true;
      } else {
        const errData = await res.json();
        showToast(isRtl ? `שגיאה בשליחת ה-SMS: ${errData.error || ""}` : `Error sending SMS: ${errData.error || ""}`, "error");
        return false;
      }
    } catch (error) {
      console.error("Failed to send SMS:", error);
      showToast(isRtl ? "שגיאה בחיבור לשרת" : "Network error sending SMS", "error");
      return false;
    }
  };

  const filteredOrders = [...orders].filter(
    (o) =>
      !o.archived &&
      (o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
       o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (o.phone && o.phone.includes(searchQuery)))
  ).sort((a, b) => {
    if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;
    if (a.createdAt) return -1;
    if (b.createdAt) return 1;
    return new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime();
  });

  const archivedOrders = [...orders].filter(
    (o) =>
      !!o.archived &&
      (o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
       o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (o.phone && o.phone.includes(searchQuery)))
  ).sort((a, b) => {
    if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;
    if (a.createdAt) return -1;
    if (b.createdAt) return 1;
    return new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime();
  });



  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-300px)] bg-primary-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full mx-4"
        >
          <div className={`card p-8 ${isRtl ? "text-right" : ""}`}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-navy-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-navy-600" />
              </div>
              <h1 className="text-2xl font-bold text-navy-900">{t("admin_panel")}</h1>
              <p className="text-sm text-primary-500 mt-1">{isRtl ? "הזן שם משתמש וקוד מנהל" : "Enter User ID and PIN"}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setPinError(false);
                }}
                placeholder={isRtl ? "שם משתמש" : "User ID"}
                className={`w-full px-4 py-3 rounded-xl border text-center text-lg font-semibold
                         bg-primary-50 focus:outline-none focus:ring-2 focus:border-transparent
                         transition-all duration-200
                         ${pinError ? "border-red-300 focus:ring-red-300" : "border-primary-200 focus:ring-gold-400"}`}
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""));
                  setPinError(false);
                }}
                placeholder="PIN"
                className={`w-full px-4 py-3 rounded-xl border text-center text-lg font-semibold tracking-widest
                         bg-primary-50 focus:outline-none focus:ring-2 focus:border-transparent
                         transition-all duration-200
                         ${pinError ? "border-red-300 focus:ring-red-300" : "border-primary-200 focus:ring-gold-400"}`}
              />
              {pinError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-red-500 text-center"
                >
                  {isRtl ? "קוד שגוי" : "Incorrect PIN"}
                </motion.p>
              )}
              <button type="submit" className="btn-secondary w-full">
                {t("login")}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between">
              <span className="border-b border-primary-200 w-1/5 lg:w-1/4"></span>
              <span className="text-xs text-center text-primary-400 uppercase">{isRtl ? "או" : "or"}</span>
              <span className="border-b border-primary-200 w-1/5 lg:w-1/4"></span>
            </div>

            <button
              onClick={handleGoogleLogin}
              type="button"
              className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-primary-200 rounded-xl hover:bg-primary-50 transition-colors font-medium text-navy-800"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {isRtl ? "התחבר עם חשבון Google" : "Sign in with Google"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-50">
      <Script
        src="/twilio.js"
        strategy="afterInteractive"
        onLoad={() => console.log("Twilio Voice SDK loaded globally on admin page")}
      />

      {/* Mobile Top Bar */}
      <div className={`lg:hidden fixed top-0 left-0 right-0 z-40 bg-navy-900 text-white px-4 py-3 flex items-center justify-between shadow-lg ${isRtl ? "flex-row-reverse" : ""}`}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl hover:bg-navy-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gold-500 rounded-lg flex items-center justify-center">
            <Microscope className="w-4 h-4 text-navy-900" />
          </div>
          <span className="font-bold text-sm">The Shatnez Lab</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Sidebar Backdrop (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`admin-sidebar ${isRtl ? "right-0" : "left-0"} ${
          sidebarOpen ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Sidebar Logo */}
        <div className="px-5 py-6 border-b border-navy-800">
          <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="w-9 h-9 bg-gold-500 rounded-xl flex items-center justify-center shrink-0">
              <Microscope className="w-5 h-5 text-navy-900" />
            </div>
            <div className={isRtl ? "text-right" : ""}>
              <h2 className="font-bold text-sm text-white leading-tight">The Shatnez Lab</h2>
              <p className="text-[10px] text-navy-400">{isRtl ? "לוח בקרה" : "Admin Dashboard"}</p>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className={`flex-1 py-4 px-3 space-y-1 overflow-y-auto ${isRtl ? "text-right" : ""}`}>
          <button
            onClick={() => { setActiveAdminTab("orders"); setSidebarOpen(false); }}
            className={`admin-sidebar-item ${isRtl ? "flex-row-reverse" : ""} ${
              activeAdminTab === "orders" ? "admin-sidebar-item--active" : "admin-sidebar-item--inactive"
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "ניהול הזמנות" : "Orders"}</span>
          </button>

          <button
            onClick={() => { setActiveAdminTab("deliveries"); setSidebarOpen(false); }}
            className={`admin-sidebar-item ${isRtl ? "flex-row-reverse" : ""} ${
              activeAdminTab === "deliveries" ? "admin-sidebar-item--active" : "admin-sidebar-item--inactive"
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "איסוף ומשלוחים" : "Pick up & Delivery"}</span>
            {deliveries.filter(d => d.status === "pending").length > 0 && (
              <span className="ms-auto bg-gold-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {deliveries.filter(d => d.status === "pending").length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveAdminTab("voicemails"); setSidebarOpen(false); }}
            className={`admin-sidebar-item ${isRtl ? "flex-row-reverse" : ""} ${
              activeAdminTab === "voicemails" ? "admin-sidebar-item--active" : "admin-sidebar-item--inactive"
            }`}
          >
            <Volume2 className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "הודעות ותא קולי" : "Voicemails"}</span>
            {voicemails.filter(v => !v.read).length > 0 && (
              <span className="ms-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {voicemails.filter(v => !v.read).length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveAdminTab("audio"); setSidebarOpen(false); }}
            className={`admin-sidebar-item ${isRtl ? "flex-row-reverse" : ""} ${
              activeAdminTab === "audio" ? "admin-sidebar-item--active" : "admin-sidebar-item--inactive"
            }`}
          >
            <FileAudio className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "שמע IVR" : "IVR Audio"}</span>
          </button>

          <button
            onClick={() => { setActiveAdminTab("calls"); setSidebarOpen(false); }}
            className={`admin-sidebar-item ${isRtl ? "flex-row-reverse" : ""} ${
              activeAdminTab === "calls" ? "admin-sidebar-item--active" : "admin-sidebar-item--inactive"
            }`}
          >
            <PhoneCall className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "יומן שיחות" : "Call Logs"}</span>
          </button>

          <button
            onClick={() => { setActiveAdminTab("analytics"); setSidebarOpen(false); }}
            className={`admin-sidebar-item ${isRtl ? "flex-row-reverse" : ""} ${
              activeAdminTab === "analytics" ? "admin-sidebar-item--active" : "admin-sidebar-item--inactive"
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "אנליטיקה" : "Analytics"}</span>
          </button>

          <button
            onClick={() => { setActiveAdminTab("archive"); setSidebarOpen(false); }}
            className={`admin-sidebar-item ${isRtl ? "flex-row-reverse" : ""} ${
              activeAdminTab === "archive" ? "admin-sidebar-item--active" : "admin-sidebar-item--inactive"
            }`}
          >
            <Archive className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "ארכיון" : "Archive"}</span>
          </button>

          <button
            onClick={() => { setActiveAdminTab("settings"); setSidebarOpen(false); }}
            className={`admin-sidebar-item ${isRtl ? "flex-row-reverse" : ""} ${
              activeAdminTab === "settings" ? "admin-sidebar-item--active" : "admin-sidebar-item--inactive"
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "הגדרות" : "Settings"}</span>
          </button>

          <button
            onClick={() => { setActiveAdminTab("billing"); setSidebarOpen(false); }}
            className={`admin-sidebar-item ${isRtl ? "flex-row-reverse" : ""} ${
              activeAdminTab === "billing" ? "admin-sidebar-item--active" : "admin-sidebar-item--inactive"
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "חיוב ועלויות" : "Billing & Costs"}</span>
          </button>
        </nav>

        {/* Twilio Cost Sidebar Widget */}
        {billingData && billingData.success && (
          <div className="mx-3 my-2 p-3 bg-navy-800/40 rounded-xl border border-navy-700/50 transition-all duration-300 hover:border-gold-500/30">
            <button 
              onClick={() => { setActiveAdminTab("billing"); setSidebarOpen(false); }}
              className="w-full text-left font-sans block focus:outline-none"
            >
              <div className={`flex items-center justify-between ${isRtl ? "flex-row-reverse text-right" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-gold-400" />
                  <span className="text-[10px] text-navy-300 font-semibold tracking-wider uppercase">
                    {isRtl ? "עלות טוויליו" : "Twilio Cost"}
                  </span>
                </div>
                <span className="text-[9px] px-1 py-0.5 rounded bg-gold-500/10 text-gold-400 font-semibold uppercase">
                  {isRtl ? "החודש" : "This Month"}
                </span>
              </div>
              <div className={`mt-2 flex items-baseline gap-1 ${isRtl ? "flex-row-reverse text-right" : ""}`}>
                <span className="text-lg font-bold text-white tracking-tight">
                  ${billingData.thisMonth.total.toFixed(2)}
                </span>
                <span className="text-[9px] text-navy-400 uppercase font-medium">
                  {billingData.currency}
                </span>
              </div>
              {billingData.lastMonth && billingData.lastMonth.total > 0 && (
                <div className={`mt-1 flex items-center gap-1 text-[9px] ${isRtl ? "flex-row-reverse text-right" : ""}`}>
                  <span className="text-navy-400">{isRtl ? "חודש שעבר:" : "Last Month:"}</span>
                  <span className={`font-semibold ${
                    billingData.thisMonth.total <= billingData.lastMonth.total 
                      ? "text-emerald-400" 
                      : "text-rose-400"
                  }`}>
                    ${billingData.lastMonth.total.toFixed(2)}
                  </span>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Sidebar Bottom Actions */}
        <div className="px-3 py-4 border-t border-navy-800 space-y-2">
          <button
            onClick={() => { setShowPhoneModal(true); setSidebarOpen(false); }}
            className={`admin-sidebar-item text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 ${isRtl ? "flex-row-reverse" : ""}`}
          >
            <Phone className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "טלפון משרדי" : "Office Phone"}</span>
          </button>

          <button
            onClick={() => { setShowBlueprintModal(true); setSidebarOpen(false); }}
            className={`admin-sidebar-item text-gold-400 hover:text-gold-300 hover:bg-gold-900/30 ${isRtl ? "flex-row-reverse" : ""}`}
          >
            <Network className="w-4 h-4 shrink-0" />
            <span>{isRtl ? "מפת IVR" : "IVR Blueprint"}</span>
          </button>

          <div className="pt-2 border-t border-navy-800">
            <button
              onClick={() => {
                setIsAuthenticated(false);
                localStorage.removeItem("admin_authenticated");
              }}
              className={`admin-sidebar-item text-navy-400 hover:text-red-400 hover:bg-red-900/20 ${isRtl ? "flex-row-reverse" : ""}`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{t("logout")}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`min-h-screen transition-all duration-300 ${isRtl ? "lg:mr-60" : "lg:ml-60"} pt-16 lg:pt-0`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
          {/* Page Header */}
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 ${isRtl ? "sm:flex-row-reverse text-right" : ""}`}>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-navy-900">
                {activeAdminTab === "orders" ? (isRtl ? "ניהול הזמנות" : "Orders Management") :
                 activeAdminTab === "deliveries" ? (isRtl ? "ניהול איסוף ומשלוחים" : "Pickup & Delivery Management") :
                 activeAdminTab === "voicemails" ? (isRtl ? "הודעות ותא קולי" : "Voicemails & Messages") :
                 activeAdminTab === "audio" ? (isRtl ? "מנהל שמע IVR" : "IVR Audio Manager") :
                 activeAdminTab === "calls" ? (isRtl ? "יומן שיחות" : "Call Logs") :
                 activeAdminTab === "analytics" ? (isRtl ? "אנליטיקה" : "Analytics") :
                 activeAdminTab === "archive" ? (isRtl ? "ארכיון" : "Archive") :
                 activeAdminTab === "settings" ? (isRtl ? "הגדרות מערכת" : "System Settings") :
                 activeAdminTab === "billing" ? (isRtl ? "חיוב ועלויות Twilio" : "Twilio Billing & Costs") :
                 t("orders_management")}
              </h1>
              <p className="text-sm text-primary-500 mt-0.5">
                {activeAdminTab === "billing" ? (isRtl ? "ניהול ומעקב אחר עלויות השימוש ב-Twilio במעבדה" : "Track and manage Twilio usage costs for the lab") :
                 activeAdminTab === "deliveries" ? (isRtl ? "מעקב וניהול בקשות של לקוחות לאיסוף והחזרה מדלת לדלת" : "Track and manage door-to-door garment pickup and delivery requests") :
                 (isRtl ? "לוח בקרה וניהול הזמנות מערכת" : "System Dashboard and Order Management")}
              </p>
            </div>
          </div>

        <AnimatePresence mode="wait">

          {activeAdminTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8"
            >
              <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isRtl ? "direction-rtl" : ""}`}>
                {/* Admin Access & Security */}
                <div className={`card p-6 bg-white shadow-sm border border-navy-100 ${isRtl ? "text-right" : ""}`}>
                  <div className={`flex items-center gap-2 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <Lock className="w-5 h-5 text-navy-600" />
                    <h2 className="text-lg font-bold text-navy-900">{isRtl ? "גישת מנהל ואבטחה" : "Admin Access & Security"}</h2>
                  </div>
                  <p className="text-sm text-primary-600 mb-4">
                    {isRtl ? "ניהול פרטי ההתחברות לאתר ולמערכת הטלפונית." : "Manage your login credentials for the website and phone system."}
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "שם משתמש למנהל" : "Admin User ID"}</label>
                      <input
                        type="text"
                        value={newAdminUser}
                        onChange={(e) => setNewAdminUser(e.target.value)}
                        placeholder={isRtl ? "שם משתמש" : "User ID"}
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "אימייל מורשה ל-Google Login" : "Authorized Google Email"}</label>
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="your@email.com"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "קוד מנהל" : "Admin PIN"}</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                        placeholder={isRtl ? "קוד חדש בן 4 ספרות" : "New 4-digit PIN"}
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "מספר להעברת שיחות" : "Forwarding Number"}</label>
                      <input
                        type="tel"
                        value={newForwardingNumber}
                        onChange={(e) => setNewForwardingNumber(e.target.value)}
                        placeholder="e.g. 8455524744"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "שעת התחלה" : "Start Time"}</label>
                        <input
                          type="time"
                          value={forwardingHoursStart}
                          onChange={(e) => setForwardingHoursStart(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "שעת סיום" : "End Time"}</label>
                        <input
                          type="time"
                          value={forwardingHoursEnd}
                          onChange={(e) => setForwardingHoursEnd(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-navy-800 mb-1">{isRtl ? "מספר טלפון ב-Twilio (עם +)" : "Twilio Phone Number (with +)"}</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2 focus:border-navy-500 focus:ring-1 focus:ring-navy-500 font-mono text-left"
                        dir="ltr"
                        placeholder="+18451234567"
                        value={twilioPhoneNumber}
                        onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">
                        {isRtl ? "מזהה מתקשר בשיחה מועברת" : "Caller ID for Forwarded Calls"}
                      </label>
                      <select
                        value={callerIdType}
                        onChange={(e) => setCallerIdType(e.target.value as "caller" | "twilio")}
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      >
                        <option value="caller">
                          {isRtl ? "הצג מספר לקוח מתקשר" : "Show Customer Number (Caller ID)"}
                        </option>
                        <option value="twilio">
                          {isRtl ? "הצג מספר טלפון של המעבדה" : "Show Twilio Number (Shatnez Lab)"}
                        </option>
                      </select>
                    </div>
                    
                    <div className="border-t border-primary-200 pt-4 mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-navy-900">
                          {isRtl ? "נא לא להפריע (DND)" : "Do Not Disturb (DND)"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDndActive(!dndActive)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            dndActive ? "bg-gold-500" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              dndActive ? (isRtl ? "-translate-x-5" : "translate-x-5") : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-xs text-primary-500 mb-4">
                        {isRtl
                          ? "כאשר פעיל, שיחות נציג יועברו ישירות לתא הקולי."
                          : "When active, representative calls route straight to voicemail."}
                      </p>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-navy-900">
                          {isRtl ? "מצב חופשה / חגים" : "Holiday / Vacation Mode"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setHolidayModeActive(!holidayModeActive)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            holidayModeActive ? "bg-gold-500" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              holidayModeActive ? (isRtl ? "-translate-x-5" : "translate-x-5") : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-xs text-primary-500 mb-3">
                        {isRtl
                          ? "כאשר מצב חופשה פעיל, כל השיחות יועברו ישירות לתא הקולי ותושמע הודעת החג המוגדר מטה."
                          : "When holiday mode is active, all calls are routed straight to voicemail playing the holiday messages below."}
                      </p>
                      
                      {holidayModeActive && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">
                              {isRtl ? "הודעת חג באנגלית" : "Holiday Message (English)"}
                            </label>
                            <textarea
                              value={ivrHolidayMsgEn}
                              onChange={(e) => setIvrHolidayMsgEn(e.target.value)}
                              rows={2}
                              className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-xs ${isRtl ? "text-right" : ""}`}
                              placeholder="Our office is closed for the holidays..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">
                              {isRtl ? "הודעת חג בעברית" : "Holiday Message (Hebrew)"}
                            </label>
                            <textarea
                              value={ivrHolidayMsgHe}
                              onChange={(e) => setIvrHolidayMsgHe(e.target.value)}
                              rows={2}
                              className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-xs ${isRtl ? "text-right" : ""}`}
                              placeholder="המשרד סגור כעת לרגל החג..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={handleUpdateSettings}
                      className="btn-primary w-full py-2"
                    >
                      {isRtl ? "עדכן הגדרות" : "Update Settings"}
                    </button>
                  </div>
                </div>

                {/* Voicemail to Email Settings */}
                <div className={`card p-6 bg-white shadow-sm border border-navy-100 ${isRtl ? "text-right" : ""}`}>
                  <div className={`flex items-center gap-2 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <Volume2 className="w-5 h-5 text-navy-600" />
                    <h2 className="text-lg font-bold text-navy-900">{isRtl ? "הגדרות תא קולי לאימייל" : "Voicemail-to-Email Settings"}</h2>
                  </div>
                  <p className="text-sm text-primary-600 mb-4">
                    {isRtl ? "הגדר את כתובת האימייל לקבלת הקלטות של הודעות קוליות מהמתקשרים ב-IVR." : "Receive audio recordings left by callers on the IVR flow directly to your email."}
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "כתובת אימייל ליעד" : "Destination Email"}</label>
                      <input
                        type="email"
                        value={voicemailEmail}
                        onChange={(e) => setVoicemailEmail(e.target.value)}
                        placeholder="e.g. yourname@gmail.com"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "שרת SMTP" : "SMTP Host"}</label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="e.g. smtp.gmail.com"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "פורט SMTP" : "SMTP Port"}</label>
                      <input
                        type="text"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="e.g. 465 (SSL) or 587 (TLS)"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "שם משתמש SMTP" : "SMTP Username"}</label>
                      <input
                        type="text"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="e.g. yourname@gmail.com"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "סיסמת SMTP" : "SMTP Password"}</label>
                      <input
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <button 
                      onClick={handleUpdateSettings}
                      className="btn-primary w-full py-2"
                    >
                      {isRtl ? "שמור הגדרות אימייל" : "Save Email Settings"}
                    </button>
                  </div>
                </div>

                {/* Twilio API Credentials */}
                <div className={`card p-6 bg-white shadow-sm border border-navy-100 ${isRtl ? "text-right" : ""}`}>
                  <div className={`flex items-center gap-2 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <Sliders className="w-5 h-5 text-navy-600" />
                    <h2 className="text-lg font-bold text-navy-900">{isRtl ? "הגדרות Twilio API" : "Twilio API Credentials"}</h2>
                  </div>
                  <p className="text-sm text-primary-600 mb-4">
                    {isRtl ? "הזן את פרטי ה-API של Twilio כדי לאפשר שיחות WebRTC ישירות מהדפדפן וניגון הקלטות." : "Enter your Twilio API details to allow WebRTC calls directly from the browser and voicemail playback."}
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "חשבון SID" : "Account SID"}</label>
                      <input
                        type="text"
                        value={twilioAccountSid}
                        onChange={(e) => setTwilioAccountSid(e.target.value)}
                        placeholder="AC..."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "מפתח Auth Token" : "Auth Token"}</label>
                      <input
                        type="password"
                        value={twilioAuthToken}
                        onChange={(e) => setTwilioAuthToken(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "מפתח API Key SID (WebRTC)" : "API Key SID (WebRTC)"}</label>
                      <input
                        type="text"
                        value={twilioApiKey}
                        onChange={(e) => setTwilioApiKey(e.target.value)}
                        placeholder="SK..."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "מפתח API Key Secret" : "API Key Secret"}</label>
                      <input
                        type="password"
                        value={twilioApiSecret}
                        onChange={(e) => setTwilioApiSecret(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "מזהה TwiML App SID" : "TwiML App SID"}</label>
                      <input
                        type="text"
                        value={twilioTwimlAppSid}
                        onChange={(e) => setTwilioTwimlAppSid(e.target.value)}
                        placeholder="AP..."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <button 
                      onClick={handleUpdateSettings}
                      className="btn-primary w-full py-2"
                    >
                      {isRtl ? "שמור הגדרות Twilio" : "Save Twilio Settings"}
                    </button>
                  </div>
                </div>

                {/* Google Gemini AI Credentials */}
                <div className={`card p-6 bg-white shadow-sm border border-navy-100 ${isRtl ? "text-right" : ""}`}>
                  <div className={`flex items-center gap-2 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <Sliders className="w-5 h-5 text-navy-600" />
                    <h2 className="text-lg font-bold text-navy-900">{isRtl ? "הגדרות Google Gemini AI" : "Google Gemini AI Settings"}</h2>
                  </div>
                  <p className="text-sm text-primary-600 mb-4">
                    {isRtl ? "הזן מפתח API של Google Gemini (מאת Google AI Studio) כדי לאפשר סיוע AI חכם בהודעות SMS." : "Enter your Google Gemini API Key from Google AI Studio to enable AI assistance in SMS."}
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">{isRtl ? "מפתח API Key" : "Gemini API Key"}</label>
                      <input
                        type="password"
                        value={newGeminiApiKey}
                        onChange={(e) => setNewGeminiApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <button 
                      onClick={handleUpdateSettings}
                      className="btn-primary w-full py-2"
                    >
                      {isRtl ? "שמור הגדרות Gemini" : "Save Gemini Settings"}
                    </button>
                  </div>
                </div>

                {/* Custom IVR Voice Prompts */}
                <div className={`card p-6 bg-white shadow-sm border border-navy-100 lg:col-span-2 ${isRtl ? "text-right" : ""}`}>
                  <div className={`flex items-center gap-2 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <Phone className="w-5 h-5 text-navy-600" />
                    <h2 className="text-lg font-bold text-navy-900">{isRtl ? "התאמת הודעות קוליות לטלפון" : "Custom IVR Voice Prompts"}</h2>
                  </div>
                  <p className="text-sm text-primary-600 mb-4">
                    {isRtl ? "באפשרותך להתאים אישית את הטקסט שהמערכת הטלפונית תקריא. אם השדה ריק, המערכת תשתמש בהודעת ברירת המחדל המקצועית." : "Customize the text the automated phone system speaks. If left empty, the professional default message will be used."}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">
                        {isRtl ? "אופציה 1 - מידע כללי ומחירים (אנגלית)" : "Option 1 - General Info & Pricing (English)"}
                      </label>
                      <textarea
                        rows={3}
                        value={ivrGeneralEn}
                        onChange={(e) => setIvrGeneralEn(e.target.value)}
                        placeholder="Default drop-off & pricing info..."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">
                        {isRtl ? "אופציה 1 - מידע כללי ומחירים (עברית)" : "Option 1 - General Info & Pricing (Hebrew)"}
                      </label>
                      <textarea
                        rows={3}
                        value={ivrGeneralHe}
                        onChange={(e) => setIvrGeneralHe(e.target.value)}
                        placeholder="מידע ברירת מחדל על מסירה ומחירים..."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">
                        {isRtl ? "אופציה 3 - שירותי VIP וחנויות (אנגלית)" : "Option 3 - VIP & Store Services (English)"}
                      </label>
                      <textarea
                        rows={3}
                        value={ivrSpecialEn}
                        onChange={(e) => setIvrSpecialEn(e.target.value)}
                        placeholder="Default VIP and store service info..."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">
                        {isRtl ? "אופציה 3 - שירותי VIP וחנויות (עברית)" : "Option 3 - VIP & Store Services (Hebrew)"}
                      </label>
                      <textarea
                        rows={3}
                        value={ivrSpecialHe}
                        onChange={(e) => setIvrSpecialHe(e.target.value)}
                        placeholder="מידע ברירת מחדל על שירותי VIP וחנויות..."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">
                        {isRtl ? "הודעת מוכן לאיסוף - שיחה קולית (אנגלית)" : "Order Ready Robocall Message (English)"}
                      </label>
                      <textarea
                        rows={3}
                        value={outboundMsgEn}
                        onChange={(e) => setOutboundMsgEn(e.target.value)}
                        placeholder="Hello. This is The Shatnez Lab. We are calling to inform you that your order is now ready for pickup. Pick up at 14 Buchanan Rd. Thank you."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1 uppercase">
                        {isRtl ? "הודעת מוכן לאיסוף - שיחה קולית (עברית)" : "Order Ready Robocall Message (Hebrew)"}
                      </label>
                      <textarea
                        rows={3}
                        value={outboundMsgHe}
                        onChange={(e) => setOutboundMsgHe(e.target.value)}
                        placeholder="שלום. מדברים ממעבדת שעטנז. ההזמנה שלך מוכנה לאיסוף. נא לאסוף מ-14 Buchanan Rd. תודה רבה."
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleUpdateSettings}
                    className="btn-primary w-full py-2 mt-4"
                  >
                    {isRtl ? "שמור הודעות טלפוניות" : "Save Voice Messages"}
                  </button>
                </div>

                {/* Phone System Instructions */}
                <div className={`card p-6 bg-navy-900 text-white lg:col-span-2 ${isRtl ? "text-right" : ""}`}>
                  <div className={`flex items-center gap-2 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <Phone className="w-5 h-5 text-gold-400" />
                    <h2 className="text-lg font-bold">{isRtl ? "הוראות למערכת הטלפונית" : "Phone System Instructions"}</h2>
                  </div>
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 text-sm ${isRtl ? "direction-rtl" : ""}`}>
                    <div>
                      <h3 className="font-bold text-gold-400 mb-2 underline">{isRtl ? "תפריט ראשי" : "Main Menu"}</h3>
                      <ul className={`space-y-1 text-navy-50 ${isRtl ? "pr-0" : ""}`}>
                        <li>• <span className="font-bold">{isRtl ? "אופציה 1:" : "Option 1:"}</span> {isRtl ? "מידע כללי ומחירים" : "General Info & Pricing"}</li>
                        <li>• <span className="font-bold">{isRtl ? "אופציה 2:" : "Option 2:"}</span> {isRtl ? "בדיקת סטטוס ותוצאות (לקוח)" : "Track status & test results"}</li>
                        <li>• <span className="font-bold">{isRtl ? "אופציה 3:" : "Option 3:"}</span> {isRtl ? "שירותי VIP וחנויות" : "VIP & Store services"}</li>
                        <li>• <span className="font-bold">{isRtl ? "אופציה 0:" : "Option 0:"}</span> {isRtl ? "העברת שיחה לנציג" : "FORWARD CALL to representative"}</li>
                        <li>• <span className="font-bold">{isRtl ? "אופציה 9 (מוסתר):" : "Option 9 (Hidden):"}</span> {isRtl ? "גישת מנהל (דורש קוד)" : "Admin access (needs PIN)"}</li>
                        <li>• <span className="font-bold">{isRtl ? "כניסה ישירה:" : "Direct Entry:"}</span> {isRtl ? "הקש מספר הזמנה + #" : "Just type Order # + #"}</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-bold text-gold-400 mb-2 underline">{isRtl ? "תפריט מנהל (אחרי קוד)" : "Admin Menu (After PIN)"}</h3>
                      <ul className={`space-y-1 text-navy-50 ${isRtl ? "pr-0" : ""}`}>
                        <li>• <span className="font-bold">1:</span> {isRtl ? "שמיעת 5 הזמנות אחרונות" : "Hear last 5 recent orders"}</li>
                        <li>• <span className="font-bold">2:</span> {isRtl ? "עדכון סטטוס ותוצאת בדיקה" : "Update status and test result"}</li>
                        <li>• <span className="font-bold">3:</span> {isRtl ? "חיפוש לפי מספר טלפון" : "Lookup orders by phone number"}</li>
                        <li>• <span className="font-bold">4:</span> {isRtl ? "הוספת הזמנה חדשה" : "ADD NEW ORDER by phone"}</li>
                        <li>• <span className="font-bold">*:</span> {isRtl ? "חזרה לתפריט ראשי" : "Back to main menu"}</li>
                      </ul>
                    </div>
                  </div>
                  <div className={`mt-4 pt-4 border-t border-navy-800 flex items-start gap-2 text-xs text-navy-300 ${isRtl ? "flex-row-reverse text-right" : ""}`}>
                    <Info className="w-4 h-4 mt-0.5" />
                    <p>{isRtl ? "קודי סטטוס לעדכון: 1=התקבל, 2=בבדיקה, 3=בביקורת, 4=מוכן, 5=נמסר, 6=בעיה" : "Status Codes for Updates: 1=Received, 2=Testing, 3=Review, 4=Ready, 5=Delivered, 6=Issue"}</p>
                  </div>
                </div>



                {/* Admin Personal Notes & Scratchpad */}
                <div className={`card p-6 bg-white shadow-sm border border-navy-100 lg:col-span-2 flex flex-col justify-between ${isRtl ? "text-right" : ""}`}>
                  <div>
                    <div className={`flex items-center gap-2 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <FileText className="w-5 h-5 text-navy-600" />
                      <h2 className="text-lg font-bold text-navy-900">{isRtl ? "הערות אישיות ומזכר מנהל" : "Admin Personal Notes & Scratchpad"}</h2>
                    </div>
                    <p className="text-xs text-primary-600 mb-4">
                      {isRtl 
                        ? "שטח אישי לכתוב בו תזכורות, רעיונות, שורות קוד של Twilio, או טיוטות. ההערות נשמרות אוטומטית בענן כשתלחץ על 'שמור הגדרות' מתחת לתיבת ה-PIN." 
                        : "Your private scratchpad to store reminders, phone scripts, Twilio templates, or quick ideas. Saved automatically to the cloud when clicking 'Save Settings' under Pin Settings."}
                    </p>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder={isRtl ? "הקלד את ההערות האישיות שלך כאן..." : "Type your personal notes here..."}
                      className={`w-full h-[220px] p-3 text-sm rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none resize-none font-sans leading-relaxed ${isRtl ? "text-right" : ""}`}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orders Management Tab */}
        {activeAdminTab === "orders" && (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Search & Add */}
        <div className={`flex flex-col sm:flex-row gap-4 mb-6 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
          <div className="flex-1 relative">
            <Search className={`absolute ${isRtl ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search_orders")}
              className={`w-full ${isRtl ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left"} py-3 rounded-xl border border-primary-200 bg-white
                       focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                       transition-all duration-200 shadow-sm`}
            />
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary inline-flex items-center gap-2 whitespace-nowrap"
          >
            {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showAddForm ? (isRtl ? "ביטול" : "Cancel") : t("add_new_order")}
          </button>
          <button
            onClick={() => setShowCallModal(true)}
            className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
          >
            <Phone className="w-5 h-5 text-emerald-600" />
            {isRtl ? "התקשר ללקוח" : "Call Customer"}
          </button>
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className={`card p-6 ${isRtl ? "text-right" : ""}`}>
                <h2 className="text-lg font-semibold text-navy-900 mb-4">{t("add_new_order")}</h2>
                <form onSubmit={handleAddOrder} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">{t("customer_name")}</label>
                    <input
                      type="text"
                      required
                      value={newOrder.customerName || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                      placeholder={t("customer_name")}
                      className={`w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent ${isRtl ? "text-right" : ""}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">{t("phone")}</label>
                    <input
                      type="tel"
                      required
                      value={newOrder.phone || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })}
                      placeholder="845-552-4744"
                      className={`w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent ${isRtl ? "text-right" : ""}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">{t("status")}</label>
                    <select
                      value={newOrder.status}
                      onChange={(e) => setNewOrder({ ...newOrder, status: e.target.value as OrderStatus })}
                      className={`w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent ${isRtl ? "text-right" : ""}`}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">{t("date_received")}</label>
                    <input
                      type="date"
                      value={newOrder.dateReceived}
                      onChange={(e) => setNewOrder({ ...newOrder, dateReceived: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent ${isRtl ? "text-right" : ""}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">{t("est_completion")}</label>
                    <input
                      type="date"
                      value={newOrder.estimatedCompletion || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, estimatedCompletion: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent ${isRtl ? "text-right" : ""}`}
                    />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-navy-800 mb-1">{isRtl ? "תוצאה" : "Test Result"}</label>
                    <select
                      value={newOrder.result || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, result: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent cursor-pointer ${isRtl ? "text-right" : ""}`}
                    >
                      {resultOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-1">{isRtl ? "מיקום" : "Location"}</label>
                    <select
                      value={newOrder.location || "14 Buchanan Rd"}
                      onChange={(e) => setNewOrder({ ...newOrder, location: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent cursor-pointer ${isRtl ? "text-right" : ""}`}
                    >
                      <option value="14 Buchanan Rd">14 Buchanan Rd</option>
                      <option value="166 Clinton Lane">166 Clinton Lane</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="block text-sm font-medium text-navy-800 mb-1">{t("notes")}</label>
                    <input
                      type="text"
                      value={newOrder.notes || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                      placeholder={isRtl ? "הערות מיוחדות..." : "Any special notes..."}
                      className={`w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent ${isRtl ? "text-right" : ""}`}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <button type="submit" className="btn-primary inline-flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      {isRtl ? "שמור הזמנה" : "Save Order"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className={`bg-primary-50 border-b border-primary-100 ${isRtl ? "text-right" : "text-left"}`}>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>Order ID</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("customer")}</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("status")}</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 hidden sm:table-cell ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "תאריכים" : "Dates"}</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "תוצאה" : "Result"}</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "מיקום" : "Location"}</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("actions")}</th>
                </tr>
              </thead>
              <tbody className={isRtl ? "text-right" : "text-left"}>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-primary-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-primary-300" />
                      <p>{isRtl ? "לא נמצאו הזמנות" : "No orders found"}</p>
                      {searchQuery && <p className="text-sm mt-1">{isRtl ? "נסה לשנות את החיפוש" : "Try adjusting your search"}</p>}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-primary-50 hover:bg-primary-50/50 transition-colors">
                      <td className="px-4 py-4 font-bold text-navy-900">
                        <button
                          onClick={() => openCustomerModal(order.phone || "", order.customerName)}
                          className="hover:text-gold-600 hover:underline font-bold text-left focus:outline-none"
                          title={isRtl ? "צפה בהיסטוריית לקוח" : "View customer history"}
                        >
                          {order.id}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openCustomerModal(order.phone || "", order.customerName)}
                          className="font-semibold text-navy-800 hover:text-gold-600 hover:underline text-left focus:outline-none block"
                          title={isRtl ? "צפה בהיסטוריית לקוח" : "View customer history"}
                        >
                          {order.customerName}
                        </button>
                        <div className="text-sm text-primary-500 mt-1" dir="ltr">
                          {order.phone ? (
                            <a href={`tel:${order.phone}`} className="hover:text-gold-600 hover:underline">
                              {order.phone}
                            </a>
                          ) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {editingCell?.orderId === order.id && editingCell?.field === 'status' ? (
                          <select
                            autoFocus
                            value={order.status}
                            onChange={(e) => { updateStatus(order.id, e.target.value as OrderStatus); setEditingCell(null); }}
                            onBlur={() => setEditingCell(null)}
                            className={`px-3 py-1.5 rounded-lg border border-gold-300 bg-white text-sm
                                     focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                                     cursor-pointer ${isRtl ? "text-right" : ""}`}
                          >
                            {statusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingCell({orderId: order.id, field: 'status'})}
                            className={`inline-badge ${getStatusBadgeClasses(order.status)}`}
                          >
                            {statusOptions.find(o => o.value === order.status)?.label || order.status}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm hidden sm:table-cell">
                        <div className="space-y-1.5">
                          <div className="text-navy-700 flex items-center gap-1.5">
                            <span className="text-primary-400 text-xs uppercase tracking-wider font-medium">{isRtl ? "קבל:" : "In:"}</span>
                            <span>{order.dateReceived}</span>
                          </div>
                          {order.estimatedCompletion && (
                            <div className="text-primary-600 flex items-center gap-1.5">
                              <span className="text-primary-400 text-xs uppercase tracking-wider font-medium">{isRtl ? "צפי:" : "Est:"}</span>
                              <span>{order.estimatedCompletion}</span>
                            </div>
                          )}
                          {order.callLogs && order.callLogs.length > 0 && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs">
                              {order.callLogs[order.callLogs.length - 1].status === 'completed' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              ) : order.callLogs[order.callLogs.length - 1].status === 'failed' ? (
                                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                              <span className={`font-medium ${
                                order.callLogs[order.callLogs.length - 1].status === 'completed' ? 'text-emerald-700' :
                                order.callLogs[order.callLogs.length - 1].status === 'failed' ? 'text-red-700' :
                                'text-amber-700'
                              }`}>
                                {order.callLogs[order.callLogs.length - 1].status}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {editingCell?.orderId === order.id && editingCell?.field === 'result' ? (
                          <select
                            autoFocus
                            value={order.result || ""}
                            onChange={(e) => { updateResult(order.id, e.target.value); setEditingCell(null); }}
                            onBlur={() => setEditingCell(null)}
                            className={`w-full px-3 py-1.5 rounded-lg border border-gold-300 bg-white text-sm
                                     focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                                     cursor-pointer ${isRtl ? "text-right" : ""}`}
                          >
                            {resultOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingCell({orderId: order.id, field: 'result'})}
                            className={`inline-badge ${getResultBadgeClasses(order.result || "")}`}
                          >
                            {order.result ? (resultOptions.find(o => o.value === order.result)?.label || order.result) : (isRtl ? "אין תוצאה" : "No result")}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editingCell?.orderId === order.id && editingCell?.field === 'location' ? (
                          <select
                            autoFocus
                            value={order.location || "14 Buchanan Rd"}
                            onChange={(e) => { updateLocation(order.id, e.target.value); setEditingCell(null); }}
                            onBlur={() => setEditingCell(null)}
                            className={`w-full px-3 py-1.5 rounded-lg border border-gold-300 bg-white text-sm
                                     focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                                     cursor-pointer ${isRtl ? "text-right" : ""}`}
                          >
                            <option value="14 Buchanan Rd">14 Buchanan Rd</option>
                            <option value="166 Clinton Lane">166 Clinton Lane</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingCell({orderId: order.id, field: 'location'})}
                            className="inline-badge bg-primary-50 text-navy-700 border border-primary-200"
                          >
                            <MapPin className="w-3 h-3 mr-1 shrink-0" />
                            {order.location || "14 Buchanan Rd"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className={`flex items-center gap-1 whitespace-nowrap ${isRtl ? "justify-start" : "justify-end"}`}>
                          <button
                            onClick={() => setPrintOrder(order)}
                            className="p-2 rounded-lg text-navy-600 hover:text-navy-800 hover:bg-navy-100 transition-colors"
                            title={isRtl ? "הדפס כרטיס" : "Print card"}
                          >
                            <Printer className="w-[18px] h-[18px]" />
                          </button>
                          {order.phone && (
                            <button
                              onClick={() => triggerOutboundCallFromAdmin(order.id, order.phone!)}
                              className="p-2 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 transition-colors"
                              title={isRtl ? "הוצא שיחה ללקוח" : "Trigger outbound call"}
                            >
                              <Phone className="w-[18px] h-[18px]" />
                            </button>
                          )}
                          <button
                            onClick={() => handleArchive(order)}
                            className="p-2 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-100 transition-colors"
                            title={isRtl ? "העבר לארכיון" : "Archive order"}
                          >
                            <Archive className="w-[18px] h-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    )}

    {/* Pickup & Delivery Requests Tab */}
    {activeAdminTab === "deliveries" && (
      <motion.div
        key="deliveries"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-6"
      >
        {/* Header Summary Card */}
        <div className="card p-6 bg-white border border-primary-200 shadow-sm">
          <div className={`flex items-center gap-3 mb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <MapPin className="w-8 h-8 text-gold-500 shrink-0" />
            <h2 className="text-2xl font-bold text-navy-900">{isRtl ? "ניהול איסוף ומשלוחים" : "Pickup & Delivery Requests"}</h2>
          </div>
          <p className={`text-sm text-primary-600 leading-relaxed max-w-3xl ${isRtl ? "text-right" : ""}`}>
            {isRtl 
              ? "עקוב ונהל בקשות של לקוחות לאיסוף והחזרה של בגדים מדלת לדלת בעלות $10. המערכת שולחת SMS ומעדכנת כאן בזמן אמת כשלקוח מקיש 5 ואז 1 בתפריט."
              : "Monitor and manage door-to-door garment pickup and delivery requests for $10. New requests are logged here in real-time when callers press 5 and confirm with 1."}
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className={`flex flex-col sm:flex-row gap-4 items-stretch ${isRtl ? "sm:flex-row-reverse" : ""}`}>
          {/* Search */}
          <div className="flex-1 relative">
            <Search className={`absolute ${isRtl ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400`} />
            <input
              type="text"
              value={deliverySearchQuery}
              onChange={(e) => setDeliverySearchQuery(e.target.value)}
              placeholder={isRtl ? "חפש לפי מספר טלפון או שם..." : "Search by phone or name..."}
              className={`w-full ${isRtl ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left"} py-3 rounded-xl border border-primary-200 bg-white focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent transition-all duration-200 shadow-sm`}
            />
          </div>
          
          {/* Filter buttons */}
          <div className="flex bg-primary-100/50 p-1.5 rounded-xl border border-primary-200 overflow-x-auto">
            {[
              { key: "all", label: isRtl ? "הכל" : "All" },
              { key: "pending", label: isRtl ? "ממתין" : "Pending" },
              { key: "called", label: isRtl ? "נוצר קשר" : "Called" },
              { key: "completed", label: isRtl ? "הושלם" : "Completed" },
              { key: "cancelled", label: isRtl ? "בוטל" : "Cancelled" }
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => setDeliveryFilter(btn.key as any)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  deliveryFilter === btn.key 
                    ? "bg-white text-navy-950 shadow" 
                    : "text-primary-600 hover:text-navy-950"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Grid */}
        {(() => {
          const filteredList = deliveries
            .filter(d => {
              // Search filter
              const q = deliverySearchQuery.toLowerCase();
              const matchesQuery = d.phone.includes(q) || (d.customerName && d.customerName.toLowerCase().includes(q));
              
              // Status filter
              const matchesStatus = deliveryFilter === "all" || d.status === deliveryFilter;
              
              return matchesQuery && matchesStatus;
            })
            .sort((a, b) => b.timestamp - a.timestamp);

          if (filteredList.length === 0) {
            return (
              <div className="card p-12 text-center bg-white border border-primary-200 shadow-sm">
                <MapPin className="w-12 h-12 text-primary-300 mx-auto mb-4 animate-bounce" />
                <h3 className="text-lg font-bold text-navy-900 mb-2">{isRtl ? "אין בקשות משלוח מתאימות" : "No matching delivery requests"}</h3>
                <p className="text-sm text-primary-500 max-w-md mx-auto">
                  {isRtl 
                    ? "לא נמצאו בקשות משלוח התואמות לחיפוש או לסינון הנוכחי." 
                    : "No pickup or delivery requests matched your search query or status filter."}
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredList.map(req => (
                <DeliveryRequestCard
                  key={req.id}
                  request={req}
                  isRtl={isRtl}
                  onUpdate={async (id, updates) => {
                    const found = deliveries.find(d => d.id === id);
                    if (!found) return;
                    await saveDeliveryRequest({ ...found, ...updates });
                  }}
                  onDelete={async (id) => {
                    await deleteDeliveryRequest(id);
                    showToast(isRtl ? "בקשת המשלוח נמחקה" : "Delivery request deleted", "success");
                  }}
                  onCall={triggerOutboundCallFromDelivery}
                />
              ))}
            </div>
          );
        })()}
      </motion.div>
    )}

        {/* Analytics Tab */}
    {activeAdminTab === "analytics" && (
      <motion.div
        key="analytics"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-6 animate-fade-in"
      >
        {(() => {
          const stats = getCallAnalytics();
          return (
            <>
              <div className="card p-6 bg-white border border-primary-200 shadow-sm">
                <div className={`flex items-center gap-3 mb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                  <BarChart3 className="w-8 h-8 text-sky-500 shrink-0" />
                  <h2 className="text-2xl font-bold text-navy-900">{isRtl ? "נתוני אנליטיקה ושימוש במערכת" : "System Usage & Call Analytics"}</h2>
                </div>
                <p className="text-sm text-primary-600 leading-relaxed max-w-3xl">
                  {isRtl 
                    ? "ניתוח בזמן אמת של פניות לקוחות, אחוזי שימוש במקשי ה-IVR, משך שיחות ממוצע וחלוקה בין שיחות קוליות להודעות טקסט (SMS)."
                    : "Real-time analysis of customer calls, IVR keypad menu popularity, average talk time, and the split between voice communications and text messages (SMS)."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1 */}
                <div className="card p-5 bg-white border border-primary-150 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-center text-sky-600 shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-primary-400 font-bold uppercase tracking-wider">{isRtl ? "שיחות קוליות" : "Voice Calls"}</div>
                    <div className="text-2xl font-black text-navy-900 mt-0.5">{stats.totalVoice}</div>
                    <div className="text-[10px] text-primary-400 mt-0.5">
                      {isRtl 
                        ? `${stats.totalInbound} נכנסות • ${stats.totalOutbound} יוצאות` 
                        : `${stats.totalInbound} Inbound • ${stats.totalOutbound} Outbound`}
                    </div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="card p-5 bg-white border border-primary-150 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-gold-50 border border-gold-100 rounded-xl flex items-center justify-center text-gold-600 shrink-0">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-primary-400 font-bold uppercase tracking-wider">{isRtl ? "שיחות SMS" : "SMS Chats"}</div>
                    <div className="text-2xl font-black text-navy-900 mt-0.5">{stats.totalSms}</div>
                    <div className="text-[10px] text-primary-400 mt-0.5">{isRtl ? "צ'אטים פעילים מול לקוחות" : "Active customer SMS logs"}</div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="card p-5 bg-white border border-primary-150 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-primary-400 font-bold uppercase tracking-wider">{isRtl ? "ממוצע משך שיחה" : "Avg Call Duration"}</div>
                    <div className="text-2xl font-black text-navy-900 mt-0.5">{formatDuration(stats.avgDuration, isRtl)}</div>
                    <div className="text-[10px] text-primary-400 mt-0.5">{isRtl ? "בשיחות קוליות שהושלמו" : "For completed voice calls"}</div>
                  </div>
                </div>

                {/* Card 4 */}
                <div className="card p-5 bg-white border border-primary-150 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-primary-400 font-bold uppercase tracking-wider">{isRtl ? "סך הקשות ב-IVR" : "Total IVR Keypresses"}</div>
                    <div className="text-2xl font-black text-navy-900 mt-0.5 font-mono">
                      {Object.values(stats.keypressCount).reduce((a, b) => a + b, 0)}
                    </div>
                    <div className="text-[10px] text-primary-400 mt-0.5">{isRtl ? "אינטראקציות בתפריט הראשי" : "Welcome menu keypad actions"}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Keypad popularity */}
                <div className="lg:col-span-7 card p-6 bg-white border border-primary-200 shadow-sm">
                  <h3 className={`text-lg font-bold text-navy-900 mb-4 border-b border-primary-100 pb-2 ${isRtl ? "text-right" : ""}`}>
                    {isRtl ? "פופולריות מקשים בתפריט הראשי" : "IVR Keypad Popularity"}
                  </h3>
                  
                  <div className="space-y-4">
                    {[
                      { key: "1", labelHe: "מקש 1 - הנחיות מסירה ומחירים", labelEn: "Key 1 - Drop-off & Pricing Info", count: stats.keypressCount["1"], color: "bg-sky-500" },
                      { key: "2", labelHe: "מקש 2 - בדיקת סטטוס הזמנה קולית", labelEn: "Key 2 - Check Order Status", count: stats.keypressCount["2"], color: "bg-gold-500" },
                      { key: "3", labelHe: "מקש 3 - שירותים מיוחדים ו-VIP", labelEn: "Key 3 - VIP & Special Services", count: stats.keypressCount["3"], color: "bg-indigo-500" },
                      { key: "0", labelHe: "מקש 0 - מעבר לנציג / שיחה ישירה", labelEn: "Key 0 - Speak to Representative", count: stats.keypressCount["0"], color: "bg-emerald-500" },
                      { key: "9", labelHe: "מקש 9 - בקשת כניסה לממשק מנהל", labelEn: "Key 9 - Admin Menu Access", count: stats.keypressCount["9"], color: "bg-purple-500" },
                    ].map((item) => {
                      const total = Object.values(stats.keypressCount).reduce((a, b) => a + b, 0) || 1;
                      const percent = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.key} className="space-y-1.5">
                          <div className={`flex justify-between text-xs font-bold text-navy-800 ${isRtl ? "flex-row-reverse" : ""}`}>
                            <span>{isRtl ? item.labelHe : item.labelEn}</span>
                            <span className="font-mono">{item.count} {isRtl ? "לחיצות" : "clicks"} ({percent}%)</span>
                          </div>
                          <div className="h-3 w-full bg-primary-100 rounded-full overflow-hidden">
                            <motion.div 
                              className={`h-full ${item.color}`}
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

                {/* Keypad Heatmap Visual */}
                <div className="lg:col-span-5 card p-6 bg-white border border-primary-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className={`text-base font-bold text-navy-900 mb-4 border-b border-primary-100 pb-2 ${isRtl ? "text-right" : ""}`}>
                      {isRtl ? "סימולטור מקשי טלפון IVR" : "Keypad Call Volume Visualizer"}
                    </h3>
                    <p className={`text-xs text-primary-500 mb-6 ${isRtl ? "text-right" : ""}`}>
                      {isRtl 
                        ? "הדמיית מפת חום (Heatmap) של מקשי הטלפון בהם המשתמשים מקישים הכי הרבה בקו הטלפון של המעבדה."
                        : "A heat map visualizer of the buttons callers press most when dialling the lab's line."}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto w-full mb-4">
                    {[
                      { digit: "1", count: stats.keypressCount["1"] },
                      { digit: "2", count: stats.keypressCount["2"] },
                      { digit: "3", count: stats.keypressCount["3"] },
                      { digit: "4", count: 0 },
                      { digit: "5", count: 0 },
                      { digit: "6", count: 0 },
                      { digit: "7", count: 0 },
                      { digit: "8", count: 0 },
                      { digit: "9", count: stats.keypressCount["9"] },
                      { digit: "*", count: 0 },
                      { digit: "0", count: stats.keypressCount["0"] },
                      { digit: "#", count: 0 }
                    ].map((btn) => {
                      const maxClicks = Math.max(...Object.values(stats.keypressCount)) || 1;
                      const intensity = btn.count > 0 ? Math.max(0.1, btn.count / maxClicks) : 0;
                      const bgStyle = btn.count > 0 
                        ? { backgroundColor: `rgba(234, 179, 8, ${intensity * 0.9})`, border: '2px solid rgba(234, 179, 8, 1)' }
                        : {};
                      return (
                        <div 
                          key={btn.digit} 
                          style={bgStyle}
                          className={`aspect-square rounded-xl border border-primary-200 flex flex-col items-center justify-center transition-all bg-primary-50`}
                        >
                          <span className="text-lg font-black text-navy-950 font-mono">{btn.digit}</span>
                          {btn.count > 0 && (
                            <span className="text-[9px] font-bold text-navy-800 font-mono">{btn.count}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </motion.div>
    )}

{/* Archived Orders Tab */}
    {activeAdminTab === "archive" && (
      <motion.div
        key="archive"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        {/* Search Bar */}
        <div className={`flex flex-col sm:flex-row gap-4 mb-6 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
          <div className="flex-1 relative">
            <Search className={`absolute ${isRtl ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? "חיפוש בארכיון..." : "Search archive..."}
              className={`w-full ${isRtl ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left"} py-3 rounded-xl border border-primary-200 bg-white
                       focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                       transition-all duration-200 shadow-sm`}
            />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className={`bg-primary-50 border-b border-primary-100 ${isRtl ? "text-right" : "text-left"}`}>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>Order ID</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("customer")}</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("status")}</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 hidden sm:table-cell ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "תאריכים" : "Dates"}</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "תוצאה" : "Result"}</th>
                  <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("actions")}</th>
                </tr>
              </thead>
              <tbody className={isRtl ? "text-right" : "text-left"}>
                {archivedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-primary-500">
                      <Archive className="w-12 h-12 mx-auto mb-3 text-primary-300" />
                      <p>{isRtl ? "אין הזמנות בארכיון" : "No archived orders found"}</p>
                      {searchQuery && <p className="text-sm mt-1">{isRtl ? "נסה לשנות את החיפוש" : "Try adjusting your search"}</p>}
                    </td>
                  </tr>
                ) : (
                  archivedOrders.map((order) => (
                    <tr key={order.id} className="border-b border-primary-50 hover:bg-primary-50/50 transition-colors">
                      <td className="px-4 py-4 font-bold text-navy-900">
                        <button
                          onClick={() => openCustomerModal(order.phone || "", order.customerName)}
                          className="hover:text-gold-600 hover:underline font-bold text-left focus:outline-none"
                          title={isRtl ? "צפה בהיסטוריית לקוח" : "View customer history"}
                        >
                          {order.id}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openCustomerModal(order.phone || "", order.customerName)}
                          className="font-semibold text-navy-800 hover:text-gold-600 hover:underline text-left focus:outline-none block animate-none"
                          title={isRtl ? "צפה בהיסטוריית לקוח" : "View customer history"}
                        >
                          {order.customerName}
                        </button>
                        <div className="text-sm text-primary-500 mt-1" dir="ltr">
                          {order.phone ? (
                            <a href={`tel:${order.phone}`} className="hover:text-gold-600 hover:underline">
                              {order.phone}
                            </a>
                          ) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {editingCell?.orderId === order.id && editingCell?.field === 'status' ? (
                          <select
                            autoFocus
                            value={order.status}
                            onChange={(e) => { updateStatus(order.id, e.target.value as OrderStatus); setEditingCell(null); }}
                            onBlur={() => setEditingCell(null)}
                            className={`px-3 py-1.5 rounded-lg border border-gold-300 bg-white text-sm
                                     focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                                     cursor-pointer ${isRtl ? "text-right" : ""}`}
                          >
                            {statusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingCell({orderId: order.id, field: 'status'})}
                            className={`inline-badge ${getStatusBadgeClasses(order.status)}`}
                          >
                            {statusOptions.find(o => o.value === order.status)?.label || order.status}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm hidden sm:table-cell">
                        <div className="space-y-1.5">
                          <div className="text-navy-700 flex items-center gap-1.5">
                            <span className="text-primary-400 text-xs uppercase tracking-wider font-medium">{isRtl ? "קבל:" : "In:"}</span>
                            <span>{order.dateReceived}</span>
                          </div>
                          {order.estimatedCompletion && (
                            <div className="text-primary-600 flex items-center gap-1.5">
                              <span className="text-primary-400 text-xs uppercase tracking-wider font-medium">{isRtl ? "צפי:" : "Est:"}</span>
                              <span>{order.estimatedCompletion}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {editingCell?.orderId === order.id && editingCell?.field === 'result' ? (
                          <select
                            autoFocus
                            value={order.result || ""}
                            onChange={(e) => { updateResult(order.id, e.target.value); setEditingCell(null); }}
                            onBlur={() => setEditingCell(null)}
                            className={`w-full px-3 py-1.5 rounded-lg border border-gold-300 bg-white text-sm
                                     focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                                     cursor-pointer ${isRtl ? "text-right" : ""}`}
                          >
                            {resultOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingCell({orderId: order.id, field: 'result'})}
                            className={`inline-badge ${getResultBadgeClasses(order.result || "")}`}
                          >
                            {order.result ? (resultOptions.find(o => o.value === order.result)?.label || order.result) : (isRtl ? "אין תוצאה" : "No result")}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className={`flex items-center gap-1 whitespace-nowrap ${isRtl ? "justify-start" : "justify-end"}`}>
                          <button
                            onClick={() => handleUnarchive(order)}
                            className="p-2 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 transition-colors"
                            title={isRtl ? "שחזר מארכיון" : "Restore from archive"}
                          >
                            <ArchiveRestore className="w-[18px] h-[18px]" />
                          </button>
                          <button
                            onClick={() => handleDeletePermanent(order.id)}
                            className="p-2 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-100 transition-colors"
                            title={isRtl ? "מחק לצמיתות" : "Delete permanently"}
                          >
                            <Trash2 className="w-[18px] h-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    )}

    {/* Voicemails Tab */}
        {activeAdminTab === "voicemails" && (
          <motion.div
            key="voicemails"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card bg-white p-6"
          >
            <div className={`flex items-center gap-2 mb-6 ${isRtl ? "flex-row-reverse" : ""}`}>
              <Volume2 className="w-6 h-6 text-navy-600" />
              <h2 className="text-xl font-bold text-navy-900">{isRtl ? "תיבת הודעות ותא קולי" : "Voicemail Inbox"}</h2>
            </div>
            {voicemails.length === 0 ? (
              <div className="text-center py-12 text-primary-400">
                <Volume2 className="w-12 h-12 mx-auto mb-4 text-primary-200" />
                <p className="text-lg font-medium">{isRtl ? "אין הודעות תא קולי עדיין" : "No voicemails yet"}</p>
                <p className="text-sm mt-1">{isRtl ? "הודעות מלקוחות יופיעו כאן" : "Customer messages will appear here"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {voicemails.map((vm) => (
                  <div key={vm.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-primary-50 rounded-xl border ${vm.read ? "border-primary-100" : "border-gold-300 bg-gold-50/30"} transition-colors ${isRtl ? "sm:flex-row-reverse" : ""}`}>
                    <div className={`flex flex-col gap-1 ${isRtl ? "text-right" : ""}`}>
                      <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                        <Phone className="w-4 h-4 text-navy-500" />
                        <span className="font-bold text-navy-900">{vm.phone}</span>
                        {!vm.read && (
                          <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                            {isRtl ? "חדש" : "New"}
                          </span>
                        )}
                      </div>
                      <div className={`flex items-center gap-3 text-xs text-primary-600 ${isRtl ? "flex-row-reverse" : ""}`}>
                        <span>{formatDateTime(vm.timestamp)}</span>
                        <span>•</span>
                        <span>{isRtl ? "אורך:" : "Duration:"} {formatDuration(vm.duration, isRtl)}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-3 mt-4 sm:mt-0 w-full sm:w-auto ${isRtl ? "flex-row-reverse" : ""}`}>
                      <audio controls className="h-10 w-full sm:w-[250px]" onPlay={() => { if (!vm.read) markVoicemailRead(vm.id); }}>
                        <source src={`/api/audio?url=${encodeURIComponent(vm.url)}`} type="audio/mpeg" />
                        <source src={`/api/audio?url=${encodeURIComponent(vm.url)}`} type="audio/wav" />
                        Your browser does not support the audio element.
                      </audio>
                      <button
                        onClick={() => { if(confirm(isRtl ? "למחוק הודעה זו?" : "Delete this voicemail?")) dbDeleteVoicemail(vm.id); }}
                        className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                        title={isRtl ? "מחק הודעה" : "Delete voicemail"}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Call Logs Tab */}
        {activeAdminTab === "calls" && (
          <motion.div
            key="calls"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Tab Header & Toggle */}
            <div className={`card p-6 bg-white border border-primary-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isRtl ? "text-right" : ""}`}>
              <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                <PhoneCall className="w-8 h-8 text-gold-500 shrink-0" />
                <div>
                  <h2 className="text-2xl font-bold text-navy-900">{isRtl ? "יומני שיחות והודעות SMS" : "Call Logs & SMS Center"}</h2>
                  <p className="text-xs text-primary-500 mt-0.5">
                    {isRtl ? "מעקב אחר היסטוריית השיחות ותקשורת בהודעות מול הלקוחות" : "Track automated phone interactions and chat with customers in real-time."}
                  </p>
                </div>
              </div>
              
              {/* Sub Tab Buttons */}
              <div className="flex bg-primary-100/50 p-1.5 rounded-xl border border-primary-200">
                <button
                  onClick={() => setCallLogSubTab("timeline")}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    callLogSubTab === "timeline" 
                      ? "bg-white text-navy-950 shadow" 
                      : "text-primary-600 hover:text-navy-950"
                  }`}
                >
                  {isRtl ? "ציר זמן שיחות" : "Call Timeline"}
                </button>
                <button
                  onClick={() => setCallLogSubTab("sms")}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    callLogSubTab === "sms" 
                      ? "bg-white text-navy-950 shadow" 
                      : "text-primary-600 hover:text-navy-950"
                  }`}
                >
                  {isRtl ? "צ'אט SMS" : "SMS Chat"}
                </button>
              </div>
            </div>

            {/* Timeline Sub-tab */}
            {callLogSubTab === "timeline" && (
              <div className="space-y-4">
                {/* Search */}
                <div className={`flex flex-col sm:flex-row gap-4 items-stretch ${isRtl ? "sm:flex-row-reverse" : ""}`}>
                  <div className="flex-1 relative">
                    <Search className={`absolute ${isRtl ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400`} />
                    <input
                      type="text"
                      value={callSearchQuery}
                      onChange={(e) => setCallSearchQuery(e.target.value)}
                      placeholder={isRtl ? "חפש לפי מספר טלפון..." : "Search by phone number..."}
                      className={`w-full ${isRtl ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left"} py-3 rounded-xl border border-primary-200 bg-white
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                               transition-all duration-200 shadow-sm`}
                    />
                  </div>
                  <button
                    onClick={handleSyncCallPrices}
                    disabled={isSyncingPrices}
                    className={`px-5 py-3 rounded-xl bg-gold-600 hover:bg-gold-700 active:bg-gold-800 text-white font-bold shadow-sm transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingPrices ? "animate-spin" : ""}`} />
                    <span>{isRtl ? "סנכרן עלויות" : "Sync Costs"}</span>
                  </button>
                </div>

                {/* Calls Table */}
                <div className="card overflow-hidden bg-white border border-primary-200 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px]">
                      <thead>
                        <tr className={`bg-primary-50 border-b border-primary-100 ${isRtl ? "text-right" : "text-left"}`}>
                          <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>Direction</th>
                          <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>Phone</th>
                          <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("customer")}</th>
                          <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "תאריך ושעה" : "Time"}</th>
                          <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "משך" : "Duration"}</th>
                          <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "עלות" : "Cost"}</th>
                          <th className={`px-4 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "סטטוס" : "Status"}</th>
                          <th className={`px-4 py-4 text-sm font-semibold text-navy-800 text-center`}>{t("actions")}</th>
                        </tr>
                      </thead>
                      <tbody className={isRtl ? "text-right" : "text-left"}>
                        {calls
                          .filter(call => call.phone && call.phone.includes(callSearchQuery))
                          .sort((a, b) => b.timestamp - a.timestamp)
                          .length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-primary-500">
                              <Phone className="w-12 h-12 mx-auto mb-3 text-primary-300" />
                              <p>{isRtl ? "לא נמצאו שיחות" : "No calls found"}</p>
                            </td>
                          </tr>
                        ) : (
                          calls
                            .filter(call => call.phone && call.phone.includes(callSearchQuery))
                            .sort((a, b) => b.timestamp - a.timestamp)
                            .map((call) => {
                              const isOutbound = call.direction === "outbound" || (call.actions && call.actions.some(act => act.toLowerCase().includes("outbound")));
                              const cleanPhone = call.phone ? call.phone.replace(/\D/g, "") : "";
                              const matchedOrder = orders.find(o => o.phone && o.phone.replace(/\D/g, "") === cleanPhone);
                              const customerName = matchedOrder ? matchedOrder.customerName : "";

                              return (
                                <Fragment key={call.id}>
                                  <tr className="border-b border-primary-50 hover:bg-primary-50/50 transition-colors">
                                    <td className="px-4 py-4">
                                      <div className="flex flex-col items-start gap-1">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                          isOutbound 
                                            ? "bg-amber-50 text-amber-700 border border-amber-200" 
                                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        }`}>
                                          {isOutbound ? (
                                            <>
                                              <PhoneOutgoing className="w-3.5 h-3.5" />
                                              <span>{isRtl ? "יוצאת" : "Outbound"}</span>
                                            </>
                                          ) : (
                                            <>
                                              <PhoneIncoming className="w-3.5 h-3.5" />
                                              <span>{isRtl ? "נכנסת" : "Inbound"}</span>
                                            </>
                                          )}
                                        </span>
                                        {getCallSelectionBadge(call, isRtl)}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 font-semibold text-navy-900" dir="ltr">{call.phone}</td>
                                    <td className="px-4 py-4">
                                      {customerName ? (
                                        <div className="flex flex-col">
                                          <button
                                            onClick={() => openCustomerModal(call.phone, customerName)}
                                            className="font-semibold text-navy-800 hover:text-gold-600 hover:underline text-left focus:outline-none"
                                          >
                                            {customerName}
                                          </button>
                                          {matchedOrder?.location && (
                                            <span className="text-[10px] text-primary-500 mt-0.5 flex items-center gap-0.5">
                                              <MapPin className="w-3 h-3 text-gold-500 shrink-0" />
                                              {matchedOrder.location}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-primary-400 italic">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-4 text-xs text-navy-700">
                                      <div>{formatDateTime(call.timestamp)}</div>
                                      <div className="text-[10px] text-primary-400 mt-0.5">{getRelativeTime(call.timestamp, isRtl)}</div>
                                    </td>
                                    <td className="px-4 py-4 text-xs font-mono text-navy-700">{formatDuration(call.duration, isRtl)}</td>
                                    <td className="px-4 py-4 text-xs font-mono text-navy-700" dir="ltr">{formatPrice(call.price, call.priceUnit)}</td>
                                    <td className="px-4 py-4">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                        call.status === "active" 
                                          ? "bg-rose-100 text-rose-800 animate-pulse border border-rose-200" 
                                          : call.status === "voicemail"
                                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                                          : "bg-primary-100 text-primary-700 border border-primary-200"
                                      }`}>
                                        {call.status === "active" ? (isRtl ? "פעילה" : "Active") : call.status === "voicemail" ? (isRtl ? "תא קולי" : "Voicemail") : (isRtl ? "הושלמה" : "Completed")}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex items-center justify-center gap-3">
                                        <button
                                          onClick={() => setSelectedCallId(selectedCallId === call.id ? null : call.id)}
                                          className="text-xs text-gold-600 hover:text-gold-700 font-bold transition-colors focus:outline-none"
                                        >
                                          {selectedCallId === call.id ? (isRtl ? "הסתר פירוט" : "Hide Details") : (isRtl ? "הצג פירוט" : "Show Details")}
                                        </button>
                                        {call.status === "active" && (
                                          <button
                                            onClick={() => handleMarkCallCompleted(call.id, call.phone)}
                                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 rounded-lg shadow-sm transition-colors"
                                          >
                                            {isRtl ? "סיים שיחה" : "Complete"}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  {selectedCallId === call.id && (
                                    <tr className="bg-slate-50/60 border-y border-slate-100/80 shadow-inner">
                                      <td colSpan={8} className="px-8 py-5">
                                        <div className={`space-y-5 relative ${isRtl ? "pr-8" : "pl-8"} before:absolute before:content-[''] ${isRtl ? "before:right-11 before:translate-x-1/2" : "before:left-11 before:-translate-x-1/2"} before:top-3 before:bottom-3 before:w-[2px] before:bg-gray-200 before:z-0`}>
                                          {call.actions && call.actions.map((action, idx) => {
                                            const parsed = parseCallAction(action);
                                            const rawText = translateSystemLabel(parsed, isRtl);
                                            const { main, secondary } = splitActionText(rawText);
                                            const timeIndicator = getStepTimeIndicator(action, idx, call.actions.length, call, isRtl);
                                            return (
                                              <div key={idx} className={`flex items-start justify-between gap-4 relative py-1 ${isRtl ? "text-right" : "text-left"}`}>
                                                <div className="flex items-start gap-4 flex-1">
                                                  <div className="relative bg-white w-6 h-6 rounded-full border border-slate-200 shadow-sm flex items-center justify-center shrink-0 z-10">
                                                    {getTimelineIcon(parsed)}
                                                  </div>
                                                  <div className="flex-1">
                                                    <p className="font-bold text-navy-950 text-xs md:text-sm">
                                                      {main}
                                                    </p>
                                                    {secondary && (
                                                      <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-relaxed">
                                                        {secondary}
                                                      </p>
                                                    )}
                                                    {parsed.type === "voice" && parsed.transcript && (
                                                      <p className="text-primary-600 bg-white px-2.5 py-1 rounded border border-primary-150 mt-1.5 italic text-[11px] shadow-sm inline-block">
                                                        &quot;{parsed.transcript}&quot;
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                                {timeIndicator && (
                                                  <span className="text-[10px] md:text-xs text-slate-400 font-medium whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-full self-start mt-1">
                                                    {timeIndicator}
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                          {(!call.actions || call.actions.length === 0) && (
                                            <span className="text-xs text-primary-400 italic">
                                              {isRtl ? "אין פירוט פעולות עבור שיחה זו" : "No action history logged for this call."}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SMS Chat Sub-tab */}
            {callLogSubTab === "sms" && (
              <div className={`grid grid-cols-1 md:grid-cols-3 border border-primary-200 rounded-3xl overflow-hidden bg-white shadow-sm min-h-[550px] max-h-[700px] ${isRtl ? "direction-rtl" : ""}`}>
                
                {/* Left Thread List Pane (1/3) */}
                <div className="md:col-span-1 border-r border-primary-150 flex flex-col bg-primary-50/25 h-full overflow-y-auto">
                  <div className="p-4 border-b border-primary-150 bg-white">
                    <h3 className="font-bold text-navy-950 text-sm flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-gold-500" />
                      {isRtl ? "שיחות אחרונות" : "Conversations"}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-primary-100">
                    {smsThreads.map((thread) => {
                      const isActive = selectedSmsPhone === thread.phone;
                      return (
                        <button
                          key={thread.phone}
                          onClick={() => {
                            setSelectedSmsPhone(thread.phone);
                            setSmsInput("");
                          }}
                          className={`w-full p-4 flex items-start gap-3 transition-colors text-left ${isRtl ? "text-right" : ""} ${
                            isActive 
                              ? "bg-white border-l-4 border-l-gold-500 shadow-sm" 
                              : "hover:bg-primary-50/50"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-navy-800 shrink-0">
                            {thread.customerName ? thread.customerName.charAt(0) : <User className="w-5 h-5 text-primary-500" />}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex justify-between items-baseline gap-2">
                              <h4 className="font-bold text-navy-900 text-xs truncate">
                                {thread.customerName || thread.phone}
                              </h4>
                              <span className="text-[9px] text-primary-400 shrink-0 font-medium">
                                {getRelativeTime(thread.lastMessage.timestamp, isRtl)}
                              </span>
                            </div>
                            {thread.customerName && (
                              <div className="text-[10px] text-primary-400 font-medium font-mono" dir="ltr">{thread.phone}</div>
                            )}
                            {(() => {
                              const matchedOrder = orders.find(o => o.phone && o.phone.replace(/\D/g, "") === thread.phone.replace(/\D/g, ""));
                              return matchedOrder?.location ? (
                                <div className="text-[9px] text-gold-650 font-bold mt-0.5 flex items-center gap-0.5 text-left" dir="ltr">
                                  <MapPin className="w-2.5 h-2.5 text-gold-500 shrink-0" />
                                  {matchedOrder.location}
                                </div>
                              ) : null;
                            })()}
                            <p className="text-[11px] text-primary-600 truncate mt-1 text-left">
                              {thread.lastMessage.body}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {smsThreads.length === 0 && (
                      <div className="text-center py-12 text-primary-400">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 text-primary-200" />
                        <p className="text-xs font-semibold">{isRtl ? "אין הודעות SMS במערכת" : "No SMS messages found"}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Chat Message Pane (2/3) */}
                <div className="md:col-span-2 flex flex-col h-full bg-white relative">
                  {selectedSmsPhone ? (() => {
                    const thread = smsThreads.find(t => t.phone === selectedSmsPhone);
                    const matchedOrder = orders.find(o => o.phone && o.phone.replace(/\D/g, "") === selectedSmsPhone.replace(/\D/g, ""));
                    const customerName = thread?.customerName || matchedOrder?.customerName;

                    return (
                      <div className="flex flex-col h-full absolute inset-0">
                        {/* Chat Pane Header */}
                        <div className={`p-4 border-b border-primary-150 flex items-center justify-between bg-primary-50/30 ${isRtl ? "flex-row-reverse" : ""}`}>
                          <div className={`flex items-center gap-3.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                            <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center font-bold text-gold-700 shrink-0">
                              {customerName ? customerName.charAt(0) : <User className="w-5 h-5 text-gold-600" />}
                            </div>
                            <div className={isRtl ? "text-right" : "text-left"}>
                              <h3 className="font-bold text-navy-900 text-xs">
                                {customerName || (isRtl ? "לקוח לא מוכר" : "Unknown Customer")}
                              </h3>
                              <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                                <p className="text-[10px] text-primary-500 font-medium font-mono" dir="ltr">{selectedSmsPhone}</p>
                                {matchedOrder?.location && (
                                  <p className="text-[10px] text-gold-600 font-semibold flex items-center gap-0.5" dir="ltr">
                                    <MapPin className="w-3 h-3 text-gold-500 shrink-0" />
                                    {matchedOrder.location}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Action buttons */}
                          <div className={`flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                            <button
                              onClick={() => {
                                setManualCallPhone(selectedSmsPhone);
                                const activeOrder = orders.find(o => !o.archived && o.phone && o.phone.replace(/\D/g, "") === selectedSmsPhone.replace(/\D/g, ""));
                                if (activeOrder) setManualCallOrderId(activeOrder.id);
                                setShowCallModal(true);
                              }}
                              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all border border-emerald-150 flex items-center justify-center"
                              title={isRtl ? "התקשר ללקוח" : "Call Customer"}
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            {customerName && (
                              <button
                                onClick={() => openCustomerModal(selectedSmsPhone, customerName)}
                                className="p-2 bg-gold-50 hover:bg-gold-100 text-gold-700 rounded-xl transition-all border border-gold-150 flex items-center justify-center"
                                title={isRtl ? "פרופיל והיסטוריה" : "Profile & History"}
                              >
                                <User className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Message Bubble Container */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 flex flex-col justify-end">
                          <div className="space-y-3.5 overflow-y-auto flex-1 flex flex-col">
                            {thread?.messages.map((msg) => {
                              const isInbound = msg.direction === "inbound";
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex w-full ${isInbound ? "justify-start" : "justify-end"}`}
                                >
                                  <div
                                    className={`max-w-[70%] rounded-2xl p-3 shadow-sm text-xs font-medium ${
                                      isInbound
                                        ? "bg-white text-navy-900 rounded-tl-none border border-primary-100"
                                        : "bg-navy-900 text-white rounded-tr-none"
                                    }`}
                                  >
                                    <p className="leading-relaxed whitespace-pre-wrap text-left">{msg.body}</p>
                                    <span className={`block text-[9px] mt-1.5 text-right ${
                                      isInbound ? "text-primary-400" : "text-navy-300"
                                    }`}>
                                      {formatDateTime(msg.timestamp)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Chat Input Area */}
                        <form onSubmit={handleSendSms} className={`p-4 border-t border-primary-150 bg-white flex gap-2.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                          <input
                            type="text"
                            value={smsInput}
                            onChange={(e) => setSmsInput(e.target.value)}
                            placeholder={isRtl ? "הקלד הודעת SMS להשבה..." : "Type SMS reply..."}
                            className={`flex-1 px-4 py-2.5 rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-xs bg-primary-50/20 ${
                              isRtl ? "text-right" : ""
                            }`}
                          />
                          <button
                            type="submit"
                            disabled={sendingSms || !smsInput.trim()}
                            className="btn-primary py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow"
                          >
                            <Send className="w-4 h-4" />
                            <span>{isRtl ? "שלח" : "Send"}</span>
                          </button>
                        </form>
                      </div>
                    );
                  })() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-primary-400 p-8 text-center">
                      <MessageSquare className="w-14 h-14 mb-3 text-primary-200 animate-pulse" />
                      <p className="font-semibold text-sm">{isRtl ? "בחר שיחה מהרשימה" : "Select a conversation thread"}</p>
                      <p className="text-xs mt-1">{isRtl ? "כדי להתחיל בהתכתבות SMS עם הלקוח" : "to start messaging with the customer."}</p>
                    </div>
                  )}
                </div>

              </div>
            )}

          </motion.div>
        )}

        {/* Twilio Billing & Costs Tab */}
        {activeAdminTab === "billing" && (
          <motion.div
            key="billing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 font-sans"
          >
            {/* Action Bar */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
              <span className="text-xs text-primary-500 font-medium">
                {isRtl ? "* הנתונים נמשכים ישירות מחשבון ה-Twilio שלך" : "* Data is fetched in real-time from your Twilio account"}
              </span>
              
              <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                {/* Period Selector Toggle */}
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-primary-150">
                  <button
                    type="button"
                    onClick={() => setBillingPeriod("daily")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 ${
                      billingPeriod === "daily"
                        ? "bg-white text-navy-950 shadow-sm"
                        : "text-primary-500 hover:text-navy-950"
                    }`}
                  >
                    {isRtl ? "יומי" : "Daily"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingPeriod("monthly")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 ${
                      billingPeriod === "monthly"
                        ? "bg-white text-navy-950 shadow-sm"
                        : "text-primary-500 hover:text-navy-950"
                    }`}
                  >
                    {isRtl ? "חודשי" : "Monthly"}
                  </button>
                </div>

                <button
                  onClick={fetchBilling}
                  disabled={billingLoading}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-primary-200 bg-white text-navy-950 hover:bg-primary-50 transition-all duration-200 disabled:opacity-50 ${isRtl ? "flex-row-reverse" : ""}`}
                >
                  <RefreshCw className={`w-4 h-4 ${billingLoading ? "animate-spin" : ""}`} />
                  <span>{isRtl ? "רענן נתונים" : "Refresh"}</span>
                </button>
              </div>
            </div>

            {billingLoading && !billingData ? (
              // Loading State
              <div className="card p-12 text-center bg-white border border-primary-200/60 shadow-sm">
                <RefreshCw className="w-10 h-10 text-gold-500 animate-spin mx-auto mb-4" />
                <p className="font-semibold text-navy-900">{isRtl ? "טוען נתוני חיוב מ-Twilio..." : "Loading Twilio usage data..."}</p>
              </div>
            ﻿            ) : billingError ? (
              // Error State
              <div className={`card p-8 text-center bg-white border border-red-150 shadow-sm ${isRtl ? "text-right" : ""}`}>
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">{isRtl ? "שגיאה בטעינת הנתונים" : "Failed to Load Data"}</h3>
                <p className="text-sm text-red-600 max-w-md mx-auto mb-6">{billingError}</p>
                <div className="text-center">
                  <button
                    onClick={fetchBilling}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-navy-950 text-white font-semibold rounded-xl hover:bg-navy-800 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{isRtl ? "נסה שוב" : "Retry"}</span>
                  </button>
                </div>
              </div>
            ) : billingData && billingData.success ? (
              // Data State
              (() => {
                const currentPeriodData = billingPeriod === "monthly" ? billingData.thisMonth : billingData.today;
                const previousPeriodData = billingPeriod === "monthly" ? billingData.lastMonth : billingData.yesterday;
                
                return (
                  <div className="space-y-6">
                    {/* Stats Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Card 1: Available Balance */}
                      <div className={`card p-6 bg-gradient-to-br from-gold-500 to-gold-600 text-white relative overflow-hidden shadow-md border-0 ${isRtl ? "text-right" : ""}`}>
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                          <DollarSign className="w-32 h-32 text-white" />
                        </div>
                        <div className="relative z-10">
                          <span className="text-[10px] bg-white/20 text-white font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                            {isRtl ? "יתרת קופה זמינה" : "Available Balance"}
                          </span>
                          <div className={`mt-4 text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-baseline gap-0.5 ${isRtl ? "flex-row-reverse justify-end" : "justify-start"}`}>
                            <span className="text-white/80 text-2xl font-bold">$</span>
                            {billingData.balance !== null ? billingData.balance.toFixed(2) : "—"}
                          </div>
                          <p className="text-[11px] text-white/90 mt-2 font-medium">
                            {isRtl 
                              ? `יתרת זכות טעונה בחשבון Twilio` 
                              : `Pre-paid account credit on Twilio`}
                          </p>
                        </div>
                      </div>

                      {/* Card 2: Current Period Total */}
                      <div className={`card p-6 bg-gradient-to-br from-navy-900 to-navy-950 text-white relative overflow-hidden shadow-md border-0 ${isRtl ? "text-right" : ""}`}>
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                          <CreditCard className="w-32 h-32 text-white" />
                        </div>
                        <div className="relative z-10">
                          <span className="text-[10px] bg-white/10 text-gold-400 font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                            {billingPeriod === "monthly" 
                              ? (isRtl ? "החודש הנוכחי" : "Current Month") 
                              : (isRtl ? "היום הנוכחי" : "Today")}
                          </span>
                          <div className={`mt-4 text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-baseline gap-1.5 ${isRtl ? "flex-row-reverse justify-end" : "justify-start"}`}>
                            <span className="text-gold-400 text-2xl font-bold">$</span>
                            {currentPeriodData.total.toFixed(2)}
                          </div>
                          <p className="text-xs text-navy-300 mt-2">
                            {billingPeriod === "monthly"
                              ? (isRtl ? `סה"כ עלויות החודש (${billingData.currency})` : `Total accrued this month (${billingData.currency})`)
                              : (isRtl ? `סה"כ עלויות היום (${billingData.currency})` : `Total accrued today (${billingData.currency})`)}
                          </p>
                        </div>
                      </div>

                      {/* Card 3: Previous Period Total */}
                      <div className={`card p-6 bg-white border border-primary-200 shadow-sm ${isRtl ? "text-right" : ""}`}>
                        <span className="text-[10px] bg-primary-100 text-primary-700 font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                          {billingPeriod === "monthly" 
                            ? (isRtl ? "חודש שעבר" : "Last Month") 
                            : (isRtl ? "אתמול" : "Yesterday")}
                        </span>
                        <div className={`mt-4 text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight flex items-baseline gap-1.5 ${isRtl ? "flex-row-reverse justify-end" : "justify-start"}`}>
                          <span className="text-primary-500 text-2xl font-bold">$</span>
                          {previousPeriodData.total.toFixed(2)}
                        </div>
                        <p className="text-xs text-primary-500 mt-2">
                          {billingPeriod === "monthly"
                            ? (isRtl ? `עלות סופית לחודש שעבר (${billingData.currency})` : `Final cost for previous month (${billingData.currency})`)
                            : (isRtl ? `עלות סופית לאתמול (${billingData.currency})` : `Final cost for yesterday (${billingData.currency})`)}
                        </p>
                      </div>

                      {/* Card 4: Comparison & Trend */}
                      <div className={`card p-6 bg-white border border-primary-200 shadow-sm ${isRtl ? "text-right" : ""}`}>
                        <span className="text-[10px] bg-primary-100 text-primary-700 font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                          {isRtl ? "מגמה והשוואה" : "Comparison & Trend"}
                        </span>
                        
                        {(() => {
                          const thisTotal = currentPeriodData.total;
                          const lastTotal = previousPeriodData.total;
                          const diff = thisTotal - lastTotal;
                          const percent = lastTotal > 0 ? (diff / lastTotal) * 100 : 0;
                          const isDecrease = diff <= 0;
                          
                          return (
                            <div className="mt-4">
                              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse justify-end" : "justify-start"}`}>
                                {isDecrease ? (
                                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                    <TrendingDown className="w-5 h-5" />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                    <TrendingUp className="w-5 h-5" />
                                  </div>
                                )}
                                <div className={isRtl ? "text-right" : ""}>
                                  <div className={`text-xl font-bold ${isDecrease ? "text-emerald-600" : "text-rose-600"}`}>
                                    {isDecrease ? "-" : "+"}${Math.abs(diff).toFixed(2)}
                                  </div>
                                  <div className="text-[11px] text-primary-500 font-medium">
                                    {isDecrease ? (isRtl ? "ירידה בעלויות" : "Decrease in cost") : (isRtl ? "עלייה בעלויות" : "Increase in cost")} ({Math.abs(percent).toFixed(1)}%)
                                  </div>
                                </div>
                              </div>
                              <p className="text-xs text-primary-500 mt-2">
                                {billingPeriod === "monthly"
                                  ? (isRtl ? "השוואה בין החודש הנוכחי לחודש שעבר" : "Current month compared to previous month")
                                  : (isRtl ? "השוואה בין היום הנוכחי לאתמול" : "Today compared to yesterday")}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Detailed Category Costs */}
                    <div className={`card p-6 bg-white border border-primary-200 shadow-sm ${isRtl ? "text-right" : ""}`}>
                      <div className="mb-6">
                        <h3 className="text-lg font-bold text-navy-950">
                          {billingPeriod === "monthly"
                            ? (isRtl ? "פירוט שימוש ועלויות חודשי" : "Itemized Usage & Monthly Costs")
                            : (isRtl ? "פירוט שימוש ועלויות יומי" : "Itemized Usage & Daily Costs")}
                        </h3>
                        <p className="text-xs text-primary-500 mt-0.5">
                          {billingPeriod === "monthly"
                            ? (isRtl ? "רשימת כל השירותים הפעילים והעלויות שלהם החודש" : "Detailed distribution of this month's active Twilio services")
                            : (isRtl ? "רשימת כל השירותים הפעילים והעלויות שלהם היום" : "Detailed distribution of today's active Twilio services")}
                        </p>
                      </div>

                      {currentPeriodData.categories.length === 0 ? (
                        <div className="text-center py-12 text-primary-400">
                          <Clock className="w-12 h-12 mx-auto mb-4 text-primary-200 animate-pulse" />
                          <p className="text-base font-semibold">{isRtl ? "אין עלויות פעילות בתקופה זו" : "No usage costs accrued in this period"}</p>
                          <p className="text-xs mt-1">{isRtl ? "כאשר יבוצעו שיחות או ישלחו הודעות, העלויות יופיעו כאן" : "When calls are made or SMS sent, cost logs will populate here"}</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {currentPeriodData.categories.map((cat: any) => {
                            const totalCost = currentPeriodData.total;
                            const percentage = totalCost > 0 ? (cat.price / totalCost) * 100 : 0;
                            
                            // Select icon
                            let IconComponent = DollarSign;
                            if (cat.category.includes("call")) IconComponent = PhoneCall;
                            else if (cat.category.includes("sms")) IconComponent = MessageSquare;
                            else if (cat.category.includes("polly") || cat.category.includes("speech")) IconComponent = Mic;
                            else if (cat.category.includes("phonenumber")) IconComponent = CreditCard;

                            const DETAILS_MAP: Record<string, { descEn: string; descHe: string; rateEn: string; rateHe: string }> = {
                              "calls": {
                                descEn: "Inbound voice minutes for customer calls and outbound automated notification calls.",
                                descHe: "שיחות טלפון נכנסות מלקוחות ושיחות יוצאות אוטומטיות מהמערכת.",
                                rateEn: "$0.0085/min inbound, $0.0140/min outbound",
                                rateHe: "0.0085$ לדקה נכנסת, 0.0140$ לדקה יוצאת"
                              },
                              "channels": {
                                descEn: "Text messages (SMS) sent to notify customers or received from them.",
                                descHe: "הודעות טקסט (SMS) שנשלחו ללקוחות או התקבלו מהם במערכת.",
                                rateEn: "$0.0079 per message segment + carrier fees",
                                rateHe: "0.0079$ למקטע הודעה + עמלות מפעיל רשת"
                              },
                              "phonenumbers": {
                                descEn: "Monthly lease charges for your active Twilio phone numbers and emergency services.",
                                descHe: "דמי שכירות חודשיים עבור מספרי הטלפון הווירטואליים הפעילים וחיבורו החירום.",
                                rateEn: "$1.15/month local, $0.75/month emergency",
                                rateHe: "1.15$ לחודש למספר, 0.75$ לחודש לחיבור חירום"
                              },
                              "speech-recognition": {
                                descEn: "Voice response (IVR) engine translating spoken order numbers and words to text.",
                                descHe: "מנוע זיהוי הדיבור המתרגם את קול הלקוח המקריא את מספר ההזמנה לטקסט.",
                                rateEn: "$0.0200 per 15-second speech interval",
                                rateHe: "0.0200$ לכל מקטע דיבור של 15 שניות"
                              },
                              "amazon-polly": {
                                descEn: "Text-to-speech engine voicing custom messages in English and Hebrew.",
                                descHe: "מנוע הקראת הטקסט המקריא בקול אנושי הודעות מותאמות אישית בעברית ובאנגלית.",
                                rateEn: "$0.0008 per 100 characters voiced",
                                rateHe: "0.0008$ לכל 100 תווים שהוקראו"
                              },
                              "tts-google": {
                                descEn: "Premium ultra-realistic Google WaveNet text-to-speech engine for high quality voice segments.",
                                descHe: "מנוע הקראת הטקסט האיכותי של גוגל (WaveNet) לקולות פרימיום בשיחה.",
                                rateEn: "$0.0032 per 100 characters voiced",
                                rateHe: "0.0032$ לכל 100 תווים שהוקראו"
                              },
                              "recordingstorage": {
                                descEn: "Cloud storage for customer voicemail recordings and saved call logs.",
                                descHe: "אחסון בענן עבור קבצי השמע של הודעות תא קולי והקלטות שיחה.",
                                rateEn: "$0.0005 per minute per month",
                                rateHe: "0.0005$ לדקת הקלטה בחודש"
                              },
                              "studio": {
                                descEn: "Visual workflow builder for the call routing and automated customer flows.",
                                descHe: "מנוע ניתוב השיחות והתזרים האוטומטי של הלקוח בתוך המערכת.",
                                rateEn: "Free up to 1,000 runs/month, then $0.01 per run",
                                rateHe: "חינם עד 1,000 הפעלות בחודש, ולאחר מכן 0.01$ להפעלה"
                              },
                              "carrier-route-lookups": {
                                descEn: "Network queries to determine phone carrier and optimize SMS delivery.",
                                descHe: "בירור ספק הרשת בזמן אמת של המספרים כדי למנוע כשלים בשליחת SMS.",
                                rateEn: "$0.0050 per query lookup",
                                rateHe: "0.0050$ לכל שאילתת בירור מפעיל"
                              }
                            };
                            const catDetails = DETAILS_MAP[cat.category];

                            return (
                              <div key={cat.category} className="p-4 bg-primary-50/40 rounded-2xl border border-primary-150 transition-all duration-200 hover:bg-primary-50/80">
                                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
                                  {/* Left: Icon and Names */}
                                  <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                                    <div className="w-10 h-10 bg-white border border-primary-200 rounded-xl flex items-center justify-center shrink-0 shadow-sm text-navy-900">
                                      <IconComponent className="w-5 h-5 text-navy-800" />
                                    </div>
                                    <div className={isRtl ? "text-right" : ""}>
                                      <h4 className="font-bold text-sm text-navy-900">{isRtl ? cat.nameHe : cat.nameEn}</h4>
                                      <p className="text-[10px] text-primary-500 font-medium">
                                        {isRtl ? "כמות שימוש: " : "Usage: "}
                                        <span className="font-semibold text-primary-700">{cat.usage.toLocaleString()} {cat.unit}</span>
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Right: Cost and Percentage */}
                                  <div className={`flex items-baseline sm:items-end flex-row sm:flex-col justify-between sm:justify-start gap-1.5 ${isRtl ? "flex-row-reverse sm:text-left" : "sm:text-right"}`}>
                                    <div className={`text-base font-extrabold text-navy-950 flex items-baseline gap-0.5 ${isRtl ? "flex-row-reverse" : ""}`}>
                                      <span className="text-primary-500 text-xs font-bold">$</span>
                                      <span>{cat.price.toFixed(4)}</span>
                                    </div>
                                    <div className="text-[9px] bg-gold-400/10 text-gold-700 font-semibold px-2 py-0.5 rounded-full shrink-0">
                                      {percentage.toFixed(1)}% {isRtl ? "מהסך הכל" : "of total"}
                                    </div>
                                  </div>
                                </div>

                                {/* Detailed Description and Rate */}
                                {catDetails && (
                                  <div className="mt-3 pt-3 border-t border-primary-150/45 space-y-2">
                                    <p className="text-[11px] text-primary-600 leading-relaxed">
                                      {isRtl ? catDetails.descHe : catDetails.descEn}
                                    </p>
                                    <div className={`flex ${isRtl ? "flex-row-reverse justify-end" : "justify-start"} items-center`}>
                                      <span className={`inline-flex items-center gap-1 text-[10px] bg-primary-100/70 text-primary-700 font-semibold px-2.5 py-0.5 rounded ${isRtl ? "flex-row-reverse" : ""}`}>
                                        <span>{isRtl ? "תעריף ליחידה:" : "Unit Rate:"}</span>
                                        <span className="font-mono">{isRtl ? catDetails.rateHe : catDetails.rateEn}</span>
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Progress bar */}
                                <div className="mt-3 h-1.5 w-full bg-primary-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gold-400 rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              // Empty/Not Configured State
              <div className="card p-12 text-center bg-white border border-primary-200/60 shadow-sm">
                <Settings className="w-12 h-12 text-primary-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-navy-900 mb-2">{isRtl ? "מערכת Twilio לא מוגדרת" : "Twilio System Not Configured"}</h3>
                <p className="text-sm text-primary-600 max-w-md mx-auto mb-6">
                  {isRtl 
                    ? "כדי לראות עלויות ונתוני חיוב, עליך להגדיר תחילה את מזהה החשבון (Account SID) ואת תוקן האבטחה (Auth Token) של Twilio בלשונית ההגדרות." 
                    : "To view billing and usage statistics, please make sure your Twilio Account SID and Auth Token are configured under the Settings tab."}
                </p>
                <button
                  onClick={() => setActiveAdminTab("settings")}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gold-500 text-white font-bold rounded-xl hover:bg-gold-600 shadow transition-all"
                >
                  <Settings className="w-4 h-4" />
                  <span>{isRtl ? "מעבר להגדרות" : "Go to Settings"}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
        {/* IVR Audio Manager Tab */}
        {activeAdminTab === "audio" && (
          <motion.div
            key="audio"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className={`card p-6 bg-white border border-primary-200 shadow-sm ${isRtl ? "text-right" : ""}`}>
              <div className={`flex items-center gap-3 mb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                <FileAudio className="w-8 h-8 text-gold-500 shrink-0" />
                <h2 className="text-2xl font-bold text-navy-900">{isRtl ? "מנהל שמע והקלטות IVR" : "IVR Audio Manager & Production"}</h2>
              </div>
              <p className="text-sm text-primary-600 leading-relaxed max-w-3xl">
                {isRtl 
                  ? "כאן תוכל להעלות, להאזין, ולנהל את קבצי השמע של מערכת ה-IVR הטלפונית. מומלץ להשתמש בקבצים מוקלטים באיכות גבוהה או קולות מיוצרים על ידי ElevenLabs לקבלת חווית שירות מקצועית."
                  : "Upload, listen to, and manage the pre-recorded voice files used by your automated IVR system. We recommend high-quality MP3s or ElevenLabs voice synthesis for a professional studio feel."}
              </p>
            </div>

            {/* Main Layout Grid */}
            <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isRtl ? "direction-rtl" : ""}`}>
              
              {/* Left column: Upload form & Quick presets */}
              <div className="space-y-6 lg:col-span-1">
                
                {/* Upload Card */}
                <div className={`card p-6 bg-white border border-primary-200 shadow-sm ${isRtl ? "text-right" : ""}`}>
                  <h3 className="text-lg font-bold text-navy-900 mb-4 border-b border-primary-100 pb-2">
                    {isRtl ? "העלאת קובץ שמע חדש" : "Upload New Audio"}
                  </h3>
                  
                  <form onSubmit={handleUploadAudio} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-primary-500 mb-1 uppercase">
                        {isRtl ? "שם הקובץ (באנגלית, ללא רווחים)" : "Audio File Name (English, no spaces)"}
                      </label>
                      <input
                        type="text"
                        required
                        value={audioName}
                        onChange={(e) => setAudioName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                        placeholder="e.g. welcome, info, vip"
                        className={`w-full px-3 py-2 rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm bg-primary-50/50 ${isRtl ? "text-right" : ""}`}
                      />
                      <p className="text-[10px] text-primary-400 mt-1">
                        {isRtl ? "אותיות באנגלית, מספרים וקו תחתון בלבד." : "Only alphanumeric characters and underscores/dashes."}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-primary-500 mb-1 uppercase">
                        {isRtl ? "קובץ MP3 שמע" : "MP3 Audio File"}
                      </label>
                      <div className="border-2 border-dashed border-primary-200 rounded-xl p-4 bg-primary-50/30 text-center hover:bg-primary-50/50 transition-colors cursor-pointer relative">
                        <input
                          id="audio-file-input-modal"
                          type="file"
                          required
                          accept="audio/mpeg, audio/mp3"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setAudioFile(e.target.files[0]);
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Music className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                        <span className="text-xs text-primary-600 block truncate font-medium">
                          {audioFile ? audioFile.name : (isRtl ? "לחץ או גרור קובץ MP3 כאן" : "Click or drag MP3 file here")}
                        </span>
                        <span className="text-[10px] text-primary-400 block mt-1">
                          {isRtl ? "גודל מקסימלי: 1MB" : "Maximum size: 1MB"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isUploading}
                      className="btn-primary w-full py-2.5 inline-flex items-center justify-center gap-2 text-sm font-bold shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      {isUploading ? (isRtl ? "מעלה קובץ..." : "Uploading file...") : (isRtl ? "העלה קובץ למערכת" : "Upload to System")}
                    </button>
                  </form>
                </div>

                {/* Quick Presets / Templates */}
                <div className={`card p-6 bg-white border border-primary-200 shadow-sm ${isRtl ? "text-right" : ""}`}>
                  <h3 className="text-xs font-bold text-navy-900 mb-3 uppercase tracking-wider">
                    {isRtl ? "שמות קבצים נפוצים ל-IVR" : "Common IVR File Names"}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {["welcome", "general_info", "vip_info", "order_not_found", "voicemail_greeting"].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAudioName(preset)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-primary-50 text-navy-700 hover:bg-gold-50 border border-primary-100 hover:border-gold-300 transition-all font-semibold font-mono"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right column: Uploaded audio files list */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Audio library */}
                <div className="card p-6 bg-white border border-primary-200 shadow-sm">
                  <h3 className={`text-lg font-bold text-navy-900 mb-4 border-b border-primary-100 pb-2 ${isRtl ? "text-right" : ""}`}>
                    {isRtl ? "ספריית הקבצים המוקלטים" : "Audio Recordings Library"}
                  </h3>
                  
                  {audioFiles.length === 0 ? (
                    <div className="text-center py-12 text-primary-400">
                      <Music className="w-16 h-16 mx-auto mb-4 text-primary-200 animate-pulse" />
                      <p className="text-base font-semibold">{isRtl ? "אין קבצי שמע מותאמים אישית" : "No custom audio files uploaded"}</p>
                      <p className="text-xs mt-1">{isRtl ? "העלה קובץ MP3 כדי להתחיל" : "Upload an MP3 file to populate the list"}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {audioFiles.map((file) => {
                        const origin = typeof window !== "undefined" ? window.location.origin : "";
                        const fileUrl = `${origin}/api/audio?name=${file.name.toLowerCase().trim()}`;
                        return (
                          <div 
                            key={file.name} 
                            className={`p-4 bg-primary-50/50 hover:bg-primary-50 rounded-xl border border-primary-150 transition-all duration-200 flex flex-col justify-between ${isRtl ? "text-right" : ""}`}
                          >
                            <div className={`flex items-start justify-between gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                              <div className="truncate">
                                <div className={`flex items-center gap-1.5 font-bold text-navy-900 ${isRtl ? "flex-row-reverse" : ""}`}>
                                  {isReplacingName === file.name ? (
                                    <RefreshCw className="w-4 h-4 text-gold-500 animate-spin shrink-0" />
                                  ) : (
                                    <FileAudio className="w-4 h-4 text-navy-600 shrink-0" />
                                  )}
                                  <span className="truncate" title={file.name}>{file.name}.mp3</span>
                                </div>
                                <span className="text-[10px] text-primary-500 block mt-0.5">
                                  {isRtl ? "פורמט: MP3" : "Format: MP3 Audio"}
                                </span>
                              </div>
                              <div className={`flex items-center gap-1 ${isRtl ? "flex-row-reverse" : ""}`}>
                                <label
                                  className={`p-1.5 rounded-lg text-gold-500 hover:text-gold-600 hover:bg-gold-50 transition-all shrink-0 cursor-pointer block ${
                                    isReplacingName === file.name ? "opacity-50 cursor-not-allowed" : ""
                                  }`}
                                  title={isRtl ? "החלף קובץ" : "Replace file"}
                                >
                                  <Upload className="w-4 h-4" />
                                  <input
                                    type="file"
                                    accept="audio/mpeg, audio/mp3"
                                    className="hidden"
                                    disabled={isReplacingName === file.name}
                                    onChange={(e) => handleReplaceAudio(file.name, e)}
                                  />
                                </label>
                                <button
                                  onClick={() => handleDeleteAudio(file.name)}
                                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
                                  title={isRtl ? "מחק קובץ" : "Delete file"}
                                  disabled={isReplacingName === file.name}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Audio Player and Links */}
                            <div className="space-y-3">
                              {/* Custom Mini Player UI */}
                              <div className={`flex items-center gap-3 bg-white p-2 rounded-lg border border-primary-100 ${isRtl ? "flex-row-reverse" : ""}`}>
                                <button
                                  onClick={() => handleTogglePlay(file.name)}
                                  className={`p-2 rounded-full transition-all shrink-0 ${
                                    playingName === file.name
                                      ? "bg-gold-500 text-white shadow-md animate-pulse"
                                      : "bg-navy-900 text-white hover:bg-navy-800 shadow"
                                  }`}
                                >
                                  {playingName === file.name ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="h-1.5 w-full bg-primary-100 rounded-full overflow-hidden relative">
                                    {playingName === file.name && (
                                      <motion.div 
                                        className="h-full bg-gold-400"
                                        initial={{ width: "0%" }}
                                        animate={{ width: "100%" }}
                                        transition={{ duration: 15, ease: "linear" }}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Copy Url Box */}
                              <div className="relative">
                                <input
                                  type="text"
                                  readOnly
                                  value={fileUrl}
                                  className="w-full text-[10px] font-mono px-3 py-2 rounded-lg border border-primary-200 bg-white pr-10 text-primary-600 truncate focus:outline-none"
                                />
                                <button
                                  onClick={() => handleCopyAudioUrl(file.name)}
                                  className={`absolute ${isRtl ? "left-2" : "right-2"} top-1/2 -translate-y-1/2 p-1 text-primary-500 hover:text-navy-900 hover:bg-primary-50 rounded transition-all`}
                                  title={isRtl ? "העתק קישור ללוח" : "Copy link"}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* How to Connect with Twilio */}
                <div className={`card p-6 bg-navy-900 text-white ${isRtl ? "text-right" : ""}`}>
                  <h3 className="text-sm font-bold text-gold-400 mb-3 flex items-center gap-2 justify-start">
                    <Sliders className="w-4 h-4 shrink-0" />
                    <span>{isRtl ? "הוראות חיבור מהירות ל-Twilio Studio" : "Twilio Studio Connection Guide"}</span>
                  </h3>
                  <ol className={`space-y-2 text-[10px] text-navy-100 list-decimal ${isRtl ? "pr-4" : "pl-4"}`}>
                    <li>
                      {isRtl 
                        ? "העלה את קובץ ה-MP3 במנהל השמע (למשל welcome)." 
                        : "Upload your custom MP3 file in the manager above (e.g. welcome)."}
                    </li>
                    <li>
                      {isRtl 
                        ? "לחץ על כפתור ההעתקה (Copy URL) כדי לקבל את הקישור הישיר שלו." 
                        : "Click the copy icon (Copy URL) to copy the public URL to your clipboard."}
                    </li>
                    <li>
                      {isRtl 
                        ? "בווידג'ט Play או Gather בתוך Twilio Studio, שנה את סוג השמע ל- Play Audio File." 
                        : "In Twilio Studio, add or edit a 'Play' or 'Gather' widget."}
                    </li>
                    <li>
                      {isRtl 
                        ? "הדבק את הקישור שהעתקת לתוך תיבת ה-URL ב-Twilio ושמור." 
                        : "Paste the copied URL into the URL box, set the loop count, and click save."}
                    </li>
                  </ol>
                </div>

              </div>
            </div>
          </motion.div>
        )}


      </div>

      <AnimatePresence>
        {showPhoneModal && (
          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
            <motion.div
              drag
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              dragElastic={0.05}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-6xl overflow-hidden rounded-3xl shadow-2xl border border-slate-800 pointer-events-auto"
            >
              <VirtualPhone
                orders={orders}
                calls={calls}
                voicemails={voicemails}
                smsMessages={smsMessages}
                forwardingNumber={forwardingNumber}
                twilioPhoneNumber={twilioPhoneNumber}
                isRtl={isRtl}
                t={t}
                triggerOutboundCall={triggerOutboundCallFromAdmin}
                sendSms={sendSmsFromVirtualPhone}
                markVoicemailRead={markVoicemailRead}
                deleteVoicemail={dbDeleteVoicemail}
                markSmsRead={markSmsThreadRead}
                onClose={() => setShowPhoneModal(false)}
                dragControls={dragControls}
              />
            </motion.div>
          </div>
        )}

        {printOrder && (
          <PrintCard order={printOrder} onClose={() => setPrintOrder(null)} />
        )}

        {callPromptData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-primary-100 ${isRtl ? "text-right" : ""}`}
            >
              <div className={`flex items-center gap-3 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                <div className="w-12 h-12 bg-gold-100 rounded-full flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6 text-gold-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-navy-900">{isRtl ? "עדכון לקוח טלפוני" : "Call Customer"}</h3>
                  <p className="text-sm text-primary-500 font-medium">{callPromptData.phone}</p>
                </div>
              </div>
              <p className="text-navy-700 mb-6 font-medium">
                {isRtl 
                  ? "ההזמנה סומנה כמוכנה לאיסוף. האם תרצה שהמערכת תתקשר אוטומטית ללקוח ותודיע לו לבוא לאסוף?"
                  : "Order marked as Ready. Do you want the system to automatically call the customer and notify them?"}
              </p>
              <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                <button
                  onClick={() => setCallPromptData(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-primary-200 text-navy-600 font-bold hover:bg-primary-50 transition-colors"
                >
                  {isRtl ? "לא כעת" : "No, skip"}
                </button>
                <button
                  onClick={handleCallPromptConfirm}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-600 text-white font-bold shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  {isRtl ? "כן, התקשר" : "Yes, Call"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showCallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-navy-50"
            >
              <div className={`p-6 border-b border-primary-100 flex items-center justify-between bg-navy-900 text-white ${isRtl ? "flex-row-reverse text-right" : ""}`}>
                <div>
                  <h2 className="text-xl font-bold text-gold-400 flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    {isRtl ? "שיחת טלפון ללקוח" : "Voice Call Customer"}
                  </h2>
                  <p className="text-xs text-navy-300 mt-1">
                    {isRtl ? "התקשר ללקוח דרך המערכת. המערכת תתקשר לטלפון שלך תחילה ואז תחבר אותך ללקוח." : "Call customer via Twilio. The system will ring your phone first, then connect you."}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCallModal(false);
                    setManualCallPhone("");
                    setManualCallOrderId("");
                  }}
                  className="p-2 rounded-full hover:bg-navy-800 text-navy-300 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className={`p-6 space-y-4 ${isRtl ? "text-right" : ""}`}>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs text-emerald-800">
                  <strong>{isRtl ? "הטלפון שלך שיצלצל:" : "Your Phone (To ring first):"} </strong>
                  {forwardingNumber || (isRtl ? "לא מוגדר! הגדר בלשונית הגדרות" : "Not set! Please configure in Settings tab")}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-navy-800 mb-1">
                    {isRtl ? "בחר הזמנה (אופציונלי):" : "Select Order (Optional):"}
                  </label>
                  <select
                    value={manualCallOrderId}
                    onChange={(e) => {
                      const oId = e.target.value;
                      setManualCallOrderId(oId);
                      const selectedOrder = orders.find(o => o.id === oId);
                      if (selectedOrder && selectedOrder.phone) {
                        setManualCallPhone(selectedOrder.phone);
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-xl border border-primary-200 bg-primary-50/50 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                  >
                    <option value="">{isRtl ? "-- בחר הזמנה --" : "-- Select Order --"}</option>
                    {orders.filter(o => !o.archived && o.phone).map(o => (
                      <option key={o.id} value={o.id}>
                        {o.id} - {o.customerName} ({o.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-navy-800 mb-1">
                    {isRtl ? "מספר טלפון להתקשרות:" : "Customer Phone Number:"}
                  </label>
                  <input
                    type="tel"
                    required
                    value={manualCallPhone}
                    onChange={(e) => setManualCallPhone(e.target.value)}
                    placeholder="8455524744"
                    className={`w-full px-3 py-2 rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm bg-primary-50/50 ${isRtl ? "text-right" : ""}`}
                  />
                  <p className="text-[10px] text-primary-400 mt-1">
                    {isRtl ? "מספר טלפון של הלקוח כולל קידומת (למשל 845...)." : "The customer's 10-digit phone number (e.g. 845...)." }
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-primary-100 bg-primary-50/50 flex gap-3">
                <button
                  onClick={() => {
                    setShowCallModal(false);
                    setManualCallPhone("");
                    setManualCallOrderId("");
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-primary-200 text-navy-600 font-bold hover:bg-primary-50 transition-colors"
                >
                  {isRtl ? "ביטול" : "Cancel"}
                </button>
                <button
                  onClick={async () => {
                    if (!manualCallPhone.trim()) {
                      showToast(isRtl ? "אנא הזן מספר טלפון!" : "Please enter a phone number!", "error");
                      return;
                    }
                    if (!forwardingNumber) {
                      showToast(isRtl ? "שגיאה: אנא הגדר מספר העברה בהגדרות!" : "Error: Please set your forwarding phone number in Settings first!", "error");
                      return;
                    }
                    
                    const selectedOrder = orders.find(o => o.id === manualCallOrderId);
                    const customerName = selectedOrder ? selectedOrder.customerName : "";
                    const orderId = selectedOrder ? selectedOrder.id : "";

                    try {
                      showToast(isRtl ? "מתקשר לטלפון שלך כעת..." : "Calling your phone now...", "info");
                      const res = await fetch("/api/twilio/bridge-call", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                          phone: manualCallPhone, 
                          adminPhone: forwardingNumber,
                          customerName,
                          orderId
                        })
                      });
                      if (res.ok) {
                        showToast(isRtl ? "השיחה הופעלה! המתן לצלצול בטלפון שלך." : "Call triggered! Answer your phone to connect.", "success");
                        setShowCallModal(false);
                        setManualCallPhone("");
                        setManualCallOrderId("");
                      } else {
                        const errData = await res.json();
                        showToast(isRtl ? `שגיאה בהפעלת השיחה: ${errData.error || ""}` : `Error triggering call: ${errData.error || ""}`, "error");
                      }
                    } catch (e) {
                      console.error(e);
                      showToast(isRtl ? "שגיאה בהפעלת השיחה" : "Error triggering call", "error");
                    }
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gold-500 hover:bg-gold-600 text-white font-bold shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  {isRtl ? "התקשר ללקוח" : "Call Customer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showCustomerModal && selectedCustomerPhone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full overflow-hidden border border-navy-50 flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className={`p-6 border-b border-primary-100 flex items-center justify-between bg-navy-900 text-white ${isRtl ? "flex-row-reverse text-right" : ""}`}>
                <div>
                  <h2 className="text-xl font-bold text-gold-400 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {isRtl ? "כרטיס לקוח והיסטוריית הזמנות" : "Customer Profile & Order History"}
                  </h2>
                  <p className="text-xs text-navy-300 mt-1">
                    {isRtl ? "ניהול פרטי לקוח גלובליים והיסטוריית כל ההזמנות שלו" : "Manage customer's global details and view/edit all historical orders."}
                  </p>
                </div>
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="p-2 rounded-full hover:bg-navy-800 text-navy-300 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isRtl ? "direction-rtl" : ""}`}>
                  
                  {/* Left Column: Profile Card & Quick Add */}
                  <div className={`space-y-6 lg:border-r lg:border-primary-100 lg:pr-6 ${isRtl ? "lg:border-r-0 lg:border-l lg:pl-6 lg:pr-0" : ""}`}>
                    {/* Customer Profile Card */}
                    <div className="bg-primary-50/50 p-5 rounded-2xl border border-primary-100 space-y-4">
                      <h3 className="font-bold text-navy-900 text-sm border-b border-primary-100 pb-2 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-gold-500" />
                        {isRtl ? "פרופיל לקוח" : "Customer Profile"}
                      </h3>
                      <div>
                        <label className="block text-xs font-semibold text-primary-500 mb-1">
                          {isRtl ? "שם לקוח:" : "Customer Name:"}
                        </label>
                        <input
                          type="text"
                          value={selectedCustomerName}
                          onChange={(e) => setSelectedCustomerName(e.target.value)}
                          className={`w-full px-3 py-2 text-sm rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none bg-white ${isRtl ? "text-right" : ""}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-primary-500 mb-1">
                          {isRtl ? "מספר טלפון:" : "Phone Number:"}
                        </label>
                        <input
                          type="tel"
                          value={selectedCustomerPhone}
                          onChange={(e) => setSelectedCustomerPhone(e.target.value)}
                          className={`w-full px-3 py-2 text-sm rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none bg-white text-left`}
                          dir="ltr"
                        />
                      </div>
                      <button
                        onClick={() => handleUpdateCustomerProfile(selectedCustomerName, selectedCustomerPhone)}
                        className="w-full py-2 bg-navy-900 text-white font-bold text-xs rounded-xl hover:bg-navy-800 transition-colors shadow flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isRtl ? "עדכן פרופיל לקוח" : "Update Profile"}
                      </button>
                    </div>

                    {/* Quick Add Order form */}
                    <div className="bg-primary-50/50 p-5 rounded-2xl border border-primary-100">
                      {!isAddingOrderInModal ? (
                        <button
                          onClick={() => setIsAddingOrderInModal(true)}
                          className="w-full py-3 bg-gold-500 text-white font-bold text-xs rounded-xl hover:bg-gold-600 transition-all shadow-md shadow-gold-500/10 flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          {isRtl ? "הוסף הזמנה חדשה ללקוח זה" : "Add New Order for Customer"}
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <h3 className="font-bold text-navy-900 text-sm border-b border-primary-100 pb-2">
                            {isRtl ? "הזמנה חדשה" : "New Order"}
                          </h3>
                          <div>
                            <label className="block text-xs font-semibold text-primary-500 mb-1">
                              {isRtl ? "סטטוס:" : "Status:"}
                            </label>
                            <select
                              value={modalNewOrder.status}
                              onChange={(e) => setModalNewOrder({ ...modalNewOrder, status: e.target.value as OrderStatus })}
                              className={`w-full px-3 py-1.5 text-xs rounded-xl border border-primary-200 bg-white focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                            >
                              {statusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-primary-500 mb-1">
                              {isRtl ? "תוצאה:" : "Result:"}
                            </label>
                            <select
                              value={modalNewOrder.result}
                              onChange={(e) => setModalNewOrder({ ...modalNewOrder, result: e.target.value })}
                              className={`w-full px-3 py-1.5 text-xs rounded-xl border border-primary-200 bg-white focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                            >
                              {resultOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-primary-500 mb-1">
                              {isRtl ? "מיקום:" : "Location:"}
                            </label>
                            <input
                              type="text"
                              value={modalNewOrder.location}
                              onChange={(e) => setModalNewOrder({ ...modalNewOrder, location: e.target.value })}
                              placeholder="14 Buchanan Rd"
                              className={`w-full px-3 py-1.5 text-xs rounded-xl border border-primary-200 bg-white focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-primary-500 mb-1">
                              {isRtl ? "צפי סיום:" : "Est. Completion:"}
                            </label>
                            <input
                              type="date"
                              value={modalNewOrder.estimatedCompletion}
                              onChange={(e) => setModalNewOrder({ ...modalNewOrder, estimatedCompletion: e.target.value })}
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-primary-200 bg-white focus:ring-2 focus:ring-gold-400 focus:outline-none text-left"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-primary-500 mb-1">
                              {isRtl ? "תאריך קבלה:" : "Date Received:"}
                            </label>
                            <input
                              type="date"
                              value={modalNewOrder.dateReceived}
                              onChange={(e) => setModalNewOrder({ ...modalNewOrder, dateReceived: e.target.value })}
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-primary-200 bg-white focus:ring-2 focus:ring-gold-400 focus:outline-none text-left"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-primary-500 mb-1">
                              {isRtl ? "הערות:" : "Notes:"}
                            </label>
                            <textarea
                              rows={2}
                              value={modalNewOrder.notes}
                              onChange={(e) => setModalNewOrder({ ...modalNewOrder, notes: e.target.value })}
                              className={`w-full px-3 py-1.5 text-xs rounded-xl border border-primary-200 bg-white focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setIsAddingOrderInModal(false)}
                              className="flex-1 py-2 rounded-xl border border-primary-200 text-xs text-navy-600 font-bold hover:bg-primary-50 transition-colors"
                            >
                              {isRtl ? "ביטול" : "Cancel"}
                            </button>
                            <button
                              onClick={handleCreateOrderInModal}
                              className="flex-1 py-2 rounded-xl bg-gold-500 text-white font-bold text-xs hover:bg-gold-600 transition-colors shadow"
                            >
                              {isRtl ? "צור הזמנה" : "Create"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Historical Orders List */}
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-bold text-navy-900 text-sm border-b border-primary-100 pb-2 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-gold-500" />
                      {isRtl ? "היסטוריית הזמנות של הלקוח" : "Customer Order History"}
                      <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full font-bold">
                        {orders.filter(o => o.phone && o.phone.replace(/\D/g, "") === selectedCustomerPhone?.replace(/\D/g, "")).length}
                      </span>
                    </h3>

                    <div className="overflow-x-auto border border-primary-100 rounded-2xl shadow-sm bg-white">
                      <table className="w-full text-[11px] min-w-[800px]">
                        <thead>
                          <tr className={`bg-primary-50 border-b border-primary-100 ${isRtl ? "text-right" : "text-left"}`}>
                            <th className={`px-2 py-2.5 font-bold uppercase tracking-wider text-navy-800 w-[100px] ${isRtl ? "text-right" : "text-left"}`}>ID</th>
                            <th className={`px-2 py-2.5 font-bold uppercase tracking-wider text-navy-800 w-[95px] ${isRtl ? "text-right" : "text-left"}`}>{t("status")}</th>
                            <th className={`px-2 py-2.5 font-bold uppercase tracking-wider text-navy-800 w-[120px] ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "תוצאה" : "Result"}</th>
                            <th className={`px-2 py-2.5 font-bold uppercase tracking-wider text-navy-800 w-[80px] ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "מיקום" : "Location"}</th>
                            <th className={`px-2 py-2.5 font-bold uppercase tracking-wider text-navy-800 w-[140px] ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "תאריכים" : "Dates"}</th>
                            <th className={`px-2 py-2.5 font-bold uppercase tracking-wider text-navy-800 w-auto ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "הערות" : "Notes"}</th>
                            <th className="px-2 py-2.5 font-bold uppercase tracking-wider text-navy-800 w-[70px] text-center">{t("actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders
                            .filter(o => o.phone && o.phone.replace(/\D/g, "") === selectedCustomerPhone?.replace(/\D/g, ""))
                            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                            .map((o) => (
                              <tr key={o.id} className="border-b border-primary-50 hover:bg-primary-50/20 transition-colors">
                                <td className="px-2 py-1.5 font-mono text-[10px] text-navy-950 font-bold break-all leading-tight">
                                  {o.id}
                                  {o.archived && (
                                    <span className="block text-[8px] text-primary-400 italic font-sans font-medium">({isRtl ? "ארכיון" : "Archived"})</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  <select
                                    value={o.status}
                                    onChange={(e) => handleUpdateModalOrderField(o.id, "status", e.target.value as OrderStatus)}
                                    className={`w-full px-1 py-0.5 text-[10px] rounded border border-primary-200 bg-white focus:outline-none focus:ring-1 focus:ring-gold-400 font-medium ${isRtl ? "text-right" : ""}`}
                                  >
                                    {statusOptions.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <select
                                    value={o.result || ""}
                                    onChange={(e) => handleUpdateModalOrderField(o.id, "result", e.target.value)}
                                    className={`w-full px-1 py-0.5 text-[10px] rounded border border-primary-200 bg-white focus:outline-none focus:ring-1 focus:ring-gold-400 font-medium ${isRtl ? "text-right" : ""}`}
                                  >
                                    {resultOptions.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={o.location || ""}
                                    onChange={(e) => handleUpdateModalOrderField(o.id, "location", e.target.value)}
                                    className={`w-full px-1 py-0.5 text-[10px] rounded border border-primary-200 bg-white focus:outline-none focus:ring-1 focus:ring-gold-400 font-medium ${isRtl ? "text-right" : ""}`}
                                  />
                                </td>
                                <td className="px-2 py-1.5 space-y-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-primary-400 font-medium text-[8px] w-6 shrink-0">IN:</span>
                                    <input
                                      type="date"
                                      value={o.dateReceived || ""}
                                      onChange={(e) => handleUpdateModalOrderField(o.id, "dateReceived", e.target.value)}
                                      className="px-1 py-0.5 rounded border border-primary-100 bg-white text-[9px] w-[95px] shrink-0 focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-primary-400 font-medium text-[8px] w-6 shrink-0">EST:</span>
                                    <input
                                      type="date"
                                      value={o.estimatedCompletion || ""}
                                      onChange={(e) => handleUpdateModalOrderField(o.id, "estimatedCompletion", e.target.value)}
                                      className="px-1 py-0.5 rounded border border-primary-100 bg-white text-[9px] w-[95px] shrink-0 focus:outline-none"
                                    />
                                  </div>
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={o.notes || ""}
                                    onChange={(e) => handleUpdateModalOrderField(o.id, "notes", e.target.value)}
                                    className={`w-full px-1 py-0.5 text-[10px] rounded border border-primary-200 bg-white focus:outline-none focus:ring-1 focus:ring-gold-400 font-medium ${isRtl ? "text-right" : ""}`}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <div className="flex items-center justify-center gap-1 shrink-0">
                                    <button
                                      onClick={() => handleToggleArchiveModalOrder(o.id, !!o.archived)}
                                      className={`p-1 rounded-lg border transition-colors ${
                                        o.archived 
                                          ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" 
                                          : "border-primary-200 text-primary-600 hover:bg-primary-50"
                                      }`}
                                      title={o.archived ? (isRtl ? "שחזר מהארכיון" : "Restore from Archive") : (isRtl ? "העבר לארכיון" : "Archive")}
                                    >
                                      {o.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteModalOrder(o.id)}
                                      className="p-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                                      title={isRtl ? "מחק לצמיתות" : "Delete permanently"}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          {orders.filter(o => o.phone && o.phone.replace(/\D/g, "") === selectedCustomerPhone?.replace(/\D/g, "")).length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-6 py-6 text-center text-primary-400 italic font-medium">
                                {isRtl ? "אין היסטוריית הזמנות ללקוח זה" : "No order history for this customer."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-primary-100 bg-primary-50/50 flex justify-end">
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="btn-primary px-6 py-2"
                >
                  {isRtl ? "סגור" : "Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showBlueprintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-navy-50"
            >
              {/* Modal Header */}
              <div className={`p-6 border-b border-primary-100 flex items-center justify-between bg-navy-900 text-white ${isRtl ? "flex-row-reverse text-right" : ""}`}>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gold-400 flex items-center gap-2">
                    <FileAudio className="w-6 h-6 shrink-0" />
                    {isRtl ? "מרכז מפות ומדריכי מערכת ה-IVR" : "IVR System Blueprint & Developer Hub"}
                  </h2>
                  <p className="text-xs text-navy-300 mt-1">
                    {isRtl ? "כל הנתונים, ממשקי ה-API ומפת הזרימה של המערכת הטלפונית במקום אחד." : "Complete flowchart, API endpoints, and configuration blueprints for the telephone system."}
                  </p>
                </div>
                <button
                  onClick={() => setShowBlueprintModal(false)}
                  className="p-2 rounded-full hover:bg-navy-800 text-navy-300 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className={`flex border-b border-primary-100 bg-primary-50/50 p-2 gap-2 text-sm font-semibold overflow-x-auto ${isRtl ? "flex-row-reverse" : ""}`}>
                <button
                  onClick={() => setActiveBlueprintTab("flow")}
                  className={`px-4 py-2 rounded-lg transition-colors shrink-0 focus:outline-none flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : ""}`}
                  style={{
                    backgroundColor: activeBlueprintTab === "flow" ? "#0f172a" : "transparent",
                    color: activeBlueprintTab === "flow" ? "#ffffff" : "#0369a1"
                  }}
                >
                  <Network className="w-4 h-4 shrink-0" />
                  <span>{isRtl ? "מפת זרימת השיחה" : "Call Flowchart"}</span>
                </button>

                <button
                  onClick={() => setActiveBlueprintTab("api")}
                  className={`px-4 py-2 rounded-lg transition-colors shrink-0 focus:outline-none flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : ""}`}
                  style={{
                    backgroundColor: activeBlueprintTab === "api" ? "#0f172a" : "transparent",
                    color: activeBlueprintTab === "api" ? "#ffffff" : "#0369a1"
                  }}
                >
                  <Webhook className="w-4 h-4 shrink-0" />
                  <span>{isRtl ? "ממשקי API ושרת" : "API & Webhooks"}</span>
                </button>
                <button
                  onClick={() => setActiveBlueprintTab("twilio")}
                  className={`px-4 py-2 rounded-lg transition-colors shrink-0 focus:outline-none flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : ""}`}
                  style={{
                    backgroundColor: activeBlueprintTab === "twilio" ? "#0f172a" : "transparent",
                    color: activeBlueprintTab === "twilio" ? "#ffffff" : "#0369a1"
                  }}
                >
                  <Sliders className="w-4 h-4 shrink-0" />
                  <span>{isRtl ? "הגדרות Twilio מתקדמות" : "Advanced Twilio"}</span>
                </button>
                <button
                  onClick={() => setActiveBlueprintTab("business-card")}
                  className={`px-4 py-2 rounded-lg transition-colors shrink-0 focus:outline-none flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : ""}`}
                  style={{
                    backgroundColor: activeBlueprintTab === "business-card" ? "#0f172a" : "transparent",
                    color: activeBlueprintTab === "business-card" ? "#ffffff" : "#0369a1"
                  }}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>{isRtl ? "כרטיס ביקור" : "Business Card"}</span>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 p-6 overflow-y-auto bg-primary-50/20">
                {/* 1. CALL FLOW TAB */}
                {activeBlueprintTab === "flow" && (
                  <div className={`space-y-6 ${isRtl ? "text-right" : ""}`}>
                    <div className="bg-navy-50 border border-navy-100 rounded-2xl p-4 text-sm text-navy-900">
                      <p className="font-bold mb-1 text-navy-800">
                        {isRtl ? "💡 הכלל החשוב ביותר להודעות מוקלטות:" : "💡 Quick Tip for Pre-recorded Audios:"}
                      </p>
                      <p className="text-xs text-primary-600 leading-relaxed">
                        {isRtl 
                          ? "המערכת תומכת בהשמעת קולות אנושיים יוקרתיים של ElevenLabs. פשוט תעלה את הקובץ ל-IVR Audio Manager, תעתיק את הקישור ותשנה בווידג'טים של Twilio מ-Say a message ל-Play an audio file."
                          : "You can play natural human-sounding voices from ElevenLabs. Upload them in the 'IVR Audio Manager', copy the URL, and in Twilio Studio change 'Say a message' to 'Play an audio file'."}
                      </p>
                    </div>

                    {/* Flowchart Timeline */}
                    <div className={`relative border-l-2 border-gold-300 ml-4 pl-6 space-y-8 ${isRtl ? "border-l-0 border-r-2 ml-0 pl-0 pr-6 mr-4" : ""}`}>
                      {/* Step 1 */}
                      <div className="relative">
                        <div className={`absolute top-1.5 -left-[31px] w-4 h-4 rounded-full bg-gold-400 ring-4 ring-white ${isRtl ? "-left-0 -right-[31px]" : ""}`}></div>
                        <h4 className="font-bold text-navy-900 text-base">{isRtl ? "1️⃣ כניסה לשיחה וברכת שלום" : "1️⃣ Call Entry & Welcome Menu"}</h4>
                        <p className="text-xs text-primary-600 mt-1 max-w-3xl leading-relaxed">
                          {isRtl 
                            ? "השיחה מתחילה בברכת שלום וזיהוי מספר המתקשר. המערכת מקריאה את ה-welcome_menu. הקשה על מקשים מעבירה את המתקשר לתפריטים הבאים:"
                            : "The call starts with a greeting and automated caller ID detection. Plays the welcome_menu. Standard DTMF keypresses route the user to:"}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                          <div className="p-3 bg-white border border-primary-100 rounded-xl">
                            <span className="font-bold text-navy-900 bg-primary-100 px-2 py-0.5 rounded text-xs">Key 1</span>
                            <span className="text-xs text-primary-700 block mt-2 font-medium">{isRtl ? "מידע כללי ומחירים (ivrGeneralEn/He)" : "General Info & Pricing (ivrGeneralEn/He)"}</span>
                          </div>
                          <div className="p-3 bg-white border border-primary-100 rounded-xl">
                            <span className="font-bold text-navy-900 bg-primary-100 px-2 py-0.5 rounded text-xs">Key 2</span>
                            <span className="text-xs text-primary-700 block mt-2 font-medium">{isRtl ? "מעקב הזמנות אוטומטי (Check Order Status)" : "Track Order Status (Automatic Caller ID)"}</span>
                          </div>
                          <div className="p-3 bg-white border border-primary-100 rounded-xl">
                            <span className="font-bold text-navy-900 bg-primary-100 px-2 py-0.5 rounded text-xs">Key 3</span>
                            <span className="text-xs text-primary-700 block mt-2 font-medium">{isRtl ? "שירותי VIP וחנויות (ivrSpecialEn/He)" : "VIP & Store Services (ivrSpecialEn/He)"}</span>
                          </div>
                          <div className="p-3 bg-white border border-primary-100 rounded-xl">
                            <span className="font-bold text-navy-900 bg-primary-100 px-2 py-0.5 rounded text-xs">Key 0</span>
                            <span className="text-xs text-primary-700 block mt-2 font-medium">{isRtl ? "העברת שיחה לנציג (Forwarding Number)" : "Forward Call to representative"}</span>
                          </div>
                          <div className="p-3 bg-gold-50 border border-gold-200 rounded-xl">
                            <span className="font-bold text-gold-900 bg-gold-200 px-2 py-0.5 rounded text-xs">Key 9</span>
                            <span className="text-xs text-gold-800 block mt-2 font-semibold">{isRtl ? "תפריט אדמין מוסתר (הזנת קוד PIN)" : "Hidden Admin Mode (Enter PIN)"}</span>
                          </div>
                          <div className="p-3 bg-white border border-primary-100 rounded-xl">
                            <span className="font-bold text-navy-900 bg-primary-100 px-2 py-0.5 rounded text-xs">Direct #</span>
                            <span className="text-xs text-primary-700 block mt-2 font-medium">{isRtl ? "הקלדת מספר הזמנה ישירות מהפתיח" : "Type Order ID + # directly from menu"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="relative">
                        <div className={`absolute top-1.5 -left-[31px] w-4 h-4 rounded-full bg-gold-400 ring-4 ring-white ${isRtl ? "-left-0 -right-[31px]" : ""}`}></div>
                        <h4 className="font-bold text-navy-900 text-base">{isRtl ? "2️⃣ אופציה 2: מעקב הזמנות חכם" : "2️⃣ Option 2: Smart Order Tracking"}</h4>
                        <p className="text-xs text-primary-600 mt-1 max-w-3xl leading-relaxed">
                          {isRtl 
                            ? "מעקב ההזמנות מבוצע בצורה חכמה ומורכבת בשני נתיבים:"
                            : "Order status check follows a highly refined automated logic:"}
                        </p>
                        <div className="bg-white border border-primary-100 rounded-2xl p-4 mt-3 space-y-3">
                          <div>
                            <h5 className="text-xs font-bold text-navy-800 uppercase tracking-wide">{isRtl ? "נתיב א: מזהה שיחה אוטומטי (Auto ID Lookup)" : "Path A: Automated ID Lookup"}</h5>
                            <p className="text-xs text-primary-600 mt-1 leading-relaxed">
                              {isRtl 
                                ? "המערכת שולחת את מספר הטלפון המזהה ל-caller_lookup. אם נמצאו הזמנות המקושרות למספר זה, המערכת תשאל: 'האם לבקש הזמנה עם מספר X או שתרצה להאזין ידנית?'. הקשת 1 מקריאה את הסטטוס, והקשת 2 מאפשרת הקשת מספר ידנית."
                                : "The server checks if any orders are linked to the calling phone number. If yes, it asks: 'Do you want to check order X or enter another number manually?'. Pressing 1 speaks the status, pressing 2 goes to manual input."}
                            </p>
                          </div>
                          <div className="border-t border-primary-50 pt-3">
                            <h5 className="text-xs font-bold text-navy-800 uppercase tracking-wide">{isRtl ? "נתיב ב: הזנה ידנית (Manual Lookup)" : "Path B: Manual Lookup"}</h5>
                            <p className="text-xs text-primary-600 mt-1 leading-relaxed">
                              {isRtl 
                                ? "אם לא מזוהה טלפון או אם נבחר חיפוש ידני, המשתמש מקליד את מספר ההזמנה. השרת מבצע manual_lookup ומקריא את הממצאים באנגלית או עברית עם SSML לתוצאות מדויקות."
                                : "If no number matches or manual input is selected, the user types the order ID. The server calls manual_lookup and speaks the status/results in English or Hebrew."}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="relative">
                        <div className={`absolute top-1.5 -left-[31px] w-4 h-4 rounded-full bg-gold-400 ring-4 ring-white ${isRtl ? "-left-0 -right-[31px]" : ""}`}></div>
                        <h4 className="font-bold text-navy-900 text-base">{isRtl ? "3️⃣ אופציה 9: תפריט ניהול טלפוני (Admin)" : "3️⃣ Option 9: Phone Admin Menu"}</h4>
                        <p className="text-xs text-primary-600 mt-1 max-w-3xl leading-relaxed">
                          {isRtl 
                            ? "כניסה מתבצעת על ידי הקשת 9 ולאחריה קוד PIN בן 4 ספרות (מסונכרן עם האתר). פעולות מנהל מאושרות:"
                            : "Accessed by typing 9 followed by the admin 4-digit PIN (synced live with the website). Supported admin actions:"}
                        </p>
                        <div className="bg-navy-900 text-white rounded-2xl p-4 mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="font-bold text-gold-400">1: Play Recent Orders</span>
                            <p className="text-navy-200 mt-1">{isRtl ? "מקריא את 5 ההזמנות האחרונות שנוספו למערכת." : "Speaks the IDs and statuses of the last 5 added orders."}</p>
                          </div>
                          <div>
                            <span className="font-bold text-gold-400">2: Update Order Status & Results</span>
                            <p className="text-navy-200 mt-1">{isRtl ? "מקלידים מספר הזמנה, מעדכנים סטטוס (1-6) ותוצאת שעטנז. המערכת מקריאה אישור מלא ספרה-אחר-ספרה." : "Input order ID, select status (1-6) and shatnez result. Speaks exact details back as digits."}</p>
                          </div>
                          <div>
                            <span className="font-bold text-gold-400">3: Search by Phone Number</span>
                            <p className="text-navy-200 mt-1">{isRtl ? "הקלדת מספר טלפון משמיעה את רשימת כל ההזמנות המשויכות אליו." : "Inputting a phone number speaks all associated order IDs."}</p>
                          </div>
                          <div>
                            <span className="font-bold text-gold-400">4: Add New Order</span>
                            <p className="text-navy-200 mt-1">{isRtl ? "יוצר הזמנה חדשה עם מספר טלפון של לקוח. יוצר מזהה חדש אוטומטית ומקריא אותו ספרה-אחר-ספרה בהצלחה." : "Creates a new order for a customer. Auto-generates order ID and speaks it back as single digits."}</p>
                          </div>
                          <div className="md:col-span-2 border-t border-navy-800 pt-3">
                            <span className="font-bold text-gold-400">5: Call Customer (Keypad/Digits Bridge)</span>
                            <p className="text-navy-200 mt-1">{isRtl ? "הקש 5 והקלד מספר הזמנה או מספר טלפון כדי לחבר את שיחת הטלפון הנוכחית שלך ישירות ללקוח." : "Press 5 and enter order ID or phone number to bridge your current call directly to the customer."}</p>
                          </div>
                          <div className="md:col-span-2 border-t border-navy-800 pt-3">
                            <span className="font-bold text-gold-400 flex items-center gap-1">🗣️ Voice Command: Call Customer</span>
                            <p className="text-navy-200 mt-1">{isRtl ? "אמור 'Call order 102' או 'Call phone 845...' בתפריט הניהול כדי לחבר את שיחת הטלפון הנוכחית שלך ישירות ללקוח." : "Say 'Call order 102' or 'Call phone 845...' in the voice admin menu to bridge your current call directly to the customer."}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}



                {/* 2. API WEBHOOKS TAB */}
                {activeBlueprintTab === "api" && (
                  <div className={`space-y-6 text-left ${isRtl ? "direction-ltr" : ""}`}>
                    <p className={`text-xs text-primary-600 ${isRtl ? "text-right" : ""}`}>
                      {isRtl 
                        ? "ווידג'טים של Twilio Studio מסוג HTTP Request פונים לממשק הבא של השרת שלך. הפנייה נעשית תמיד בשיטת POST עם פרמטר action:" 
                        : "Twilio HTTP Request widgets query your Next.js backend. Calls are routed to this endpoint via POST using the action parameter:"}
                    </p>
                    
                    <div className="bg-navy-950 text-gold-400 p-3 rounded-lg font-mono text-xs select-all">
                      POST https://shatnez-lab.vercel.app/api/twilio/studio
                    </div>

                    <div className="space-y-4">
                      {/* Action 1 */}
                      <div className="p-4 bg-white border border-primary-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-navy-900 bg-navy-50 px-2 py-0.5 rounded">action: caller_lookup</span>
                          <span className="text-xs text-green-600 font-semibold">{isRtl ? "מעקב אוטומטי" : "Caller Lookup"}</span>
                        </div>
                        <p className="text-xs text-primary-600">{isRtl ? "בודק אם מספר הטלפון המזהה קיים." : "Checks if the caller's incoming phone number exists in Firestore."}</p>
                        <div className="text-[11px] bg-primary-50 p-2 rounded font-mono text-primary-700">
                          Body: {"{ \"From\": \"+18455524744\" }"}
                        </div>
                      </div>

                      {/* Action 2 */}
                      <div className="p-4 bg-white border border-primary-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-navy-900 bg-navy-50 px-2 py-0.5 rounded">action: manual_lookup</span>
                          <span className="text-xs text-green-600 font-semibold">{isRtl ? "חיפוש ידני" : "Manual Lookup"}</span>
                        </div>
                        <p className="text-xs text-primary-600">{isRtl ? "מחפש הזמנה ספציפית לפי מספר מזהה." : "Looks up order by typed order ID."}</p>
                        <div className="text-[11px] bg-primary-50 p-2 rounded font-mono text-primary-700">
                          Body: {"{ \"orderId\": \"105\" }"}
                        </div>
                      </div>

                      {/* Action 3 */}
                      <div className="p-4 bg-white border border-primary-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-navy-900 bg-navy-50 px-2 py-0.5 rounded">action: admin_login</span>
                          <span className="text-xs text-gold-600 font-semibold">{isRtl ? "כניסת אדמין" : "Admin Auth"}</span>
                        </div>
                        <p className="text-xs text-primary-600">{isRtl ? "מאמת קוד PIN לגישת מנהל טלפונית." : "Authenticates phone input PIN."}</p>
                        <div className="text-[11px] bg-primary-50 p-2 rounded font-mono text-primary-700">
                          Body: {"{ \"pin\": \"1234\" }"}
                        </div>
                      </div>

                      {/* Action 4 */}
                      <div className="p-4 bg-white border border-primary-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-navy-900 bg-navy-50 px-2 py-0.5 rounded">action: admin_add_order</span>
                          <span className="text-xs text-navy-600 font-semibold">{isRtl ? "הוספת הזמנה בטלפון" : "Add Order via Phone"}</span>
                        </div>
                        <p className="text-xs text-primary-600">{isRtl ? "מנהל יוצר הזמנה חדשה בשיחה." : "Enables admin to create new orders on the fly."}</p>
                        <div className="text-[11px] bg-primary-50 p-2 rounded font-mono text-primary-700">
                          Body: {"{ \"phone\": \"8455524744\" }"}
                        </div>
                      </div>

                      {/* Action 5 */}
                      <div className="p-4 bg-white border border-primary-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-navy-900 bg-navy-50 px-2 py-0.5 rounded">action: voicemail</span>
                          <span className="text-xs text-navy-600 font-semibold">{isRtl ? "הודעה קולית לאימייל" : "Voicemail to Email"}</span>
                        </div>
                        <p className="text-xs text-primary-600">{isRtl ? "שולח הודעת הקלטה קולית ופרטי מתקשר לתיבת האימייל שלך." : "Sends recorded voicemail link and caller details to configured email address."}</p>
                        <div className="text-[11px] bg-primary-50 p-2 rounded font-mono text-primary-700">
                          Body: {"{ \"recordingUrl\": \"https://api.twilio.com/...\", \"recordingDuration\": \"15\", \"phone\": \"+18455524744\" }"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. TWILIO STUDIO CONFIG TAB */}
                {activeBlueprintTab === "twilio" && (
                  <div className={`space-y-6 ${isRtl ? "text-right" : ""}`}>
                    <h3 className="font-bold text-navy-900 text-base">{isRtl ? "🛠️ הגדרת השמעה מבוססת SSML ופולי (Polly)" : "🛠️ Premium SSML & Amazon Polly Guides"}</h3>
                    <p className="text-xs text-primary-600 leading-relaxed">
                      {isRtl 
                        ? "מערכת Polly.Joey תומכת בתגי speak שמלמדים את הרובוט להקריא מספרים ספרה-אחר-ספרה במקום מספר שלם. כדי לעשות זאת, יש להשתמש תמיד בהגדרות Custom בווידג'טים הבאים:"
                        : "Amazon Polly.Joey enables speech customization like pronouncing letters and digits one-by-one. Make sure to configure your widgets to Custom language format:"}
                    </p>

                    <div className="bg-white border border-primary-100 rounded-2xl p-5 space-y-4">
                      {/* Configuration Parameter Table */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs border-b border-primary-50 pb-4">
                        <div>
                          <span className="block text-primary-500 font-semibold uppercase">{isRtl ? "פרמטר" : "Field"}</span>
                          <span className="block font-bold text-navy-900 mt-1">{isRtl ? "Language Type" : "Language Type"}</span>
                        </div>
                        <div>
                          <span className="block text-primary-500 font-semibold uppercase">{isRtl ? "ערך מומלץ" : "Value"}</span>
                          <span className="block font-bold text-navy-900 mt-1">Custom</span>
                        </div>
                        <div>
                          <span className="block text-primary-500 font-semibold uppercase">{isRtl ? "הסבר" : "Why"}</span>
                          <span className="block text-primary-700 mt-1">{isRtl ? "מאפשר שימוש ב-SSML ופולי" : "Allows tags and customized voice engines"}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs border-b border-primary-50 pb-4">
                        <div>
                          <span className="block font-bold text-navy-900">{isRtl ? "Custom Language Code" : "Custom Language Code"}</span>
                        </div>
                        <div>
                          <span className="block font-bold text-navy-900 text-gold-600 font-mono">en-US</span>
                        </div>
                        <div>
                          <span className="block text-primary-700">{isRtl ? "קוד שפה לאנגלית. לעברית כתוב he-IL" : "Language code. Use he-IL for Hebrew"}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pb-2">
                        <div>
                          <span className="block font-bold text-navy-900">{isRtl ? "Custom Voice" : "Custom Voice"}</span>
                        </div>
                        <div>
                          <span className="block font-bold text-navy-900 text-gold-600 font-mono">Polly.Joey</span>
                        </div>
                        <div>
                          <span className="block text-primary-700">{isRtl ? "קול של Amazon Polly הגברי. לעברית מומלץ Polly.Madlene" : "Polly Joey voice. For Hebrew, use Polly.Madlene"}</span>
                        </div>
                      </div>
                    </div>

                    <h3 className="font-bold text-navy-900 text-base mt-6">{isRtl ? "🧹 ניקוי סימן הפלוס (+) ממספרי טלפון ב-Twilio Studio" : "🧹 Filtering Special Characters in Liquid"}</h3>
                    <p className="text-xs text-primary-600 leading-relaxed">
                      {isRtl 
                        ? "כאשר מעבירים את מספר הטלפון המזוהה של המתקשר (contact.channel.address) לרובוט, הוא עלול להתבלבל בגלל סימן הפלוס. לכן, בתוך הטקסט של ask_lookup_choice ב-Twilio Studio, מומלץ תמיד להשתמש בסינון הבא של Liquid:"
                        : "When using the caller's incoming phone number variable in a Say/Play widget, special characters like '+' can confuse Polly. Use this filter inside the speak block:"}
                    </p>

                    <div className="bg-navy-950 text-gold-400 p-3 rounded-lg font-mono text-xs select-all">
                      {"<speak>I see you are calling from <say-as interpret-as=\"digits\">{{contact.channel.address | remove: \"+\"}}</say-as>...</speak>"}
                    </div>
                  </div>
                )}

                {/* 5. BUSINESS CARD TAB */}
                {activeBlueprintTab === "business-card" && (
                  <div className="flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-primary-50/50 to-white rounded-2xl border border-primary-100">
                    <div className="max-w-xl w-full text-center space-y-6">
                      <div className="space-y-1">
                        <h3 className="text-xl font-bold text-navy-900">
                          {isRtl ? "ניהול והדפסת כרטיס ביקור" : "Business Card Hub"}
                        </h3>
                        <p className="text-xs text-primary-600">
                          {isRtl
                            ? "צפה בכרטיס הדו-צדדי האינטראקטיבי, שלוט בעיצובו והדפס אותו ישירות בגודל סטנדרטי."
                            : "Preview the double-sided interactive card and print it in standard size."}
                        </p>
                      </div>

                      {/* Card Preview Container */}
                      <div className="flex flex-col items-center justify-center py-4">
                        <div 
                          className="w-full max-w-[340px] h-[195px] cursor-pointer group"
                          style={{ perspective: "1000px" }}
                          onClick={() => setIsCardFlipped(!isCardFlipped)}
                        >
                          <motion.div
                            className="w-full h-full relative"
                            style={{ transformStyle: "preserve-3d" }}
                            animate={{ rotateY: isCardFlipped ? 180 : 0 }}
                            transition={{ duration: 0.6, ease: "easeInOut" }}
                          >
                            {/* FRONT SIDE (Rich Deep Navy & Gold Premium) */}
                            <div 
                              className="absolute inset-0 w-full h-full rounded-2xl p-5 text-white flex flex-col justify-between border-2 border-gold-400 shadow-xl overflow-hidden select-none"
                              style={{ 
                                backfaceVisibility: "hidden",
                                background: "linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%)"
                              }}
                            >
                              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/20 via-transparent to-transparent pointer-events-none" />
                              <div className="absolute inset-0 border border-gold-400/30 rounded-xl m-1.5 pointer-events-none" />
                              
                              <div className="flex justify-between items-start z-10">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-gold-400 rounded-lg flex items-center justify-center">
                                    <Microscope className="w-4 h-4 text-navy-950" />
                                  </div>
                                  <div className="text-left">
                                    <span className="font-bold text-[11px] tracking-wide block leading-none">THE SHATNEZ LAB</span>
                                    <span className="text-[7.5px] text-primary-300 tracking-widest block uppercase mt-0.5 leading-none">EST. 2026</span>
                                  </div>
                                </div>
                                <ShieldCheck className="w-5 h-5 text-gold-400" />
                              </div>

                              <div className="space-y-1 text-center z-10 my-auto">
                                <h4 className="text-lg font-black text-white tracking-wide">
                                  {isRtl ? "מעבדת השעטנז" : "THE SHATNEZ LAB"}
                                </h4>
                                <p className="text-[9px] text-gold-400 font-semibold tracking-wider uppercase">
                                  {isRtl ? "בדיקת שעטנז מקצועית ומוסמכת" : "Professional Shatnez Inspection"}
                                </p>
                              </div>

                              <div className="flex justify-between items-center text-[8.5px] text-primary-200 font-mono tracking-wide z-10">
                                <span>📞 845-552-4744</span>
                                <span>shatnez-lab.vercel.app</span>
                              </div>
                            </div>

                            {/* BACK SIDE (White & Navy Content) */}
                            <div 
                              className="absolute inset-0 w-full h-full rounded-2xl p-4 bg-white text-navy-900 flex justify-between border-2 border-navy-900 shadow-xl overflow-hidden select-none"
                              style={{ 
                                backfaceVisibility: "hidden",
                                transform: "rotateY(180deg)"
                              }}
                            >
                              <div className="absolute inset-0 bg-primary-50/20 pointer-events-none" />
                              
                              {/* Details Section */}
                              <div className={`flex flex-col justify-between text-left w-[62%] ${isRtl ? "text-right order-2 items-end" : "order-1"}`}>
                                <div className="space-y-0.5">
                                  <h4 className="font-bold text-xs text-navy-950 flex items-center gap-1">
                                    <Microscope className="w-3 h-3 text-gold-500" />
                                    <span>{isRtl ? "מעבדת השעטנז" : "The Shatnez Lab"}</span>
                                  </h4>
                                  <p className="text-[7.5px] text-primary-500 font-semibold leading-relaxed">
                                    {isRtl 
                                      ? "בדיקות מעבדה, שירותי VIP וחנויות" 
                                      : "Microscopic analysis, VIP pickups"}
                                  </p>
                                </div>

                                <div className="space-y-1 py-1">
                                  <div className={`flex items-center gap-1.5 text-[8.5px] text-primary-800 ${isRtl ? "flex-row-reverse" : ""}`}>
                                    <Phone className="w-2.5 h-2.5 text-gold-500 shrink-0" />
                                    <span className="font-bold">845-552-4744</span>
                                  </div>
                                  <div className={`flex items-center gap-1.5 text-[8.5px] text-primary-800 ${isRtl ? "flex-row-reverse" : ""}`}>
                                    <MapPin className="w-2.5 h-2.5 text-gold-500 shrink-0" />
                                    <span>14 Buchanan Rd, Spring Valley</span>
                                  </div>
                                </div>

                                <div className="flex gap-1.5 mt-0.5 border-t border-primary-100 pt-1">
                                  <span className="text-[7px] bg-primary-50 border border-primary-100 px-1 py-0.5 rounded font-bold text-navy-950">
                                    {isRtl ? "פשוט: $5" : "Simple: $5"}
                                  </span>
                                  <span className="text-[7px] bg-primary-50 border border-primary-100 px-1 py-0.5 rounded font-bold text-navy-950">
                                    {isRtl ? "בטנה: $10" : "Lined: $10"}
                                  </span>
                                </div>
                              </div>

                              {/* QR Code Section */}
                              <div className={`flex flex-col items-center justify-center w-[33%] border-primary-100 ${isRtl ? "order-1 border-r pr-2" : "order-2 border-l pl-2"}`}>
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin + "/track" : "")}`} 
                                  className="w-16 h-16 border border-primary-100 p-0.5 rounded bg-white shadow-sm"
                                  alt="QR Code"
                                />
                                <span className="text-[6px] text-primary-500 font-bold uppercase tracking-wider mt-1 block leading-none">
                                  {isRtl ? "סרוק למעקב" : "Scan to track"}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        </div>

                        {/* Flip Hint */}
                        <button 
                          onClick={() => setIsCardFlipped(!isCardFlipped)}
                          className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary-500 hover:text-navy-900 transition-colors font-medium"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {isRtl ? "לחץ כדי להפוך כרטיס" : "Click to flip card"}
                        </button>
                      </div>

                      {/* Buttons Action */}
                      <div className="flex flex-col gap-3 justify-center max-w-sm mx-auto w-full">
                        <button
                          onClick={() => {
                            const printWindow = window.open("", "_blank");
                            if (!printWindow) return;
                            const origin = typeof window !== "undefined" ? window.location.origin : "";
                            printWindow.document.write(`
                              <!DOCTYPE html>
                              <html>
                                <head>
                                  <title>Shatnez Lab Business Card</title>
                                  <style>
                                    @page { size: 3.5in 2in; margin: 0; }
                                    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page-break { page-break-after: always; } }
                                    body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: #ffffff; }
                                    .card-print { width: 3.5in; height: 2in; box-sizing: border-box; position: relative; overflow: hidden; color: #ffffff; display: flex; flex-direction: column; justify-content: space-between; padding: 0.2in 0.25in; }
                                    .card-front { background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%) !important; border: 4px solid #d4af37 !important; align-items: center; justify-content: center; text-align: center; }
                                    .card-back { background: #ffffff !important; color: #0d1b2a !important; border: 4px solid #1e3a5f !important; display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 0.15in 0.2in; }
                                    .gold-border { position: absolute; inset: 0.05in; border: 1px solid rgba(212, 175, 55, 0.4); pointer-events: none; }
                                    .title-main { font-size: 18px; font-weight: 800; letter-spacing: 1px; color: #ffffff; margin: 0; }
                                    .title-main-gold { color: #d4af37; }
                                    .subtitle { font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: #a0aec0; margin: 4px 0 0 0; }
                                    .info-col { display: flex; flex-direction: column; gap: 4px; max-width: 2.1in; text-align: left; }
                                    .info-col.rtl { text-align: right; }
                                    .info-item { font-size: 8px; display: flex; align-items: center; gap: 5px; color: #4a5568; }
                                    .info-item.rtl { flex-direction: row-reverse; }
                                    .info-item strong { color: #0d1b2a; }
                                    .qr-col { display: flex; flex-direction: column; align-items: center; justify-content: center; }
                                    .qr-code { width: 1.1in; height: 1.1in; border: 1px solid #e2e8f0; padding: 4px; background: white; border-radius: 6px; }
                                    .qr-text { font-size: 6px; color: #718096; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
                                    .prices-row { display: flex; gap: 10px; margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px; }
                                    .price-tag { font-size: 7px; background: #f7fafc; padding: 2px 5px; border-radius: 3px; border: 1px solid #edf2f7; color: #2d3748; font-weight: 600; }
                                  </style>
                                </head>
                                <body>
                                  <!-- FRONT SIDE -->
                                  <div class="card-print card-front">
                                    <div class="gold-border"></div>
                                    <div style="font-size: 24px; color: #d4af37; margin-bottom: 5px;">🔬</div>
                                    <h1 class="title-main">THE SHATNEZ <span class="title-main-gold">LAB</span></h1>
                                    <p class="subtitle" style="color: #ffffff; opacity: 0.9;">
                                      ${isRtl ? "בדיקת שעטנז מקצועית ומוסמכת" : "Professional Shatnez Verification"}
                                    </p>
                                    <div style="margin-top: 15px; font-size: 10px; color: #d4af37; letter-spacing: 1px; font-weight: 600;">
                                      📞 845-552-4744
                                    </div>
                                  </div>
                                  <div class="page-break"></div>
                                  <!-- BACK SIDE -->
                                  <div class="card-print card-back">
                                    <div class="info-col \${isRtl ? "rtl" : ""}">
                                      <div style="font-size: 11px; font-weight: 800; color: #1e3a5f; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; \${isRtl ? "justify-content: flex-end;" : ""}">
                                        <span>🔬</span>
                                        <span>\${isRtl ? "מעבדת השעטנז" : "The Shatnez Lab"}</span>
                                      </div>
                                      <div class="info-item \${isRtl ? "rtl" : ""}"><strong>📞:</strong> <span>845-552-4744</span></div>
                                      <div class="info-item \${isRtl ? "rtl" : ""}"><strong>📍:</strong> <span>14 Buchanan Rd, Spring Valley NY</span></div>
                                      <div class="info-item \${isRtl ? "rtl" : ""}"><strong>🕒:</strong> <span>24/7 Drop-Off & Phone Check</span></div>
                                      <div class="prices-row" style="\${isRtl ? "justify-content: flex-end;" : ""}">
                                        <span class="price-tag">\${isRtl ? "בגד פשוט: $5" : "Simple Garment: $5"}</span>
                                        <span class="price-tag">\${isRtl ? "בגד עם בטנה: $10" : "Lined (Suits/Coats): $10"}</span>
                                      </div>
                                    </div>
                                    <div class="qr-col">
                                      <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=\${encodeURIComponent(origin + "/track")}" alt="QR" />
                                      <span class="qr-text">\${isRtl ? "סרוק למעקב הזמנה" : "Scan to track order"}</span>
                                    </div>
                                  </div>
                                  <script>
                                    setTimeout(() => { window.print(); window.close(); }, 500);
                                  </script>
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                          }}
                          className="btn-primary flex items-center justify-center gap-2 text-xs py-2 shadow w-full"
                        >
                          <Printer className="w-4 h-4" />
                          {isRtl ? "הדפס כרטיס" : "Print Card"}
                        </button>
                        
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            onClick={() => downloadCardSvg("front")}
                            className="bg-navy-900 text-white hover:bg-navy-800 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl border border-navy-700 transition-colors shadow"
                            title={isRtl ? "הורד קובץ וקטורי של הצד הקדמי (אילוסטרייטור)" : "Download Front Vector SVG"}
                          >
                            <Download className="w-3.5 h-3.5" />
                            {isRtl ? "וקטור קדמי" : "Front Vector"}
                          </button>
                          <button
                            onClick={() => downloadCardSvg("back")}
                            className="bg-white text-navy-950 hover:bg-primary-50 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl border border-primary-200 transition-colors shadow"
                            title={isRtl ? "הורד קובץ וקטורי של הצד האחורי (אילוסטרייטור)" : "Download Back Vector SVG"}
                          >
                            <Download className="w-3.5 h-3.5" />
                            {isRtl ? "וקטור אחורי" : "Back Vector"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-primary-100 bg-primary-50/50 flex justify-end">
                <button
                  onClick={() => setShowBlueprintModal(false)}
                  className="btn-primary px-6 py-2"
                >
                  {isRtl ? "סגור מדריך" : "Close Hub"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Dialer Button */}
      <motion.button
        onClick={() => setShowPhoneModal(true)}
        className={`fixed bottom-6 ${isRtl ? "left-6" : "right-6"} z-40 p-4 ${
          activeInboundCall ? "bg-rose-600 hover:bg-rose-700 animate-bounce" : "bg-emerald-600 hover:bg-emerald-700"
        } text-white rounded-full shadow-2xl transition-all duration-200 flex items-center justify-center group border ${
          activeInboundCall ? "border-rose-500" : "border-emerald-500"
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title={isRtl ? "טלפון משרדי וחייגן" : "Office Phone & Dialer"}
      >
        {activeInboundCall ? (
          <PhoneCall className="w-6 h-6 shrink-0 animate-pulse text-white" />
        ) : (
          <Phone className="w-6 h-6 shrink-0" />
        )}
        <span className={`max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-xs whitespace-nowrap ${isRtl ? "mr-0 group-hover:mr-2" : "ml-0 group-hover:ml-2"}`}>
          {isRtl ? "טלפון משרדי" : "Office Phone"}
        </span>
        {voicemails.filter(v => !v.read).length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-white">
            {voicemails.filter(v => !v.read).length}
          </span>
        )}
      </motion.button>

      {/* Floating Toast Notification Container */}
      <div className={`fixed bottom-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none ${isRtl ? "left-4 right-auto text-right" : "right-4 left-auto text-left"}`}>
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-3 backdrop-blur-md ${
                n.type === "success" 
                  ? "bg-emerald-50/95 border-emerald-200 text-emerald-800" 
                  : n.type === "error"
                  ? "bg-rose-50/95 border-rose-200 text-rose-800"
                  : "bg-blue-50/95 border-blue-200 text-blue-800"
              }`}
            >
              {n.type === "success" && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />}
              {n.type === "error" && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />}
              {n.type === "info" && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />}
              <span className="flex-1">{n.message}</span>
              <button 
                onClick={() => setNotifications((prev) => prev.filter((notif) => notif.id !== n.id))}
                className="text-primary-400 hover:text-primary-700 transition-colors text-xs font-bold px-1"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}
