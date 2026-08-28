"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  MessageCircle,
  MessageSquare,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  CheckCheck,
  RotateCcw,
  Volume2,
  VolumeX,
  Bot,
  MapPin,
  Clock,
  Search,
  Truck,
  Phone,
  UserCheck,
  Package,
} from "lucide-react";
import { subscribeToChatSession, ChatMessage, ChatSession } from "@/lib/liveChat";
import { useLanguage } from "@/lib/LanguageContext";

function getDeviceInfo(): string {
  if (typeof window === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) {
    if (/iphone|ipad|ipod/i.test(ua)) return "iPhone (Mobile)";
    if (/android/i.test(ua)) return "Android (Mobile)";
    return "Mobile Device";
  }
  if (/macintosh|mac os x/i.test(ua)) return "Mac (Desktop)";
  if (/windows/i.test(ua)) return "Windows (Desktop)";
  return "Desktop Browser";
}

function playVisitorChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.18); // G5
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (err) {
    console.warn("[Visitor LiveChat] Sound playback failed:", err);
  }
}

export function LiveChatWidget() {
  const pathname = usePathname();
  const { language, isRtl } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [shortId, setShortId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [adminOnline, setAdminOnline] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef<number>(-1);

  const isAdminPage = pathname?.startsWith("/admin");

  // Initialize session ID & restore cached chat history from localStorage
  useEffect(() => {
    if (isAdminPage) return;

    let storedSession = localStorage.getItem("shatnez_chat_session_id");
    if (!storedSession) {
      storedSession = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem("shatnez_chat_session_id", storedSession);
    }
    setSessionId(storedSession);

    // Restore cached shortId & messages
    const cachedShortId = localStorage.getItem(`shatnez_chat_short_id_${storedSession}`);
    if (cachedShortId) setShortId(cachedShortId);

    const cachedMsgs = localStorage.getItem(`shatnez_chat_messages_${storedSession}`);
    if (cachedMsgs) {
      try {
        const parsed = JSON.parse(cachedMsgs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          prevMsgCountRef.current = parsed.length;
        }
      } catch (e) {
        console.error("Error parsing cached chat messages:", e);
      }
    }
  }, [isAdminPage]);

  // Save messages to localStorage
  useEffect(() => {
    if (isAdminPage) return;
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`shatnez_chat_messages_${sessionId}`, JSON.stringify(messages));
    }
  }, [sessionId, messages, isAdminPage]);

  // Save shortId to localStorage
  useEffect(() => {
    if (isAdminPage) return;
    if (sessionId && shortId) {
      localStorage.setItem(`shatnez_chat_short_id_${sessionId}`, shortId);
    }
  }, [sessionId, shortId, isAdminPage]);

  // Subscribe to real-time chat updates & HTTP polling
  useEffect(() => {
    if (isAdminPage || !sessionId) return;

    const fetchSessionData = () => {
      const pageParam = encodeURIComponent(window.location.pathname || "/");
      const deviceParam = encodeURIComponent(getDeviceInfo());
      let refParam = "Direct Visit";
      try {
        if (document.referrer) {
          refParam = new URL(document.referrer).hostname;
        }
      } catch (e) {}

      fetch(
        `/api/chat/session?sessionId=${sessionId}&page=${pageParam}&device=${deviceParam}&ref=${encodeURIComponent(
          refParam
        )}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            if (typeof data.adminOnline === "boolean") {
              setAdminOnline(data.adminOnline);
            }
            if (data.session) {
              if (data.session.shortId) {
                setShortId(data.session.shortId);
                localStorage.setItem(`shatnez_chat_short_id_${sessionId}`, data.session.shortId);
              }
              if (Array.isArray(data.session.messages) && data.session.messages.length > 0) {
                handleNewIncomingMessages(data.session.messages);
              }
            }
          }
        })
        .catch(() => {});
    };

    fetchSessionData();
    const pollInterval = setInterval(fetchSessionData, 3000);

    const unsubscribe = subscribeToChatSession(sessionId, (sessionData: ChatSession | null) => {
      if (sessionData) {
        if (sessionData.shortId) {
          setShortId(sessionData.shortId);
        }
        if (Array.isArray(sessionData.messages) && sessionData.messages.length > 0) {
          handleNewIncomingMessages(sessionData.messages);
        }
      }
    });

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [sessionId, isOpen, isAdminPage]);

  const handleNewIncomingMessages = (newMsgs: ChatMessage[]) => {
    setMessages(newMsgs);
    localStorage.setItem(`shatnez_chat_messages_${sessionId}`, JSON.stringify(newMsgs));

    if (prevMsgCountRef.current >= 0 && newMsgs.length > prevMsgCountRef.current) {
      const lastMsg = newMsgs[newMsgs.length - 1];
      if (lastMsg.sender === "admin") {
        if (soundEnabled) {
          playVisitorChime();
        }
        if (!isOpen) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    }
    prevMsgCountRef.current = newMsgs.length;
  };

  // Focus input and scroll when widget opens
  useEffect(() => {
    if (isAdminPage) return;
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 150);
    }
  }, [isOpen, isAdminPage]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (isAdminPage) return;
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isSending, isAdminPage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending || !sessionId) return;

    setIsSending(true);
    if (!textToSend) setInputText("");

    // Optimistic local update
    const tempMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      sender: "user",
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      const nextMsgs = [...prev, tempMsg];
      localStorage.setItem(`shatnez_chat_messages_${sessionId}`, JSON.stringify(nextMsgs));
      return nextMsgs;
    });

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text }),
      });

      const data = await res.json();
      if (data.success) {
        if (typeof data.adminOnline === "boolean") {
          setAdminOnline(data.adminOnline);
        }
        if (data.session) {
          if (data.session.shortId) {
            setShortId(data.session.shortId);
            localStorage.setItem(`shatnez_chat_short_id_${sessionId}`, data.session.shortId);
          }
          if (Array.isArray(data.session.messages) && data.session.messages.length > 0) {
            setMessages(data.session.messages);
            localStorage.setItem(`shatnez_chat_messages_${sessionId}`, JSON.stringify(data.session.messages));
            if (soundEnabled && data.aiReplied) {
              playVisitorChime();
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to send chat message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleResetChat = () => {
    const newSession = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem("shatnez_chat_session_id", newSession);
    setSessionId(newSession);
    setShortId("");
    setMessages([]);
    setShowConfirmReset(false);
    setUnreadCount(0);
    prevMsgCountRef.current = 0;
  };

  const quickActionCards = isRtl
    ? [
        {
          icon: Package,
          title: "מעקב הזמנה",
          subtitle: "בדיקת סטטוס בגד לפי מספר הזמנה או טלפון",
          text: "אני מעוניין לבדוק סטטוס הזמנה",
          color: "text-amber-700 bg-amber-50 border-amber-200/90",
        },
        {
          icon: MapPin,
          title: "כתובות ומיקומי מסירה",
          subtitle: "14 Buchanan Rd ו-166 Clinton Lane",
          text: "איפה נקודות המסירה של המעבדה?",
          color: "text-emerald-700 bg-emerald-50 border-emerald-200/90",
        },
        {
          icon: Clock,
          title: "שעות פעילות וזמני בדיקה",
          subtitle: "א'-ה' 9:00-21:00 • 1-2 ימי עסקים",
          text: "מה שעות הפעילות וכמה זמן לוקחת בדיקה?",
          color: "text-blue-700 bg-blue-50 border-blue-200/90",
        },
        {
          icon: Truck,
          title: "שירות איסוף VIP מהבית",
          subtitle: "איסוף והחזרה ישירות מבית הלקוח",
          text: "איך עובד שירות איסוף VIP עד הבית?",
          color: "text-purple-700 bg-purple-50 border-purple-200/90",
        },
        {
          icon: Phone,
          title: "בקשת שיחה חוזרת מנציג",
          subtitle: "השארת פרטים לקבלת שיחה טלפונית",
          text: "אשמח שנציג יחזור אלי טלפונית",
          color: "text-rose-700 bg-rose-50 border-rose-200/90",
        },
      ]
    : [
        {
          icon: Package,
          title: "Track Order",
          subtitle: "Check garment status by order ID or phone",
          text: "I would like to check my order status",
          color: "text-amber-700 bg-amber-50 border-amber-200/90",
        },
        {
          icon: MapPin,
          title: "Drop-off Locations",
          subtitle: "14 Buchanan Rd & 166 Clinton Lane",
          text: "Where are the lab drop-off locations?",
          color: "text-emerald-700 bg-emerald-50 border-emerald-200/90",
        },
        {
          icon: Clock,
          title: "Hours & Turnaround",
          subtitle: "Sun-Thu 9am-9pm • 1-2 business days",
          text: "What are your hours and turnaround time?",
          color: "text-blue-700 bg-blue-50 border-blue-200/90",
        },
        {
          icon: Truck,
          title: "VIP Home Pickup",
          subtitle: "Pick up & delivery directly to your door",
          text: "How does the VIP home pickup service work?",
          color: "text-purple-700 bg-purple-50 border-purple-200/90",
        },
        {
          icon: Phone,
          title: "Request Callback",
          subtitle: "Leave your number for a lab specialist",
          text: "I would like a representative to call me",
          color: "text-rose-700 bg-rose-50 border-rose-200/90",
        },
      ];

  // Hide chat widget completely on admin dashboard pages
  if (isAdminPage) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-5 ${isRtl ? "left-5" : "right-5"} z-50 font-sans ${
        isRtl ? "dir-rtl text-right" : "dir-ltr text-left"
      }`}
    >
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center gap-3 bg-navy-900 hover:bg-navy-800 text-white px-5 py-3.5 rounded-full shadow-2xl hover:shadow-gold-500/30 hover:scale-105 transition-all duration-300 border border-gold-400/50"
          aria-label={isRtl ? "פתח צ'אט שירות לקוחות" : "Open Live Support Chat"}
        >
          {/* Subtle Glow Ring */}
          <span className="absolute -inset-1 rounded-full bg-gold-400/25 blur-md group-hover:bg-gold-400/50 transition duration-300 animate-pulse"></span>

          <div className="relative flex items-center gap-2.5">
            <div className="relative">
              <MessageCircle className="w-6 h-6 text-gold-400" />
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-navy-900 ${
                  adminOnline ? "bg-emerald-400 animate-ping" : "bg-gold-400"
                }`}
              ></span>
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-navy-900 ${
                  adminOnline ? "bg-emerald-400" : "bg-gold-400"
                }`}
              ></span>
            </div>

            <span className="font-bold text-sm tracking-wide text-white px-1">
              {isRtl ? "צ'אט חי" : "Live Chat"}
            </span>
          </div>

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-gold-500 text-navy-900 font-extrabold text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Floating Modern High-Contrast Light Chat Window */}
      {isOpen && (
        <div className="w-[94vw] sm:w-[410px] h-[630px] max-h-[88vh] bg-white border border-primary-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300 text-navy-900">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-navy-900 via-navy-800 to-navy-950 p-4 border-b border-navy-700/80 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-gold-500 via-gold-400 to-gold-300 p-[2px] shadow-md">
                    <div className="w-full h-full bg-navy-900 rounded-[14px] flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-gold-400" />
                    </div>
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-navy-900 rounded-full ${
                      adminOnline ? "bg-emerald-400 animate-pulse" : "bg-gold-400"
                    }`}
                  ></span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-base tracking-tight">
                      {isRtl ? "מעבדת השעטנז" : "The Shatnez Lab"}
                    </h3>
                    <span className="text-[10px] bg-gold-500/20 text-gold-300 font-semibold px-2 py-0.5 rounded-full border border-gold-500/30">
                      {isRtl ? "שירות ומענה" : "Support"}
                    </span>
                  </div>

                  {/* Availability Indicator */}
                  {adminOnline ? (
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      {isRtl ? "נציג מחובר • מענה מיידי" : "Representative Online • Quick Reply"}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      {isRtl ? "שירות ומענה מהיר" : "Customer Support • Online"}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons: Sound Toggle, Reset, Close */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                    soundEnabled
                      ? "bg-white/10 hover:bg-white/20 text-gold-300"
                      : "bg-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                  title={
                    soundEnabled
                      ? isRtl
                        ? "השתק צלילים"
                        : "Mute Sounds"
                      : isRtl
                      ? "הפעל צלילים"
                      : "Unmute Sounds"
                  }
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setShowConfirmReset(true)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
                  title={isRtl ? "שיחה חדשה / איפוס" : "New Chat / Reset"}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
                  aria-label="Close Chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-banner: Ref ID & Support Badge */}
            <div className="mt-2.5 pt-2 border-t border-navy-700/60 flex items-center justify-between text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                <span>{isRtl ? "מעבדת שעטנז מוסמכת" : "Certified Shatnez Lab"}</span>
              </span>
              {shortId && (
                <span className="text-gold-400 font-mono font-semibold">
                  {isRtl ? `מספר פנייה #${shortId}` : `Ref #${shortId}`}
                </span>
              )}
            </div>
          </div>

          {/* Reset Confirmation Overlay */}
          {showConfirmReset && (
            <div className="bg-navy-950/90 p-4 text-center text-white space-y-3 animate-in fade-in duration-150 border-b border-gold-500/30">
              <p className="text-xs font-semibold">
                {isRtl ? "האם ברצונך לפתוח שיחה חדשה ולנקות את היסטוריית הצ'אט?" : "Start a fresh chat conversation?"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleResetChat}
                  className="bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold text-xs px-4 py-1.5 rounded-xl shadow transition"
                >
                  {isRtl ? "כן, התחל שיחה חדשה" : "Yes, Start New"}
                </button>
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-xl transition"
                >
                  {isRtl ? "ביטול" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-primary-50/70 scrollbar-thin scrollbar-thumb-primary-200">
            {/* Welcome banner */}
            <div className="bg-white border border-gold-300/60 rounded-2xl p-4 text-center text-xs text-navy-800 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-center gap-1.5 text-gold-600 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-gold-500" />
                {isRtl ? "ברוכים הבאים למעבדת השעטנז" : "Welcome to The Shatnez Lab"}
              </div>
              <p className="text-navy-700 text-xs leading-relaxed">
                {isRtl
                  ? "שאל אותנו על בדיקת בגדים, מעקב הזמנה, שעות פתיחה או איסוף מהבית, ונציגי המעבדה ישיבו לך מיד."
                  : "Have a question about garment testing, order status, hours, or VIP pickup? Ask us below and we will assist you immediately."}
              </p>
            </div>

            {/* Quick Action Vector Cards */}
            {messages.length === 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-navy-800">
                  {isRtl ? "פעולות ושאלות נפוצות:" : "Frequently Asked Questions:"}
                </p>
                <div className="flex flex-col gap-2">
                  {quickActionCards.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(item.text)}
                        className={`bg-white hover:bg-gold-50/70 text-navy-900 border border-primary-200 hover:border-gold-400 p-2.5 rounded-2xl transition duration-200 flex items-center justify-between group shadow-xs ${
                          isRtl ? "text-right" : "text-left"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${item.color}`}
                          >
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-navy-900 text-xs truncate">{item.title}</div>
                            <div className="text-[11px] text-primary-400 truncate font-normal">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-gold-600 opacity-60 group-hover:opacity-100 transition shrink-0 ${
                            isRtl
                              ? "rotate-180 group-hover:-translate-x-0.5"
                              : "group-hover:translate-x-0.5"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rendered Messages */}
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              const dateStr = new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
                >
                  <div
                    className={`max-w-[88%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "bg-gradient-to-r from-gold-500 to-gold-600 text-white font-medium rounded-br-none"
                        : "bg-navy-900 text-white font-normal rounded-bl-none border border-navy-800"
                    }`}
                  >
                    {!isUser && (
                      <div className="text-[11px] font-bold text-gold-400 mb-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                        {isRtl ? "מעבדת השעטנז" : "The Shatnez Lab"}
                      </div>
                    )}
                    <p className={`whitespace-pre-wrap ${isRtl ? "text-right" : "text-left"}`}>{msg.text}</p>
                  </div>
                  <span className="text-[10px] text-navy-400 font-medium px-1 flex items-center gap-1">
                    {dateStr}
                    {isUser && <CheckCheck className="w-3.5 h-3.5 text-gold-600" />}
                  </span>
                </div>
              );
            })}

            {/* Sending / Typing indicator */}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-navy-900 text-slate-200 px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 rounded-bl-none shadow-sm">
                  <span className="w-2 h-2 bg-gold-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gold-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 bg-gold-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-[11px] text-gold-300 font-medium">
                    {isRtl ? "המעבדה מנסחת תשובה..." : "Lab Assistant is replying..."}
                  </span>
                </div>
              </div>
            )}

            {/* Escalation Prompt Action Buttons */}
            {(() => {
              const lastMsg = messages[messages.length - 1];
              const isEscalationPrompt =
                lastMsg &&
                lastMsg.sender === "admin" &&
                (lastMsg.text.includes("כיצד תרצה לקבל מענה") ||
                  lastMsg.text.includes("How would you prefer to connect") ||
                  lastMsg.text.includes("שיחה חוזרת לטלפון") ||
                  lastMsg.text.includes("מענה כאן בחלון הצ'אט"));

              const isWaitingOnAdmin =
                lastMsg &&
                (lastMsg.text.includes("הודעתך הועברה ישירות") ||
                  lastMsg.text.includes("forwarded directly to our lab specialist") ||
                  lastMsg.text.includes("אנא המתן כאן בחלון הצ'אט") ||
                  lastMsg.text.includes("hold on in this chat window"));

              if (isEscalationPrompt) {
                return (
                  <div className="p-3 bg-gold-50 border border-gold-200 rounded-2xl space-y-2 mt-2 shadow-xs">
                    <p className="text-xs font-bold text-gold-950 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gold-600" />
                      {isRtl ? "בחר את אופן ההתקשרות המועדף:" : "Choose your preferred connection:"}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setInputText(isRtl ? "הטלפון שלי הוא: " : "My phone number is: ");
                          inputRef.current?.focus();
                        }}
                        className="p-2.5 bg-white hover:bg-gold-100 text-navy-950 font-bold text-xs rounded-xl border border-gold-300 shadow-2xs transition flex items-center justify-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{isRtl ? "📞 שיחה חוזרת לטלפון" : "📞 Phone Callback"}</span>
                      </button>
                      <button
                        onClick={() =>
                          handleSendMessage(
                            isRtl ? "אמתין כאן למענה נציג בחלון הצ'אט" : "Wait in chat for representative"
                          )
                        }
                        className="p-2.5 bg-white hover:bg-gold-100 text-navy-950 font-bold text-xs rounded-xl border border-gold-300 shadow-2xs transition flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-gold-600 shrink-0" />
                        <span>{isRtl ? "💬 אמתין למענה בצ'אט" : "💬 Wait in Chat"}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              if (isWaitingOnAdmin) {
                return (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2 mt-2 shadow-2xs animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>
                      {isRtl
                        ? "נציג המעבדה קיבל SMS ומנסח עבורך מענה, אנא המתן..."
                        : "Lab specialist has been texted and will reply here momentarily..."}
                    </span>
                  </div>
                );
              }

              return null;
            })()}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Pills above Input when messages exist */}
          {messages.length > 0 && (
            <div className="px-3 py-1.5 bg-primary-100/60 border-t border-primary-200/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => handleSendMessage(isRtl ? "איפה נקודות המסירה?" : "Where is the drop-off location?")}
                className="text-[11px] bg-white hover:bg-gold-50 text-navy-900 border border-primary-200 px-2.5 py-1 rounded-lg shrink-0 font-medium transition shadow-2xs flex items-center gap-1"
              >
                <MapPin className="w-3 h-3 text-gold-600" />
                {isRtl ? "מיקומי מסירה" : "Drop-off"}
              </button>
              <button
                onClick={() => handleSendMessage(isRtl ? "מה שעות הפעילות?" : "What are your opening hours?")}
                className="text-[11px] bg-white hover:bg-gold-50 text-navy-900 border border-primary-200 px-2.5 py-1 rounded-lg shrink-0 font-medium transition shadow-2xs flex items-center gap-1"
              >
                <Clock className="w-3 h-3 text-gold-600" />
                {isRtl ? "שעות פתיחה" : "Hours"}
              </button>
              <button
                onClick={() => handleSendMessage(isRtl ? "מעקב הזמנה" : "Track my order")}
                className="text-[11px] bg-white hover:bg-gold-50 text-navy-900 border border-primary-200 px-2.5 py-1 rounded-lg shrink-0 font-medium transition shadow-2xs flex items-center gap-1"
              >
                <Search className="w-3 h-3 text-gold-600" />
                {isRtl ? "מעקב הזמנה" : "Track Order"}
              </button>
              <button
                onClick={() => handleSendMessage(isRtl ? "שיחה עם נציג אנושי" : "Speak to a human")}
                className="text-[11px] bg-white hover:bg-gold-50 text-navy-900 border border-primary-200 px-2.5 py-1 rounded-lg shrink-0 font-medium transition shadow-2xs flex items-center gap-1"
              >
                <Phone className="w-3 h-3 text-gold-600" />
                {isRtl ? "שיחה עם נציג" : "Human Agent"}
              </button>
              <button
                onClick={() => handleSendMessage(isRtl ? "שירות איסוף VIP מהבית" : "VIP Home Pickup")}
                className="text-[11px] bg-white hover:bg-gold-50 text-navy-900 border border-primary-200 px-2.5 py-1 rounded-lg shrink-0 font-medium transition shadow-2xs flex items-center gap-1"
              >
                <Truck className="w-3 h-3 text-gold-600" />
                {isRtl ? "איסוף VIP" : "VIP Pickup"}
              </button>
            </div>
          )}

          {/* Footer Input Area */}
          <div className="p-3.5 bg-white border-t border-primary-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 bg-primary-50 border border-primary-200 focus-within:border-gold-500 rounded-2xl px-3 py-1.5 transition duration-200"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isRtl ? "הקלד הודעה, שאלה או מספר הזמנה..." : "Type your message or order number..."
                }
                className={`flex-1 bg-transparent text-xs sm:text-sm text-navy-900 placeholder-navy-400 outline-none py-1.5 font-medium ${
                  isRtl ? "text-right" : "text-left"
                }`}
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="w-9 h-9 rounded-xl bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold flex items-center justify-center disabled:opacity-40 transition shadow-md shrink-0"
                aria-label="Send Message"
              >
                <Send className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-navy-500 font-semibold px-1 mt-2">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-gold-600" />
                {isRtl ? "מעבדת שעטנז מוסמכת" : "Certified Shatnez Laboratory"}
              </span>
              {shortId && <span>{isRtl ? `פנייה #${shortId}` : `Ref #${shortId}`}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
