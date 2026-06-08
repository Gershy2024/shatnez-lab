"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, 
  MessageSquare, Volume2, Users, Settings as SettingsIcon, Search, 
  X, ChevronRight, Mic, Clock, ArrowUpRight, ArrowDownLeft, 
  Play, Pause, Trash2, Send, Info, ShieldCheck, AlertCircle, 
  CheckCircle, Keyboard, FileText, Check, Link, Bell, Ban,
  Sun, Moon
} from "lucide-react";
import { 
  Order, CallRecord, Voicemail, SmsMessage, 
  associateCallWithOrder, associateSmsWithOrder, saveAdminSettings, getAdminSettings 
} from "@/lib/db";

interface VirtualPhoneProps {
  orders: Order[];
  calls: CallRecord[];
  voicemails: Voicemail[];
  smsMessages: SmsMessage[];
  forwardingNumber: string;
  twilioPhoneNumber: string;
  isRtl: boolean;
  t: (key: string) => string;
  triggerOutboundCall: (orderId: string, phone: string) => Promise<void>;
  sendSms: (phone: string, message: string) => Promise<boolean>;
  markVoicemailRead: (id: string) => Promise<void>;
  deleteVoicemail: (id: string) => Promise<void>;
  onClose?: () => void;
  dragControls?: any;
}

function formatDuration(durationStr: string | undefined, isRtl: boolean): string {
  if (!durationStr) return "";
  const sec = parseInt(durationStr.replace("s", ""), 10);
  if (isNaN(sec)) return durationStr;

  if (sec < 60) {
    return isRtl ? `${sec} שנ'` : `${sec}s`;
  }
  const mins = Math.floor(sec / 60);
  const remainingSecs = sec % 60;
  if (remainingSecs === 0) {
    return isRtl ? `${mins} דק'` : `${mins}m`;
  }
  return isRtl 
    ? `${mins} דק' ${remainingSecs} שנ'` 
    : `${mins}m ${remainingSecs}s`;
}

type TabType = "calls" | "messages" | "voicemails" | "contacts" | "settings";

export default function VirtualPhone({
  orders,
  calls,
  voicemails,
  smsMessages,
  forwardingNumber,
  twilioPhoneNumber,
  isRtl,
  t,
  triggerOutboundCall,
  sendSms,
  markVoicemailRead,
  deleteVoicemail,
  onClose,
  dragControls
}: VirtualPhoneProps) {
  // Helper for status translation
  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      received: isRtl ? "התקבל" : "Received",
      testing: isRtl ? "בבדיקה" : "Testing",
      review: isRtl ? "בביקורת" : "Review",
      ready: isRtl ? "מוכן לאיסוף" : "Ready for pickup",
      delivered: isRtl ? "נמסר" : "Delivered",
      issue: isRtl ? "דרוש טיפול" : "Needs attention",
    };
    return map[status] || status;
  };

  // Theme State
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("voip-theme") as "light" | "dark" | null;
      if (savedTheme) {
        setTheme(savedTheme);
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("voip-theme", nextTheme);
    }
  };

  // Navigation & Sub-states
  const [activeTab, setActiveTab] = useState<TabType>("calls");
  const [searchQuery, setSearchQuery] = useState("");
  const [callFilter, setCallFilter] = useState<"all" | "inbound" | "outbound" | "missed">("all");
  
  // Selection states
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedThreadPhone, setSelectedThreadPhone] = useState<string | null>(null);
  const [selectedVoicemailId, setSelectedVoicemailId] = useState<string | null>(null);
  const [selectedContactPhone, setSelectedContactPhone] = useState<string | null>(null);
  
  // Dialer & Call state
  const [dialInput, setDialInput] = useState("");
  const [showDialpad, setShowDialpad] = useState(true);
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected">("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [callMethod, setCallMethod] = useState<"browser" | "phone">("phone");
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const deviceRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  
  // SMS chat state
  const [smsInput, setSmsInput] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  // DND & Settings state
  const [dndActive, setDndActive] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // CRM Link states
  const [isLinkingOrder, setIsLinkingOrder] = useState<string | null>(null);
  const [linkingType, setLinkingType] = useState<"call" | "sms" | null>(null);

  // Audio Playback
  const [playingVmId, setPlayingVmId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Initialize notifications & DND state from settings, and dynamically load Twilio SDK
  useEffect(() => {
    getAdminSettings().then(settings => {
      setDndActive(!!settings.dndActive);
    });

    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }

    // Load Twilio Voice WebRTC SDK script from local public static folder (avoids CORS and Kosher web filter blocks)
    if (typeof window !== "undefined" && !(window as any).Twilio) {
      const existingScript = document.querySelector('script[src*="twilio.js"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "/twilio.js";
        script.async = true;
        script.onload = () => {
          console.log("Twilio Voice SDK loaded successfully.");
        };
        document.body.appendChild(script);
      }
    }
  }, []);

  // Clean up device on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch (e) {
          console.error("Error destroying Twilio device:", e);
        }
        deviceRef.current = null;
      }
    };
  }, []);

  // Request notification permissions
  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
    }
  };

  // Browser Notification Trigger
  const triggerBrowserNotification = (title: string, body: string) => {
    if (notificationsEnabled && typeof window !== "undefined") {
      new Notification(title, { body, icon: "/icon.svg" });
    }
  };

  // Listen for new SMS/Voicemail changes to fire notifications
  const prevSmsLengthRef = useRef(smsMessages.length);
  const prevVmLengthRef = useRef(voicemails.length);
  
  useEffect(() => {
    if (smsMessages.length > prevSmsLengthRef.current) {
      const latest = smsMessages[smsMessages.length - 1];
      if (latest && latest.direction === "inbound") {
        const contactName = orders.find(o => o.phone?.replace(/\D/g, "") === latest.phone.replace(/\D/g, ""))?.customerName || latest.phone;
        triggerBrowserNotification(
          isRtl ? `הודעה חדשה מ-${contactName}` : `New message from ${contactName}`,
          latest.body
        );
      }
    }
    prevSmsLengthRef.current = smsMessages.length;
  }, [smsMessages, orders, isRtl]);

  useEffect(() => {
    if (voicemails.length > prevVmLengthRef.current) {
      const latest = voicemails[0];
      if (latest) {
        const contactName = orders.find(o => o.phone?.replace(/\D/g, "") === latest.phone.replace(/\D/g, ""))?.customerName || latest.phone;
        triggerBrowserNotification(
          isRtl ? "תא קולי חדש התקבל" : "New Voicemail Received",
          isRtl ? `הודעה מ-${contactName} (אורך: ${latest.duration} שניות)` : `Message from ${contactName} (${latest.duration}s)`
        );
      }
    }
    prevVmLengthRef.current = voicemails.length;
  }, [voicemails, orders, isRtl]);

  // Handle active call timers
  useEffect(() => {
    if (callState === "connected") {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [smsMessages, selectedThreadPhone]);

  // Keyboard layout support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if target is input, to prevent double entries if focused
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const key = e.key;

      if (callState === "connected") {
        if (/^[0-9*#]$/.test(key)) {
          handleDialpadClick(key);
        }
        return;
      }

      if (activeTab !== "calls" || !showDialpad || callState !== "idle") return;
      
      if (/^[0-9*#]$/.test(key)) {
        setDialInput(prev => prev + key);
        playTone();
      } else if (key === "Backspace") {
        setDialInput(prev => prev.slice(0, -1));
      } else if (key === "Enter") {
        handleTriggerCall();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, showDialpad, callState, dialInput]);

  // Plays a subtle tone on dialpad click
  const playTone = () => {
    try {
      if (typeof window !== "undefined") {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 frequency
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      }
    } catch (e) {
      // Audio context block browser protection fallback
    }
  };

  const handleDialpadClick = (val: string) => {
    if (callState === "connected" && activeCallRef.current) {
      try {
        console.log("Sending DTMF digit to Twilio WebRTC call:", val);
        activeCallRef.current.sendDigits(val);
      } catch (err) {
        console.error("Error sending DTMF digit:", err);
      }
    } else {
      setDialInput(prev => prev + val);
    }
    playTone();
  };

  const toggleDnd = async () => {
    const nextVal = !dndActive;
    setDndActive(nextVal);
    try {
      const current = await getAdminSettings();
      await saveAdminSettings({
        ...current,
        dndActive: nextVal
      });
    } catch (err) {
      console.error("Failed to update DND setting:", err);
    }
  };

  // Find CRM match for dialing / receiving
  const getCrmMatch = (phoneStr: string) => {
    if (!phoneStr) return null;
    const cleanNum = phoneStr.replace(/\D/g, "");
    if (cleanNum.length < 7) return null;
    
    // Look up order in database
    return orders.find(o => {
      const oPhone = o.phone ? o.phone.replace(/\D/g, "") : "";
      if (oPhone.length < 7) return false;
      return oPhone.includes(cleanNum) || cleanNum.includes(oPhone);
    }) || null;
  };

  const initBrowserDevice = async (token: string) => {
    if (typeof window === "undefined" || !(window as any).Twilio) {
      alert(isRtl ? "ספריית Twilio Voice נטענת כעת. אנא המתן מספר שניות ונסה שוב." : "Twilio Voice library is loading. Please try again in a few seconds.");
      return null;
    }

    try {
      const Device = (window as any).Twilio.Device || ((window as any).Twilio.Voice && (window as any).Twilio.Voice.Device);
      if (!Device) {
        throw new Error("Twilio.Device is not defined on the window object.");
      }
      const dev = new Device(token, {
        logLevel: "debug",
        codecPreferences: ["opus", "pcmu"],
        edge: "ashburn"
      });

      dev.on("error", (error: any) => {
        console.error("Twilio Voice Device Error:", error);
        setCallState("idle");
      });

      deviceRef.current = dev;
      return dev;
    } catch (err) {
      console.error("Failed to initialize Twilio Device:", err);
      return null;
    }
  };

  const handleBrowserCall = async () => {
    if (!dialInput.trim()) return;
    setCallState("dialing");

    try {
      // 1. Fetch token from endpoint
      const res = await fetch("/api/twilio/token", { method: "POST" });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to generate Twilio voice token: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      const token = data.token;

      // 2. Init device
      let dev = deviceRef.current;
      if (!dev) {
        dev = await initBrowserDevice(token);
      }

      if (!dev) {
        setCallState("idle");
        alert(isRtl ? "שגיאה באתחול המכשיר בדפדפן" : "Failed to initialize WebRTC device");
        return;
      }

      // 3. Connect outbound WebRTC call
      console.log(`Connecting WebRTC call to: ${dialInput}`);
      const call = await dev.connect({
        params: {
          To: dialInput
        }
      });

      activeCallRef.current = call;

      call.on("accept", () => {
        console.log("WebRTC Call Accepted.");
        setCallState("connected");
      });

      call.on("disconnect", () => {
        console.log("WebRTC Call Disconnected.");
        setCallState("idle");
        activeCallRef.current = null;
      });

      call.on("reject", () => {
        console.log("WebRTC Call Rejected.");
        setCallState("idle");
        activeCallRef.current = null;
      });

    } catch (err: any) {
      console.error("WebRTC calling error:", err);
      alert(isRtl ? `שגיאה בחיבור השיחה: ${err.message}` : `WebRTC call error: ${err.message}`);
      setCallState("idle");
    }
  };

  const handleTriggerCall = async () => {
    if (!dialInput.trim()) return;

    if (callMethod === "browser") {
      await handleBrowserCall();
    } else {
      if (!forwardingNumber) {
        alert(isRtl ? "אנא הגדר מספר העברה תחילה בהגדרות" : "Please configure forwarding number in settings first");
        return;
      }
      
      setCallState("dialing");
      
      // Bridge CRM order id if match exists
      const match = getCrmMatch(dialInput);
      const orderId = match ? match.id : "";
      
      try {
        await triggerOutboundCall(orderId, dialInput);
        setCallState("connected");
      } catch (e) {
        console.error(e);
        setCallState("idle");
        alert(isRtl ? "שגיאה בהוצאת שיחה" : "Failed to initiate bridge call");
      }
    }
  };

  const handleHangUp = () => {
    if (callMethod === "browser") {
      if (activeCallRef.current) {
        activeCallRef.current.disconnect();
      } else if (deviceRef.current) {
        try {
          deviceRef.current.disconnectAll();
        } catch (e) {}
      }
      activeCallRef.current = null;
    }
    setCallState("idle");
    setDialInput("");
  };

  // Sending SMS chat message
  const handleSendSmsChat = async () => {
    if (!smsInput.trim() || !selectedThreadPhone) return;
    setSendingSms(true);
    try {
      const success = await sendSms(selectedThreadPhone, smsInput);
      if (success) {
        setSmsInput("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingSms(false);
    }
  };

  const handlePlayVoicemail = (vm: Voicemail) => {
    const url = `/api/audio?url=${encodeURIComponent(vm.url)}&t=${Date.now()}`;
    
    if (playingVmId === vm.id && audioElement) {
      audioElement.pause();
      setPlayingVmId(null);
      setAudioElement(null);
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      const audio = new Audio(url);
      audio.play().catch(e => console.error("Playback failed", e));
      audio.onended = () => {
        setPlayingVmId(null);
        setAudioElement(null);
      };
      setAudioElement(audio);
      setPlayingVmId(vm.id);
      if (!vm.read) {
        markVoicemailRead(vm.id);
      }
    }
  };

  // Clean up audio playback on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  // Associate Call / SMS to order
  const handleLinkOrderConfirm = async (orderId: string) => {
    if (!isLinkingOrder) return;
    try {
      if (linkingType === "call") {
        await associateCallWithOrder(isLinkingOrder, orderId);
      } else if (linkingType === "sms") {
        await associateSmsWithOrder(isLinkingOrder, orderId);
      }
      setIsLinkingOrder(null);
      setLinkingType(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Quick SMS Templates
  const smsTemplates = [
    { title: isRtl ? "נקי משעטנז" : "Clean", text: "שלום, הבגד שלך נבדק במעבדה ונמצא נקי משעטנז ומאושר ללבישה." },
    { title: isRtl ? "מוכן לאיסוף" : "Ready", text: "שלום, ההזמנה שלך מוכנה לאיסוף במעבדת שעטנז, ביוקנן 14. תודה!" },
    { title: isRtl ? "נמצא שעטנז" : "Shatnez Found", text: "שלום, בבדיקת הבגד שלך נמצא שעטנז. נא ליצור איתנו קשר לפרטים נוספים." }
  ];

  // Group SMS Messages by Phone number for Thread View
  const getSmsThreads = () => {
    const threads: Record<string, { lastMsg: SmsMessage; unreadCount: number }> = {};
    smsMessages.forEach(msg => {
      const cleanPhone = msg.phone.replace(/\D/g, "");
      if (!threads[cleanPhone] || threads[cleanPhone].lastMsg.timestamp < msg.timestamp) {
        threads[cleanPhone] = {
          lastMsg: msg,
          unreadCount: 0 // Placeholder
        };
      }
    });

    return Object.values(threads).sort((a, b) => b.lastMsg.timestamp - a.lastMsg.timestamp);
  };

  // Extract unique contacts from Orders database
  const getUniqueContacts = () => {
    const list: Record<string, { name: string; phone: string; orders: Order[] }> = {};
    orders.forEach(o => {
      if (!o.phone) return;
      const cleanPhone = o.phone.replace(/\D/g, "");
      if (!list[cleanPhone]) {
        list[cleanPhone] = {
          name: o.customerName,
          phone: o.phone,
          orders: [o]
        };
      } else {
        if (!list[cleanPhone].orders.some(x => x.id === o.id)) {
          list[cleanPhone].orders.push(o);
        }
      }
    });
    return Object.values(list).sort((a, b) => a.name.localeCompare(b.name));
  };

  // Filtering Logic
  const getFilteredCalls = () => {
    return calls.filter(c => {
      const matchesSearch = c.phone.includes(searchQuery) || 
                            c.actions.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (getCrmMatch(c.phone)?.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const isOutbound = c.direction === "outbound" || c.actions.some(act => act.toLowerCase().includes("outbound"));
      const isMissed = c.status === "voicemail" || c.actions.some(act => act.toLowerCase().includes("voicemail"));
      
      if (!matchesSearch) return false;
      if (callFilter === "inbound") return !isOutbound;
      if (callFilter === "outbound") return isOutbound;
      if (callFilter === "missed") return isMissed;
      return true;
    });
  };

  // Format Duration string
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getRelativeTime = (timestamp: number) => {
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
  };

  // Check if there is an active inbound call right now (for UI alert / popup)
  const activeInboundCall = calls.find(c => c.status === "active" && Date.now() - c.timestamp < 90000 && c.direction !== "outbound");

  return (
    <div className={`w-full max-w-6xl mx-auto rounded-3xl overflow-hidden flex flex-col h-[700px] font-sans transition-colors duration-300 border ${
      theme === "dark"
        ? "bg-[#0d1b2a] text-slate-100 border border-slate-800/80 shadow-2xl"
        : "bg-white text-slate-850 border border-slate-200 shadow-2xl"
    } ${isRtl ? "direction-rtl" : "direction-ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      
      {/* 1. App Header Window bar */}
      <div 
        onPointerDown={(e) => {
          if (dragControls) {
            dragControls.start(e);
          }
        }}
        className={`px-5 py-3.5 flex items-center justify-between border-b shrink-0 transition-colors duration-300 cursor-grab active:cursor-grabbing ${
          theme === "dark" ? "bg-[#0b132b] border-slate-900/60" : "bg-slate-100 border-slate-200"
        }`}
      >
        {/* macOS Window Controls Mockup */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onClose ? (
            <button
              onClick={onClose}
              className={`w-3 h-3 rounded-full transition-colors focus:outline-none flex items-center justify-center text-[8px] font-bold group ${
                theme === "dark" ? "bg-rose-500/85 hover:bg-rose-600 text-[#0d1b2a]" : "bg-rose-500/85 hover:bg-rose-600 text-white"
              }`}
              title={isRtl ? "סגור" : "Close"}
            >
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">✕</span>
            </button>
          ) : (
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          )}
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className={`text-xs font-bold ml-2 font-mono tracking-wider transition-colors duration-300 ${
            theme === "dark" ? "text-slate-400" : "text-slate-500"
          }`}>SHATNEZ LAB VoIP v1.2</span>
        </div>

        {/* Browser Notification request indicator */}
        <div className="flex items-center gap-4">
          {!notificationsEnabled && (
            <button 
              onClick={requestNotificationPermission} 
              className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full hover:bg-amber-500/20 transition-all font-semibold"
            >
              <Bell className="w-3 h-3 animate-bounce" />
              {isRtl ? "אפשר התראות" : "Enable Alerts"}
            </button>
          )}

          {/* Connected Lines status */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`text-xs font-bold font-mono transition-colors duration-300 ${
              theme === "dark" ? "text-slate-400" : "text-slate-500"
            }`}>TWILIO LINE CONNECTED</span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-all border flex items-center justify-center shrink-0 ${
                theme === "dark"
                  ? "bg-slate-800/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border-slate-700/50"
                  : "bg-slate-200/60 hover:bg-rose-100 text-slate-650 hover:text-rose-655 border-slate-300"
              }`}
              title={isRtl ? "סגור טלפון" : "Close Phone"}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Client Workspace Grid */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        
        {/* SIDE 1: LEFT NAVIGATION SIDEBAR (Icon & Badges) */}
        <div className={`w-16 sm:w-20 border-r flex flex-col items-center py-6 justify-between shrink-0 transition-colors duration-300 ${
          theme === "dark" ? "bg-[#0f172a] border-slate-900" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex flex-col items-center gap-6 w-full">
            {/* Logo */}
            <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center shadow-lg shadow-gold-500/10 border border-gold-400/20 mb-4">
              <PhoneCall className="w-5 h-5 text-[#0d1b2a]" />
            </div>

            {/* Menu Items */}
            {[
              { id: "calls", icon: Phone, labelHe: "שיחות", labelEn: "Calls", badge: 0 },
              { id: "messages", icon: MessageSquare, labelHe: "הודעות", labelEn: "Messages", badge: 0 },
              { 
                id: "voicemails", 
                icon: Volume2, 
                labelHe: "תא קולי", 
                labelEn: "Voicemail", 
                badge: voicemails.filter(v => !v.read).length 
              },
              { id: "contacts", icon: Users, labelHe: "אנשי קשר", labelEn: "Contacts", badge: 0 },
              { id: "settings", icon: SettingsIcon, labelHe: "הגדרות", labelEn: "Settings", badge: 0 }
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as TabType);
                    if (item.id === "calls") setShowDialpad(true);
                  }}
                  className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center relative transition-all duration-200 group ${
                    isActive 
                      ? (theme === "dark" ? "bg-slate-800 text-gold-400 shadow-inner" : "bg-slate-200 text-gold-600 shadow-inner") 
                      : (theme === "dark" ? "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")
                  }`}
                  title={isRtl ? item.labelHe : item.labelEn}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-[10.5px] font-bold mt-1 text-center leading-none">{isRtl ? item.labelHe : item.labelEn}</span>
                  {item.badge > 0 && (
                    <span className={`absolute top-1 right-1 bg-rose-500 text-white font-black text-[10.5px] w-5.5 h-5.5 rounded-full flex items-center justify-center shadow animate-pulse scale-90 border ${
                      theme === "dark" ? "border-[#0f172a]" : "border-slate-50"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Theme & DND switch buttons at bottom */}
          <div className="flex flex-col items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border ${
                theme === "dark"
                  ? "bg-slate-800/50 text-amber-400 border-slate-700/50 hover:text-amber-300"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 shadow-sm"
              }`}
              title={isRtl ? (theme === "dark" ? "מראה בהיר" : "מראה כהה") : (theme === "dark" ? "Light Mode" : "Dark Mode")}
            >
              {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={toggleDnd}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border ${
                  dndActive 
                    ? "bg-rose-500/20 text-rose-500 border-rose-500/30 animate-pulse" 
                    : (theme === "dark" ? "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200" : "bg-white text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-slate-100 shadow-sm")
                }`}
                title={dndActive ? (isRtl ? "מצב נא לא להפריע פעיל" : "Do Not Disturb Active") : (isRtl ? "זמין לשיחות" : "Available for calls")}
              >
                <Ban className="w-4 h-4" />
              </button>
              <span className={`text-xs font-black tracking-wider transition-colors duration-300 ${
                theme === "dark" ? "text-slate-500" : "text-slate-400"
              }`}>
                {dndActive ? (isRtl ? "נא לא להפריע" : "DND") : (isRtl ? "זמין" : "ONLINE")}
              </span>
            </div>
          </div>
        </div>

        {/* SIDE 2: MIDDLE LIST COLUMN */}
        <div className={`w-72 sm:w-80 border-r flex flex-col shrink-0 transition-colors duration-300 ${
          theme === "dark" ? "bg-[#121f35]/90 border-slate-900" : "bg-[#f8fafc] border-slate-200"
        }`}>
          
          {/* Header search bar */}
          <div className={`p-4 border-b space-y-3 shrink-0 transition-colors duration-300 ${
            theme === "dark" ? "border-slate-900/60" : "border-slate-200"
          }`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-sm font-bold uppercase tracking-wider transition-colors duration-300 ${
                theme === "dark" ? "text-slate-300" : "text-slate-700"
              }`}>
                {activeTab === "calls" && (isRtl ? "יומן שיחות" : "Call Logs")}
                {activeTab === "messages" && (isRtl ? "שיחות SMS" : "SMS Chats")}
                {activeTab === "voicemails" && (isRtl ? "תא קולי" : "Voicemail Inbox")}
                {activeTab === "contacts" && (isRtl ? "אנשי קשר (לקוחות)" : "Contacts (CRM)")}
                {activeTab === "settings" && (isRtl ? "הגדרות טלפון" : "Settings")}
              </h2>

              {activeTab === "calls" && (
                <button
                  onClick={() => setShowDialpad(true)}
                  className="bg-gold-500/10 hover:bg-gold-500/25 border border-gold-500/20 text-gold-400 text-xs font-bold px-2 py-0.5 rounded-md transition-all flex items-center gap-1"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  {isRtl ? "חייגן" : "Dialpad"}
                </button>
              )}
            </div>

            {activeTab !== "settings" && (
              <div className="relative">
                <Search className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? "חיפוש ביומן..." : "Search..."}
                  className={`w-full text-xs rounded-xl py-2 ${
                    isRtl ? "pr-9 pl-3 text-right" : "pl-9 pr-3 text-left"
                  } focus:outline-none transition-all duration-300 ${
                    theme === "dark"
                      ? "bg-slate-950/40 border border-slate-800/80 text-slate-100 placeholder-slate-500 focus:border-slate-700 focus:ring-1 focus:ring-slate-700"
                      : "bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-slate-300 focus:ring-1 focus:ring-slate-300 shadow-sm"
                  }`}
                />
              </div>
            )}

            {/* Quick Filters for Calls */}
            {activeTab === "calls" && (
              <div className={`flex gap-1 p-1 rounded-lg text-xs font-bold transition-all duration-300 border ${
                theme === "dark" 
                  ? "bg-slate-950/20 border-slate-800/20 text-slate-400" 
                  : "bg-slate-200/50 border-slate-300/50 text-slate-500"
              }`}>
                {(["all", "inbound", "outbound", "missed"] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setCallFilter(filter)}
                    className={`flex-1 py-1 rounded transition-colors ${
                      callFilter === filter 
                        ? (theme === "dark" ? "bg-slate-800 text-gold-400 shadow-inner" : "bg-white text-gold-600 shadow-sm border border-slate-200/50") 
                        : (theme === "dark" ? "hover:text-slate-200" : "hover:text-slate-850")
                    }`}
                  >
                    {filter === "all" && (isRtl ? "הכל" : "All")}
                    {filter === "inbound" && (isRtl ? "נכנסות" : "Inbound")}
                    {filter === "outbound" && (isRtl ? "יוצאות" : "Outbound")}
                    {filter === "missed" && (isRtl ? "שלא נענו" : "Missed")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            
            {/* TAB: CALLS LIST */}
            {activeTab === "calls" && (
              <>
                {getFilteredCalls().map(c => {
                  const isSelected = selectedCallId === c.id;
                  const isOutbound = c.direction === "outbound" || c.actions.some(act => act.toLowerCase().includes("outbound"));
                  const isMissed = c.status === "voicemail" || c.actions.some(act => act.toLowerCase().includes("voicemail"));
                  const isLive = c.status === "active" && Date.now() - c.timestamp < 120000;
                  
                  // Match contact in CRM
                  const crmMatch = getCrmMatch(c.phone);

                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCallId(c.id);
                          setShowDialpad(false);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer select-none relative transition-all duration-150 ${
                          isSelected 
                            ? (theme === "dark" ? "bg-slate-800 border-slate-900 shadow text-white" : "bg-slate-200 border-slate-300 shadow text-slate-950") 
                            : (theme === "dark" ? "bg-slate-900/40 border-slate-800/40 hover:bg-slate-900/80 hover:border-slate-800" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-350 shadow-sm")
                        }`}
                      >
                        <div className="flex flex-col gap-2">
                          {/* First Row: Caller info and call stats */}
                          <div className={`flex items-start justify-between gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                            <div className={`flex items-center gap-2 overflow-hidden ${isRtl ? "flex-row-reverse" : ""}`}>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isLive 
                                  ? "bg-blue-500/10 border border-blue-500/20 text-blue-400 animate-pulse" 
                                  : isMissed 
                                    ? "bg-rose-500/10 border border-rose-500/20 text-rose-400" 
                                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                              }`}>
                                {isLive ? (
                                  <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
                                ) : isMissed ? (
                                  <PhoneMissed className="w-3.5 h-3.5" />
                                ) : isOutbound ? (
                                  <PhoneOutgoing className="w-3.5 h-3.5" />
                                ) : (
                                  <PhoneIncoming className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div className={`overflow-hidden ${isRtl ? "text-right" : "text-left"}`}>
                                <div className={`text-xs font-bold block truncate transition-colors duration-300 ${
                                  theme === "dark" ? "text-slate-100" : "text-slate-800"
                                }`}>
                                  {crmMatch ? crmMatch.customerName : (isRtl ? "מתקשר אלחוטי" : "Wireless Caller")}
                                </div>
                                <div className={`text-xs font-mono mt-0.5 block truncate transition-colors duration-300 ${
                                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                                }`}>{c.phone}</div>
                              </div>
                            </div>

                            <div className={`text-right flex flex-col items-end shrink-0 ${isRtl ? "items-start" : "items-end"}`}>
                              <span className={`text-[11px] font-mono transition-colors duration-300 ${
                                theme === "dark" ? "text-slate-400" : "text-slate-500"
                              }`}>{getRelativeTime(c.timestamp)}</span>
                              {c.duration && (
                                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono mt-1 ${
                                  theme === "dark" ? "bg-slate-950/40 text-slate-400" : "bg-slate-200 text-slate-650"
                                }`}>
                                  {formatDuration(c.duration, isRtl)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Second Row: Order Badge (Full Width, Aligns with text, wraps cleanly) */}
                          {crmMatch && (
                            <div className={`flex ${isRtl ? "justify-start pr-10" : "justify-end pl-10"}`}>
                              <span className={`text-[10px] sm:text-[10.5px] font-semibold uppercase text-gold-500 bg-gold-500/10 border border-gold-500/20 px-2 py-0.5 rounded-lg whitespace-normal leading-tight shadow-sm`}>
                                #{crmMatch.id} ({translateStatus(crmMatch.status)})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {getFilteredCalls().length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    {isRtl ? "לא נמצאו שיחות תואמות" : "No matching calls found"}
                  </div>
                )}
              </>
            )}

            {/* TAB: MESSAGES LIST */}
            {activeTab === "messages" && (
              <>
                {getSmsThreads()
                  .filter(t => t.lastMsg.phone.includes(searchQuery) || (getCrmMatch(t.lastMsg.phone)?.customerName.toLowerCase().includes(searchQuery.toLowerCase())))
                  .map(thread => {
                    const cleanPhone = thread.lastMsg.phone.replace(/\D/g, "");
                    const isSelected = selectedThreadPhone === cleanPhone;
                    const crmMatch = getCrmMatch(thread.lastMsg.phone);

                    return (
                      <div
                        key={cleanPhone}
                        onClick={() => setSelectedThreadPhone(cleanPhone)}
                        className={`p-3 rounded-xl border cursor-pointer select-none relative transition-all duration-150 ${
                          isSelected 
                            ? (theme === "dark" ? "bg-slate-800 border-slate-900 shadow text-white" : "bg-slate-200 border-slate-300 shadow text-slate-950") 
                            : (theme === "dark" ? "bg-slate-900/40 border-slate-800/40 hover:bg-slate-900/80 hover:border-slate-800" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-350 shadow-sm")
                        }`}
                      >
                        <div className={`flex items-start justify-between gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                          <div className={`flex items-center gap-2 overflow-hidden ${isRtl ? "flex-row-reverse" : ""}`}>
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div className={`overflow-hidden ${isRtl ? "text-right" : "text-left"}`}>
                              <span className={`text-xs font-bold block truncate transition-colors duration-300 ${
                                theme === "dark" ? "text-slate-100" : "text-slate-800"
                              }`}>
                                {crmMatch ? crmMatch.customerName : thread.lastMsg.phone}
                              </span>
                              <span className={`text-xs truncate block mt-0.5 transition-colors duration-300 ${
                                theme === "dark" ? "text-slate-400" : "text-slate-500"
                              }`}>
                                {thread.lastMsg.body}
                              </span>
                            </div>
                          </div>

                          <div className={`text-right flex flex-col items-end shrink-0 ${isRtl ? "items-start" : "items-end"}`}>
                            <span className={`text-xs font-mono transition-colors duration-300 ${
                              theme === "dark" ? "text-slate-400" : "text-slate-500"
                            }`}>{getRelativeTime(thread.lastMsg.timestamp)}</span>
                            {crmMatch && (
                              <span className="text-xs font-semibold uppercase text-gold-500 tracking-wide mt-1">
                                #{crmMatch.id}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {getSmsThreads().length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    {isRtl ? "אין הודעות צ'אט" : "No SMS chats available"}
                  </div>
                )}
              </>
            )}

            {/* TAB: VOICEMAILS LIST */}
            {activeTab === "voicemails" && (
              <>
                {voicemails
                  .filter(v => v.phone.includes(searchQuery) || (getCrmMatch(v.phone)?.customerName.toLowerCase().includes(searchQuery.toLowerCase())))
                  .map(vm => {
                    const isSelected = selectedVoicemailId === vm.id;
                    const crmMatch = getCrmMatch(vm.phone);
                    
                    return (
                      <div
                        key={vm.id}
                        onClick={() => setSelectedVoicemailId(vm.id)}
                        className={`p-3 rounded-xl border cursor-pointer select-none relative transition-all duration-150 ${
                          isSelected 
                            ? (theme === "dark" ? "bg-slate-800 border-slate-900 shadow text-white" : "bg-slate-200 border-slate-300 shadow text-slate-950") 
                            : (theme === "dark" ? "bg-slate-900/40 border-slate-800/40 hover:bg-slate-900/80 hover:border-slate-800" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-350 shadow-sm")
                        } ${!vm.read ? "border-amber-500 bg-amber-500/5 hover:bg-amber-500/10" : ""}`}
                      >
                        <div className={`flex items-start justify-between gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                          <div className={`flex items-center gap-2 overflow-hidden ${isRtl ? "flex-row-reverse" : ""}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              playingVmId === vm.id 
                                ? "bg-amber-500 text-slate-950 animate-pulse" 
                                : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                            }`}>
                              <Volume2 className="w-3.5 h-3.5" />
                            </div>
                            <div className={`overflow-hidden ${isRtl ? "text-right" : "text-left"}`}>
                              <span className={`text-xs font-bold block truncate flex items-center gap-1.5 transition-colors duration-300 ${
                                theme === "dark" ? "text-slate-100" : "text-slate-800"
                              }`}>
                                {crmMatch ? crmMatch.customerName : vm.phone}
                                {!vm.read && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 inline-block animate-ping" />
                                )}
                              </span>
                              <span className={`text-xs block mt-0.5 transition-colors duration-300 ${
                                theme === "dark" ? "text-slate-400" : "text-slate-500"
                              }`}>
                                {isRtl ? "הודעה מוקלטת" : "Voicemail recording"}
                              </span>
                            </div>
                          </div>

                          <div className={`text-right flex flex-col items-end shrink-0 ${isRtl ? "items-start" : "items-end"}`}>
                            <span className={`text-xs font-mono transition-colors duration-300 ${
                              theme === "dark" ? "text-slate-400" : "text-slate-500"
                            }`}>{getRelativeTime(vm.timestamp)}</span>
                            <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded mt-1 shrink-0 ${
                              theme === "dark" ? "bg-slate-950/40 text-slate-400" : "bg-slate-200 text-slate-650"
                            }`}>
                              {formatDuration(vm.duration + "s", isRtl)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {voicemails.length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    {isRtl ? "אין הודעות קוליות" : "No voicemails found"}
                  </div>
                )}
              </>
            )}

            {/* TAB: CONTACTS LIST */}
            {activeTab === "contacts" && (
              <>
                {getUniqueContacts()
                  .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery))
                  .map(contact => {
                    const isSelected = selectedContactPhone === contact.phone.replace(/\D/g, "");
                    return (
                      <div
                        key={contact.phone}
                        onClick={() => setSelectedContactPhone(contact.phone.replace(/\D/g, ""))}
                        className={`p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 ${
                          isSelected 
                            ? (theme === "dark" ? "bg-slate-800 border-slate-900 shadow text-white" : "bg-slate-200 border-slate-300 shadow text-slate-950") 
                            : (theme === "dark" ? "bg-slate-900/40 border-slate-800/40 hover:bg-slate-900/80 hover:border-slate-800" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-350 shadow-sm")
                        }`}
                      >
                        <div className={`flex items-center gap-2.5 ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}>
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-black text-xs ${
                            theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-250 border-slate-300 text-slate-700"
                          }`}>
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={`text-xs font-bold transition-colors duration-300 ${
                              theme === "dark" ? "text-slate-100" : "text-slate-800"
                            }`}>{contact.name}</div>
                            <div className={`text-xs font-mono mt-0.5 transition-colors duration-300 ${
                              theme === "dark" ? "text-slate-400" : "text-slate-500"
                            }`}>{contact.phone}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}

          </div>
        </div>

        {/* SIDE 3: RIGHT ACTION COLUMN (DIALER OR DETAILS) */}
        <div className={`flex-1 flex flex-col min-h-0 overflow-hidden relative transition-colors duration-300 ${
          theme === "dark" ? "bg-[#0b132b]/50" : "bg-slate-50/50"
        }`}>
          
          {/* Active Incoming Call Popup Banner (HTML5 overlay mockup) */}
          {activeInboundCall && (
            <div className="absolute top-4 left-4 right-4 z-40 bg-[#162545] border border-amber-500/40 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center animate-bounce">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-400 uppercase tracking-widest">{isRtl ? "שיחה נכנסת פעילה!" : "LIVE INCOMING CALL!"}</div>
                  <div className="text-sm font-bold text-white font-mono mt-0.5">{activeInboundCall.phone}</div>
                  {(() => {
                    const crmMatch = getCrmMatch(activeInboundCall.phone);
                    return crmMatch && (
                      <div className="text-xs text-slate-300 font-semibold mt-0.5">
                        {isRtl ? "לקוח:" : "CRM Name:"} {crmMatch.customerName} | {isRtl ? "הזמנה" : "Order"} #{crmMatch.id} ({translateStatus(crmMatch.status)})
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex gap-2">
                <a 
                  href={`tel:${activeInboundCall.phone}`} 
                  className="bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition-all flex items-center gap-1 shadow"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {isRtl ? "ענה בטלפון" : "Answer Mobile"}
                </a>
              </div>
            </div>
          )}

          {/* 3A: VIEW FOR DIALPAD */}
          {activeTab === "calls" && showDialpad && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4 overflow-y-auto">
              
              {callState === "idle" ? (
                /* Dialer Mode (Soft Minimalism Style matching the user's screenshot) */
                <div className="max-w-[260px] sm:max-w-[285px] w-full flex flex-col space-y-4">
                  
                  {/* Flat Input Bar (To: Type a name or a phone number) */}
                  <div className={`flex items-center gap-2 border-b pb-2.5 transition-colors duration-300 ${
                    theme === "dark" ? "border-slate-800" : "border-slate-200"
                  }`}>
                    <span className={`text-sm font-bold tracking-wide shrink-0 transition-colors duration-300 ${
                      theme === "dark" ? "text-slate-400" : "text-slate-500"
                    }`}>
                      {isRtl ? "אל:" : "To:"}
                    </span>
                    <input
                      type="text"
                      value={dialInput}
                      onChange={(e) => setDialInput(e.target.value.replace(/[^0-9*#]/g, ""))}
                      placeholder={isRtl ? "הקלד שם או מספר טלפון..." : "Type a name or a phone number"}
                      className={`flex-1 text-sm sm:text-base font-semibold tracking-wide bg-transparent focus:outline-none transition-all duration-300 ${
                        theme === "dark" ? "text-slate-100 placeholder-slate-700" : "text-slate-800 placeholder-slate-400"
                      }`}
                    />
                    {dialInput && (
                      <button
                        onClick={() => setDialInput("")}
                        className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/20 rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* CRM Active Search Match Display */}
                  <div className="h-6 text-center flex items-center justify-center px-2">
                    {dialInput && (() => {
                      const match = getCrmMatch(dialInput);
                      if (match) {
                        return (
                          <div className="text-[11px] bg-gold-500/10 border border-gold-500/20 text-gold-400 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow animate-fade-in">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{match.customerName} (#{match.id})</span>
                          </div>
                        );
                      }
                      return <span className={`text-[11px] transition-colors duration-300 ${
                        theme === "dark" ? "text-slate-505" : "text-slate-400"
                      }`}>{isRtl ? "לא נמצאה התאמה ב-CRM" : "No CRM match found"}</span>;
                    })()}
                  </div>

                  {/* Outbound Method Dropdown Toggle Selector (Call From: Default ▾ Style) */}
                  <div className="flex justify-center items-center gap-1.5 text-xs font-semibold select-none text-slate-500">
                    <span>{isRtl ? "חיוג באמצעות:" : "Call From:"}</span>
                    <button
                      onClick={() => setCallMethod(callMethod === "phone" ? "browser" : "phone")}
                      className={`font-black hover:text-gold-500 flex items-center gap-1 transition-all ${
                        theme === "dark" ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      <span>{callMethod === "phone" ? (isRtl ? "טלפון (Bridge)" : "Phone (Bridge)") : (isRtl ? "דפדפן (PC)" : "Browser (PC)")}</span>
                      <span className="text-[10px] text-slate-400">▼</span>
                    </button>
                  </div>

                  {/* Circular Button keypad (Soft Minimalism, Borderless Circles) */}
                  <div className="grid grid-cols-3 gap-2.5 py-1">
                    {[
                      { num: "1", sub: "" },
                      { num: "2", sub: "A B C" },
                      { num: "3", sub: "D E F" },
                      { num: "4", sub: "G H I" },
                      { num: "5", sub: "J K L" },
                      { num: "6", sub: "M N O" },
                      { num: "7", sub: "P Q R S" },
                      { num: "8", sub: "T U V" },
                      { num: "9", sub: "W X Y Z" },
                      { num: "*", sub: "" },
                      { num: "0", sub: "+" },
                      { num: "#", sub: "" }
                    ].map(btn => (
                      <button
                        key={btn.num}
                        onClick={() => handleDialpadClick(btn.num)}
                        className={`aspect-square rounded-full flex flex-col items-center justify-center transition-all active:scale-95 ${
                          theme === "dark"
                            ? "bg-slate-800/40 hover:bg-slate-800 text-slate-100 hover:text-white"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-slate-950"
                        }`}
                      >
                        <span className="text-2xl sm:text-3xl font-semibold leading-none font-sans">{btn.num}</span>
                        {btn.sub && (
                          <span className={`text-[9px] sm:text-[9.5px] font-medium tracking-wide mt-0.5 uppercase ${
                            theme === "dark" ? "text-slate-500" : "text-slate-400"
                          }`}>{btn.sub}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Call trigger Pill Button (Centered pill with phone receiver icon) */}
                  <div className="flex justify-center pt-2.5 shrink-0">
                    <button
                      onClick={handleTriggerCall}
                      disabled={!dialInput.trim()}
                      className={`w-28 h-12 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 shrink-0 border ${
                        theme === "dark"
                          ? "bg-slate-805 hover:bg-slate-800 text-emerald-400 border-slate-700/50 disabled:bg-slate-900 disabled:text-slate-700 disabled:border-transparent"
                          : "bg-white hover:bg-slate-50 text-emerald-600 border-slate-150 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-transparent"
                      }`}
                    >
                      <Phone className={`w-5 h-5 fill-current shrink-0 ${
                        dialInput.trim() ? "text-emerald-500" : "opacity-45"
                      }`} />
                    </button>
                  </div>
                </div>
              ) : (
                /* 3B: Active Calling UI Screen */
                <div className="flex-1 flex flex-col items-center justify-center space-y-5 animate-fade-in max-w-sm text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40 animate-ping opacity-60" />
                    <PhoneCall className="w-8 h-8 text-emerald-400 shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white font-mono tracking-widest">{dialInput}</h3>
                    {(() => {
                      const match = getCrmMatch(dialInput);
                      return match && (
                        <p className="text-xs text-gold-400 mt-1 font-bold">
                          John: {match.customerName}
                        </p>
                      );
                    })()}
                    <p className="text-xs text-slate-400 mt-1.5 italic">
                      {callState === "dialing" 
                        ? (callMethod === "browser"
                            ? (isRtl ? "מחבר שיחה ישירה מהדפדפן..." : "Connecting browser call...")
                            : (isRtl ? "מתקשר לנייד שלך תחילה..." : "Ringing your forwarding phone first...")) 
                        : (isRtl ? "מחובר ללקוח!" : "Connected to customer!")}
                    </p>
                  </div>

                  {callState === "connected" && (
                    <div className="space-y-3">
                      <div className="text-lg font-bold font-mono text-emerald-400 bg-slate-900/60 px-4 py-1 border border-slate-800/80 rounded-full shadow-inner tracking-wider">
                        {formatTime(callDuration)}
                      </div>
                      
                      {/* Active Call Numeric Keypad */}
                      <div className="grid grid-cols-3 gap-2.5 max-w-[210px] sm:max-w-[240px] mx-auto">
                        {[
                          "1", "2", "3",
                          "4", "5", "6",
                          "7", "8", "9",
                          "*", "0", "#"
                        ].map((digit) => (
                          <button
                            key={digit}
                            onClick={() => handleDialpadClick(digit)}
                            className={`w-12 h-12 sm:w-14 h-14 rounded-full flex items-center justify-center font-black text-lg sm:text-xl transition-all border active:scale-90 shadow-md ${
                              theme === "dark"
                                ? "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-100"
                                : "bg-white hover:bg-slate-100 border-slate-250 text-slate-850 shadow-sm"
                            }`}
                          >
                            {digit}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleHangUp}
                    className="bg-rose-500 hover:bg-rose-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all border border-rose-400"
                  >
                    <Ban className="w-5 h-5 shrink-0" />
                  </button>
                </div>
              )}

            </div>
          )}
          {activeTab === "calls" && !showDialpad && (() => {
            const call = calls.find(c => c.id === selectedCallId);
            if (!call) return null;
            
            const crmMatch = getCrmMatch(call.phone);
            const isOutbound = call.direction === "outbound" || call.actions.some(act => act.toLowerCase().includes("outbound"));
            const isSmsCall = call.actions.some(act => act.startsWith("SMS:") || act.includes("SMS:"));
            const isMissed = call.status === "voicemail" || call.actions.some(act => act.toLowerCase().includes("voicemail"));

            return (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Header detail */}
                <div className="p-6 border-b border-slate-900/60 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
                        {crmMatch ? crmMatch.customerName.charAt(0).toUpperCase() : "?"}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          {crmMatch ? crmMatch.customerName : (isRtl ? "מתקשר אלחוטי" : "Wireless Caller")}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{call.phone}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setDialInput(call.phone);
                          setShowDialpad(true);
                        }} 
                        className="bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition-all flex items-center gap-1 shadow"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {isRtl ? "התקשר" : "Call"}
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedThreadPhone(call.phone.replace(/\D/g, ""));
                          setActiveTab("messages");
                        }} 
                        className="bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 transition-all flex items-center gap-1 shadow"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {isRtl ? "SMS" : "SMS Chat"}
                      </button>
                    </div>
                  </div>

                  {/* CRM Card Match details */}
                  <div className={`p-4 text-xs space-y-2 border rounded-2xl transition-colors duration-300 ${
                    theme === "dark" ? "bg-[#121f35]/50 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <div className={`flex items-center justify-between text-xs border-b pb-1.5 transition-colors duration-300 ${
                      theme === "dark" ? "border-slate-800/40" : "border-slate-200"
                    }`}>
                      <span className={`font-bold uppercase tracking-wider transition-colors duration-300 ${
                        theme === "dark" ? "text-slate-400" : "text-slate-500"
                      }`}>{isRtl ? "תיק לקוח CRM" : "CRM Client File"}</span>
                      {crmMatch ? (
                        <span className="text-gold-500 font-bold">#{crmMatch.id}</span>
                      ) : (
                        <span className="text-rose-500 font-bold">{isRtl ? "לא משויך להזמנה" : "Not Linked"}</span>
                      )}
                    </div>

                    {crmMatch ? (
                      <div className={`grid grid-cols-2 gap-3 transition-colors duration-300 ${
                        theme === "dark" ? "text-slate-200" : "text-slate-700"
                      }`}>
                        <div>
                          <span className={`block text-[11px] uppercase transition-colors duration-300 ${
                            theme === "dark" ? "text-slate-400" : "text-slate-505"
                          }`}>{isRtl ? "סטטוס בדיקה:" : "Test Status:"}</span>
                          <span className="font-bold">{translateStatus(crmMatch.status)}</span>
                        </div>
                        <div>
                          <span className={`block text-[11px] uppercase transition-colors duration-300 ${
                            theme === "dark" ? "text-slate-400" : "text-slate-550"
                          }`}>{isRtl ? "תוצאת שעטנז:" : "Shatnez Result:"}</span>
                          <span className="font-bold text-gold-400">{crmMatch.result || (isRtl ? "ממתין לבדיקה" : "Pending")}</span>
                        </div>
                        <div className="col-span-2">
                          <span className={`block text-[11px] uppercase transition-colors duration-300 ${
                            theme === "dark" ? "text-slate-400" : "text-slate-505"
                          }`}>{isRtl ? "כתובת מסירה/איסוף:" : "Drop-off Location:"}</span>
                          <span className="font-medium">{crmMatch.location || "14 Buchanan Rd"}</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`italic transition-colors duration-300 ${
                        theme === "dark" ? "text-slate-400" : "text-slate-500"
                      }`}>
                        {isRtl ? "ללקוח זה אין הזמנות פעילות במערכת." : "This client has no active orders in database."}
                      </div>
                    )}

                    {/* Linking call logic to order */}
                    <div className="flex gap-2 items-center pt-2">
                      <span className={`text-xs transition-colors duration-300 ${
                        theme === "dark" ? "text-slate-400" : "text-slate-500"
                      }`}>{isRtl ? "שייך להזמנה:" : "Link to Order:"}</span>
                      {isLinkingOrder === call.id ? (
                        <select 
                          onChange={(e) => handleLinkOrderConfirm(e.target.value)} 
                          className={`rounded px-2 py-1 text-xs transition-colors duration-300 ${
                            theme === "dark" ? "bg-slate-950 border border-slate-800 text-slate-200" : "bg-white border border-slate-250 text-slate-800"
                          }`}
                        >
                          <option value="">{isRtl ? "-- בחר הזמנה --" : "-- Select Order --"}</option>
                          {orders.filter(o => !o.archived).map(o => (
                            <option key={o.id} value={o.id}>#{o.id} - {o.customerName}</option>
                          ))}
                        </select>
                      ) : (
                        <button 
                          onClick={() => {
                            setIsLinkingOrder(call.id);
                            setLinkingType("call");
                          }} 
                          className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 font-bold underline"
                        >
                          <Link className="w-3 h-3" />
                          {call.orderId ? (isRtl ? `שיוך מחדש (הזמנה #${call.orderId})` : `Re-link (Order #${call.orderId})`) : (isRtl ? "בצע שיוך" : "Link Order")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Call logs event timeline list */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="relative border-l border-slate-800 ml-3 pl-5 space-y-5">
                    {call.actions.map((act, index) => (
                      <div key={index} className="relative">
                        <div className={`absolute top-1 -left-[25.5px] w-2.5 h-2.5 rounded-full ring-4 transition-colors duration-300 ${
                          theme === "dark" ? "bg-slate-700 ring-[#0b132b]" : "bg-slate-300 ring-white"
                        }`} />
                        <div className={`px-3.5 py-2.5 rounded-xl text-xs max-w-lg shadow-sm border transition-colors duration-300 ${
                          theme === "dark" ? "bg-slate-900/30 border-slate-800/40" : "bg-white border-slate-200"
                        }`}>
                          <p className={`font-semibold leading-relaxed transition-colors duration-300 ${
                            theme === "dark" ? "text-slate-200" : "text-slate-850"
                          }`}>{act}</p>
                          <span className="text-xs text-slate-500 block mt-1 font-mono">{getRelativeTime(call.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3D: VIEW FOR SMS CONVERSATIONS */}
          {activeTab === "messages" && (() => {
            if (!selectedThreadPhone) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500">
                  <MessageSquare className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
                  <p className="text-sm font-semibold">{isRtl ? "בחר שיחה מהרשימה" : "Select an SMS thread"}</p>
                  <p className="text-xs mt-1 text-slate-600">{isRtl ? "כדי לראות ולשלוח הודעות טקסט ללקוחות" : "To view SMS history and send replies"}</p>
                </div>
              );
            }

            const crmMatch = getCrmMatch(selectedThreadPhone);
            const threadMessages = smsMessages.filter(
              msg => msg.phone.replace(/\D/g, "") === selectedThreadPhone
            );

            return (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Chat Header info */}
                <div className={`p-4 border-b flex items-center justify-between shrink-0 transition-colors duration-300 ${
                  theme === "dark" ? "border-slate-900/60 bg-[#0f172a]/20" : "border-slate-200 bg-slate-100"
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
                    }`}>
                      {crmMatch ? crmMatch.customerName.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div>
                      <h3 className={`text-xs font-bold transition-colors duration-300 ${
                        theme === "dark" ? "text-slate-100" : "text-slate-850"
                      }`}>
                        {crmMatch ? crmMatch.customerName : selectedThreadPhone}
                      </h3>
                      {crmMatch && (
                        <span className="text-xs bg-gold-500/10 border border-gold-500/20 text-gold-500 px-1.5 py-0.5 rounded font-bold tracking-wider uppercase">
                          #{crmMatch.id} ({translateStatus(crmMatch.status)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Association logic */}
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-400">
                      {isLinkingOrder === selectedThreadPhone ? (
                        <select 
                          onChange={(e) => handleLinkOrderConfirm(e.target.value)} 
                          className={`rounded px-1.5 py-0.5 text-xs transition-colors duration-300 ${
                            theme === "dark" ? "bg-slate-950 border border-slate-800 text-slate-200" : "bg-white border border-slate-250 text-slate-800"
                          }`}
                        >
                          <option value="">{isRtl ? "-- שייך להזמנה --" : "-- Link Order --"}</option>
                          {orders.filter(o => !o.archived).map(o => (
                            <option key={o.id} value={o.id}>#{o.id}</option>
                          ))}
                        </select>
                      ) : (
                        <button 
                          onClick={() => {
                            setIsLinkingOrder(selectedThreadPhone);
                            setLinkingType("sms");
                          }} 
                          className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 font-bold underline"
                        >
                          <Link className="w-3 h-3" />
                          {threadMessages[0]?.orderId ? `#${threadMessages[0].orderId}` : (isRtl ? "שייך להזמנה" : "Link Order")}
                        </button>
                      )}
                    </div>

                    <button 
                      onClick={() => {
                        setDialInput(selectedThreadPhone);
                        setActiveTab("calls");
                        setShowDialpad(true);
                      }} 
                      className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                      title={isRtl ? "התקשר ללקוח" : "Call Client"}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Message Bubble Threads Area */}
                <div className={`flex-1 overflow-y-auto p-4 space-y-3 transition-colors duration-300 ${
                  theme === "dark" ? "bg-[#0b132b]/20" : "bg-slate-100/30"
                }`}>
                  {threadMessages.map(msg => {
                    const isCustomer = msg.direction === "inbound";
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${
                          isCustomer 
                            ? (isRtl ? "justify-start" : "justify-end") 
                            : (isRtl ? "justify-end" : "justify-start")
                        } w-full`}
                      >
                        <div
                          className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs shadow-sm ${
                            isCustomer
                              ? (theme === "dark" ? "bg-slate-900 border border-slate-800/80 text-slate-100" : "bg-white border border-slate-200 text-slate-800 shadow-sm")
                              : "bg-gold-500 text-slate-950 font-medium"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap" dir="auto">{msg.body}</p>
                          <span className={`block text-xs mt-1 opacity-65 ${
                            isCustomer ? "text-slate-400" : "text-slate-700"
                          } ${isRtl ? "text-left" : "text-right"}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick replies & chat input bar */}
                <div className={`p-3 border-t shrink-0 space-y-3 transition-colors duration-300 ${
                  theme === "dark" ? "bg-[#0f172a]/40 border-slate-900" : "bg-slate-100 border-slate-200"
                }`}>
                  
                  {/* SMS Quick Template Buttons */}
                  <div className={`flex flex-wrap gap-1.5 ${isRtl ? "justify-start" : "justify-end"}`}>
                    {smsTemplates.map((tpl, i) => (
                      <button
                        key={i}
                        onClick={() => setSmsInput(tpl.text)}
                        className={`text-xs border font-bold px-2.5 py-1.5 rounded transition-all duration-300 ${
                          theme === "dark" 
                            ? "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300" 
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm"
                        }`}
                      >
                        {tpl.title}
                      </button>
                    ))}
                  </div>

                  <div className={`flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <input
                      type="text"
                      value={smsInput}
                      onChange={(e) => setSmsInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && !sendingSms && smsInput.trim()) {
                          await handleSendSmsChat();
                        }
                      }}
                      placeholder={isRtl ? "הקלד הודעת SMS..." : "Type reply..."}
                      className={`flex-1 text-xs rounded-xl px-3 py-2 focus:outline-none transition-all duration-300 focus:border-gold-500 ${
                        theme === "dark" 
                          ? "bg-slate-950/60 border border-slate-850 text-slate-100" 
                          : "bg-white border border-slate-300 text-slate-850 shadow-sm"
                      } ${isRtl ? "text-right" : "text-left"}`}
                      disabled={sendingSms}
                    />
                    <button
                      onClick={handleSendSmsChat}
                      disabled={sendingSms || !smsInput.trim()}
                      className="bg-gold-500 hover:bg-gold-600 disabled:bg-slate-800 disabled:text-slate-500 border border-gold-400 hover:scale-105 active:scale-95 text-slate-950 font-bold px-3 py-2 rounded-xl shadow-lg transition-all flex items-center justify-center shrink-0"
                    >
                      {sendingSms ? (
                        <Play className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3E: VIEW FOR VOICEMAIL DETAILS */}
          {activeTab === "voicemails" && (() => {
            const vm = voicemails.find(v => v.id === selectedVoicemailId);
            if (!vm) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500">
                  <Volume2 className="w-12 h-12 mb-3 text-slate-600" />
                  <p className="text-sm font-semibold">{isRtl ? "בחר הודעה קולית" : "Select a voicemail"}</p>
                </div>
              );
            }

            const crmMatch = getCrmMatch(vm.phone);

            return (
              <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center">
                  <Volume2 className="w-10 h-10" />
                </div>

                <div className="text-center space-y-1">
                  <h3 className={`text-base font-bold transition-colors duration-300 ${
                    theme === "dark" ? "text-white" : "text-slate-900"
                  }`}>{crmMatch ? crmMatch.customerName : vm.phone}</h3>
                  <p className={`text-xs font-mono transition-colors duration-300 ${
                    theme === "dark" ? "text-slate-400" : "text-slate-505"
                  }`}>{vm.phone}</p>
                  <p className="text-xs text-slate-500">{new Date(vm.timestamp).toLocaleString()}</p>
                </div>

                {/* Voicemail Audio Controls */}
                <div className={`p-4 rounded-2xl w-full max-w-sm flex items-center gap-4 transition-colors duration-300 border ${
                  theme === "dark" ? "bg-[#121f35] border-slate-800" : "bg-white border-slate-200 shadow-sm"
                }`}>
                  <button
                    onClick={() => handlePlayVoicemail(vm)}
                    className="w-12 h-12 bg-gold-500 text-slate-950 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow shrink-0"
                  >
                    {playingVmId === vm.id ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1 space-y-1.5">
                    <div className={`flex items-center justify-between text-xs font-bold font-mono transition-colors duration-300 ${
                      theme === "dark" ? "text-slate-400" : "text-slate-500"
                    }`}>
                      <span>{playingVmId === vm.id ? (isRtl ? "מנגן..." : "Playing...") : (isRtl ? "מוכן" : "Ready")}</span>
                      <span>{formatDuration(vm.duration + "s", isRtl)}</span>
                    </div>
                    <div className={`h-1.5 w-full rounded-full overflow-hidden relative transition-colors duration-300 ${
                      theme === "dark" ? "bg-slate-950" : "bg-slate-200"
                    }`}>
                      {playingVmId === vm.id && (
                        <motion.div 
                          className="h-full bg-gold-500"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: parseFloat(vm.duration) || 10, ease: "linear" }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setDialInput(vm.phone);
                      setActiveTab("calls");
                      setShowDialpad(true);
                    }}
                    className="bg-emerald-500 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl hover:bg-emerald-400 shadow transition-all flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {isRtl ? "חיוג חוזר" : "Call Back"}
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedThreadPhone(vm.phone.replace(/\D/g, ""));
                      setActiveTab("messages");
                    }}
                    className="bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl border border-slate-700 shadow transition-all flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {isRtl ? "שלח SMS" : "Send SMS"}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 3F: VIEW FOR CONTACT DETAILS */}
          {activeTab === "contacts" && (() => {
            const contacts = getUniqueContacts();
            const contact = contacts.find(c => c.phone.replace(/\D/g, "") === selectedContactPhone);
            if (!contact) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500">
                  <Users className="w-12 h-12 mb-3 text-slate-600" />
                  <p className="text-sm font-semibold">{isRtl ? "בחר איש קשר מהרשימה" : "Select a contact"}</p>
                </div>
              );
            }

            return (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Header card details */}
                <div className="p-6 border-b border-slate-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 font-black text-lg shadow-sm">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{contact.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{contact.phone}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setDialInput(contact.phone);
                        setActiveTab("calls");
                        setShowDialpad(true);
                      }}
                      className="bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition-all flex items-center gap-1 shadow"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {isRtl ? "חיוג" : "Call"}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedThreadPhone(contact.phone.replace(/\D/g, ""));
                        setActiveTab("messages");
                      }}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 transition-all flex items-center gap-1 shadow"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {isRtl ? "SMS" : "SMS"}
                    </button>
                  </div>
                </div>

                {/* CRM Client Active orders list */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isRtl ? "היסטוריית הזמנות ב-CRM" : "CRM Order History"}</h4>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {contact.orders.map(order => (
                      <div key={order.id} className="bg-[#121f35]/30 border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-inner">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-100">{isRtl ? "הזמנה" : "Order"} #{order.id}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-md ${
                            order.status === "ready" 
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                              : "bg-slate-800 border border-slate-700 text-slate-300"
                          }`}>
                            {translateStatus(order.status)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <div>
                            <span className="text-slate-400 block text-[11px] uppercase">{isRtl ? "תאריך קבלה:" : "Date In:"}</span>
                            <span className="font-semibold">{order.dateReceived}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px] uppercase">{isRtl ? "תוצאת שעטנז:" : "Test Result:"}</span>
                            <span className="font-semibold text-gold-400">{order.result || (isRtl ? "טרם נבדק" : "Pending")}</span>
                          </div>
                        </div>
                        {order.notes && (
                          <div className="text-xs text-slate-400 border-t border-slate-800/40 pt-2 italic">
                            &ldquo;{order.notes}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3G: VIEW FOR SETTINGS */}
          {activeTab === "settings" && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-6 space-y-6">
              <h3 className={`text-base font-bold border-b pb-3 flex items-center gap-2 transition-colors duration-300 ${
                theme === "dark" ? "text-white border-slate-900/60" : "text-slate-900 border-slate-200"
              }`}>
                <SettingsIcon className="w-5 h-5 text-gold-400" />
                <span>{isRtl ? "הגדרות טלפון ומזהי שיחות" : "VoIP & Phone Settings"}</span>
              </h3>

              <div className="space-y-5 max-w-md text-xs">
                
                {/* DND Toggle setting card */}
                <div className={`rounded-2xl p-4 flex items-center justify-between gap-4 border transition-colors duration-300 ${
                  theme === "dark" ? "bg-[#121f35]/50 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                }`}>
                  <div>
                    <h4 className={`font-bold transition-colors duration-300 ${
                      theme === "dark" ? "text-slate-100" : "text-slate-805"
                    }`}>{isRtl ? "מצב נא לא להפריע (DND)" : "Do Not Disturb (DND)"}</h4>
                    <p className="text-xs mt-1 leading-relaxed transition-colors duration-300">
                      {isRtl 
                        ? "עצירת הפניית שיחות אליך וניתובן ישירות לתא הקולי של המערכת כשתהיה עסוק."
                        : "Bypass mobile call forwarding and route incoming queries straight to voicemail."}
                    </p>
                  </div>
                  <button
                    onClick={toggleDnd}
                    className={`relative inline-flex h-5.5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      dndActive ? "bg-rose-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        dndActive ? (isRtl ? "-translate-x-4.5" : "translate-x-4.5") : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Notifications Setting card */}
                <div className={`rounded-2xl p-4 flex items-center justify-between gap-4 border transition-colors duration-300 ${
                  theme === "dark" ? "bg-[#121f35]/50 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                }`}>
                  <div>
                    <h4 className={`font-bold transition-colors duration-300 ${
                      theme === "dark" ? "text-slate-100" : "text-slate-850"
                    }`}>{isRtl ? "התראות דפדפן (Push)" : "Browser Push Alerts"}</h4>
                    <p className="text-xs mt-1 leading-relaxed transition-colors duration-300">
                      {isRtl 
                        ? "קבלת התראה קופצת מדפדפן המחשב כאשר מתקבלת הודעת SMS חדשה, תא קולי או שיחה נכנסת."
                        : "Receive system desktop alerts for new incoming SMS, voicemail, or calls."}
                    </p>
                  </div>
                  <button
                    onClick={requestNotificationPermission}
                    disabled={notificationsEnabled}
                    className={`text-xs font-bold px-3 py-1 rounded-lg border transition-colors shrink-0 ${
                      notificationsEnabled 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-not-allowed" 
                        : "bg-gold-500 text-slate-950 border-gold-400 hover:scale-105"
                    }`}
                  >
                    {notificationsEnabled ? (isRtl ? "מאופשר" : "Enabled") : (isRtl ? "אפשר התראות" : "Enable")}
                  </button>
                </div>

                {/* VoIP Bridge Configuration stats */}
                <div className={`rounded-2xl p-4 space-y-3 border transition-colors duration-300 ${
                  theme === "dark" ? "bg-[#121f35]/50 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                }`}>
                  <h4 className={`font-bold border-b pb-1.5 uppercase tracking-wider text-xs transition-colors duration-300 ${
                    theme === "dark" ? "text-slate-100" : "text-slate-800"
                  }`}>
                    {isRtl ? "פרטי קו Twilio" : "Twilio VoIP Details"}
                  </h4>
                  <div className="space-y-2 text-xs transition-colors duration-300">
                    <div className="flex justify-between font-mono">
                      <span className="text-slate-500 uppercase">Office Line:</span>
                      <span className={`font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-900"}`}>{twilioPhoneNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-slate-500 uppercase">Your Mobile (Bridge):</span>
                      <span className={`font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-900"}`}>{forwardingNumber || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Future WebRTC Note */}
                <div className={`rounded-2xl p-4 flex items-start gap-2.5 text-xs border transition-colors duration-300 ${
                  theme === "dark" 
                    ? "bg-[#121f35]/20 border-slate-800/60 text-slate-400" 
                    : "bg-slate-100 border-slate-200 text-slate-600"
                }`}>
                  <Info className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    {isRtl 
                      ? "הערה טכנולוגית: חיבור החיוג מבוצע כעת בשיטת Twilio Bridge (הצלצול בנייד שלך). שדרוג עתידי יתמוך ב-Twilio WebRTC Client לביצוע שיחות דפדפן ישירות עם מיקרופון ואוזניות."
                      : "Future Upgrade Note: Outbound calling is currently routed via Twilio Bridging. A future upgrade will integrate Twilio WebRTC client to support browser calls."}
                  </p>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
