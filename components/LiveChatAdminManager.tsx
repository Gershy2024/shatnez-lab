"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MessageSquare,
  Send,
  User,
  ShieldCheck,
  Clock,
  Sparkles,
  Search,
  RefreshCw,
  Phone,
  Mail,
  Volume2,
  VolumeX,
  Bell,
  Globe,
  Smartphone,
  Laptop,
  MapPin,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Package,
  ExternalLink,
  Bot,
  Zap,
  Truck,
} from "lucide-react";
import {
  subscribeToAllChatSessions,
  ChatSession,
  ChatMessage,
} from "@/lib/liveChat";
import { Order, getOrderById, getOrdersByPhone } from "@/lib/db";

interface LiveChatAdminManagerProps {
  isRtl: boolean;
}

function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;

    // Tone 1 - High clear bell chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2 - Harmonic resonance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.4, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (err) {
    console.warn("[LiveChat Sound] Error playing audio chime:", err);
  }
}

export default function LiveChatAdminManager({ isRtl }: LiveChatAdminManagerProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTabFilter, setActiveTabFilter] = useState<"active" | "all" | "closed">("active");
  const [desktopNotifAllowed, setDesktopNotifAllowed] = useState(false);
  const [linkedOrders, setLinkedOrders] = useState<Order[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevVisitorMsgCountRef = useRef<number>(-1);

  // Check notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setDesktopNotifAllowed(Notification.permission === "granted");
    }
  }, []);

  const requestDesktopNotifications = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setDesktopNotifAllowed(true);
          new Notification("💬 The Shatnez Lab Live Chat", {
            body: isRtl ? "התראות דפדפן הופעלו בהצלחה!" : "Desktop notifications enabled successfully!",
            icon: "/icon.svg",
          });
        }
      } catch (e) {
        console.warn("Notification request error:", e);
      }
    }
  };

  // Admin Heartbeat (Send online status every 25s)
  useEffect(() => {
    const sendHeartbeat = (isOnline: boolean = true) => {
      fetch("/api/chat/admin-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline }),
      }).catch(() => {});
    };

    sendHeartbeat(true);
    const heartbeatInterval = setInterval(() => sendHeartbeat(true), 25000);

    return () => {
      clearInterval(heartbeatInterval);
      sendHeartbeat(false);
    };
  }, []);

  const fetchSessionsFromApi = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/chat/list");
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        updateSessionsState(data.sessions);
      }
    } catch (err) {
      console.error("Failed to fetch sessions from API:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateSessionsState = (newSessions: ChatSession[]) => {
    setSessions((prevSessions) => {
      if (prevSessions.length === 0) return newSessions;

      return newSessions.map((newSess) => {
        const prevSess = prevSessions.find((p) => p.sessionId === newSess.sessionId);
        if (prevSess && prevSess.messages && newSess.messages) {
          if (prevSess.messages.length > newSess.messages.length) {
            return {
              ...newSess,
              messages: prevSess.messages,
            };
          }
        }
        return newSess;
      });
    });

    if (newSessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(newSessions[0].sessionId);
    }

    // Count total visitor messages across all sessions
    let totalVisitorMsgs = 0;
    newSessions.forEach((s) => {
      if (s.messages) {
        totalVisitorMsgs += s.messages.filter((m) => m.sender === "user").length;
      }
    });

    if (prevVisitorMsgCountRef.current >= 0 && totalVisitorMsgs > prevVisitorMsgCountRef.current) {
      if (soundEnabled) {
        playNotificationChime();
      }

      // Desktop push notification if enabled
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const latestSessionWithMsg = newSessions.find((s) => {
          const msgs = s.messages || [];
          const last = msgs[msgs.length - 1];
          return last && last.sender === "user";
        });

        if (latestSessionWithMsg) {
          const lastMsg = latestSessionWithMsg.messages[latestSessionWithMsg.messages.length - 1];
          new Notification(`💬 Live Visitor #${latestSessionWithMsg.shortId}`, {
            body: lastMsg.text || (isRtl ? "הודעה חדשה מגולש באתר" : "New message from website visitor"),
            icon: "/icon.svg",
          });
        }
      }
    }

    prevVisitorMsgCountRef.current = totalVisitorMsgs;
  };

  // Subscribe to all chat sessions in real time + API polling
  useEffect(() => {
    fetchSessionsFromApi();

    const unsubscribe = subscribeToAllChatSessions((updatedSessions) => {
      if (updatedSessions.length > 0) {
        updateSessionsState(updatedSessions);
      }
    });

    const interval = setInterval(() => {
      fetchSessionsFromApi();
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [soundEnabled, selectedSessionId]);

  const selectedSession =
    sessions.find((s) => s.sessionId === selectedSessionId) || sessions[0] || null;

  // Search linked orders when selected session changes
  useEffect(() => {
    if (!selectedSession) {
      setLinkedOrders([]);
      return;
    }

    let foundOrderId = "";
    let foundPhone = selectedSession.visitorPhone || "";

    // Search messages for order IDs or phone numbers
    (selectedSession.messages || []).forEach((m) => {
      if (m.sender === "user") {
        const match = m.text.match(/(?:#|order\s*#?|הזמנה\s*#?)?(\d{2,6})/i);
        if (match && match[1].length <= 5 && !foundOrderId) {
          foundOrderId = match[1];
        }
        const cleanDigits = m.text.replace(/\D/g, "");
        if (cleanDigits.length === 10 && !foundPhone) {
          foundPhone = cleanDigits;
        }
      }
    });

    const loadOrders = async () => {
      const results: Order[] = [];
      if (foundOrderId) {
        try {
          const ord = await getOrderById(foundOrderId);
          if (ord) results.push(ord);
        } catch (e) {}
      }
      if (foundPhone && (!results.length || results[0].phone !== foundPhone)) {
        try {
          const phOrders = await getOrdersByPhone(foundPhone);
          if (phOrders && phOrders.length > 0) {
            phOrders.forEach((po) => {
              if (!results.some((r) => r.id === po.id)) {
                results.push(po);
              }
            });
          }
        } catch (e) {}
      }
      setLinkedOrders(results);
    };

    loadOrders();
  }, [selectedSessionId, selectedSession]);

  // Scroll down when new message arrives
  const lastMsgId = selectedSession?.messages?.[selectedSession.messages.length - 1]?.id;
  const msgCount = selectedSession?.messages?.length || 0;

  useEffect(() => {
    if (msgCount > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedSessionId, lastMsgId, msgCount]);

  const handleSendAdminReply = async (textToSend?: string) => {
    const text = (textToSend || replyText).trim();
    if (!text || !selectedSession || isSending) return;

    setIsSending(true);
    if (!textToSend) setReplyText("");

    const newMsg: ChatMessage = {
      id: `admin_${Date.now()}`,
      sender: "admin",
      text,
      timestamp: Date.now(),
    };

    // Optimistically update sessions state immediately
    setSessions((prevSessions) =>
      prevSessions.map((s) => {
        if (s.sessionId === selectedSession.sessionId) {
          const currentMsgs = s.messages || [];
          return {
            ...s,
            messages: [...currentMsgs, newMsg],
            lastUpdated: Date.now(),
            status: "active",
          };
        }
        return s;
      })
    );

    try {
      const res = await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSession.sessionId, text }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        setSessions((prev) =>
          prev.map((s) => (s.sessionId === data.session.sessionId ? data.session : s))
        );
      }
    } catch (err) {
      console.error("Failed to send admin chat reply:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateSessionStatus = async (action: "resolve" | "reopen" | "delete") => {
    if (!selectedSession) return;

    if (action === "delete") {
      if (!confirm(isRtl ? "האם למחוק שיחה זו לצמיתות?" : "Permanently delete this chat session?")) {
        return;
      }
      setSessions((prev) => prev.filter((s) => s.sessionId !== selectedSession.sessionId));
      setSelectedSessionId(null);
    }

    try {
      const res = await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSession.sessionId, action }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        setSessions((prev) =>
          prev.map((s) => (s.sessionId === data.session.sessionId ? data.session : s))
        );
      }
    } catch (err) {
      console.error("Failed to update chat status:", err);
    }
  };

  const handleSuggestAiReply = async () => {
    if (!selectedSession || isGeneratingAi) return;
    setIsGeneratingAi(true);

    try {
      const msgsToAnalyze = (selectedSession.messages || []).map((m) => ({
        body: m.text,
        direction: m.sender === "user" ? "inbound" : "outbound",
        timestamp: m.timestamp,
      }));

      const res = await fetch("/api/gemini/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedSession.visitorPhone || `Visitor #${selectedSession.shortId}`,
          messages: msgsToAnalyze,
          orders: linkedOrders,
          isRtl,
        }),
      });

      const data = await res.json();
      if (data.suggestion) {
        setReplyText(data.suggestion);
      }
    } catch (err) {
      console.error("Failed to generate AI suggestion:", err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Canned Responses (תשובות מוכנות מראש עם וקטורים)
  const cannedResponses = isRtl
    ? [
        { icon: Clock, label: "שעות פעילות", text: "שלום! שעות הפעילות שלנו במעבדה הן ימים ראשון עד חמישי מ-9:00 עד 21:00 בערב (14 Buchanan Rd, Spring Valley)." },
        { icon: MapPin, label: "מיקום מסירה", text: "ניתן להניח את הבגד בכתובת 14 Buchanan Rd, Spring Valley בתוך מעטפה או שקית עם שמך ומספר הטלפון שלך." },
        { icon: Package, label: "מוכן לאיסוף", text: "הבגד שלך מוכן לאיסוף מהמעבדה בביוקנן 14! נשמח לראותך." },
        { icon: Clock, label: "זמני בדיקה", text: "בדיקת שעטנז סטנדרטית אורכת בדרך כלל בין 1 ל-2 ימי עסקים." },
        { icon: Truck, label: "איסוף VIP", text: "אנו מציעים שירות VIP לאיסוף והחזרה עד הבית. אנא השאר כתובת וטלפון ונתאם." },
        { icon: Phone, label: "נחזור אליך", text: "קיבלנו את פנייתך! נציג מהמעבדה יחזור אליך בהקדם למספר הטלפון שציינת." },
      ]
    : [
        { icon: Clock, label: "Hours", text: "Hello! Our lab hours are Sunday through Thursday, 9:00 AM – 9:00 PM at 14 Buchanan Rd, Spring Valley, NY." },
        { icon: MapPin, label: "Drop-off", text: "You can drop off your garment at 14 Buchanan Rd, Spring Valley, NY. Please place it in a bag with your name and phone number." },
        { icon: Package, label: "Ready for Pickup", text: "Your order is ready for pickup at our lab (14 Buchanan Rd, Spring Valley)! Thank you." },
        { icon: Clock, label: "Turnaround", text: "Standard microscopic shatnez inspection takes 1-2 business days." },
        { icon: Truck, label: "VIP Pickup", text: "We offer VIP home pickup and delivery service. Please provide your address and phone number to coordinate." },
        { icon: Phone, label: "Calling You", text: "Thank you for reaching out! A lab specialist will call or text you shortly at your phone number." },
      ];

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Tab filter
      if (activeTabFilter === "active" && s.status === "closed") return false;
      if (activeTabFilter === "closed" && s.status !== "closed") return false;

      // Search query
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const matchId = s.shortId?.toLowerCase().includes(q);
      const matchEmail = s.visitorEmail?.toLowerCase().includes(q);
      const matchPhone = s.visitorPhone?.toLowerCase().includes(q);
      const matchPage = s.currentPage?.toLowerCase().includes(q);
      const matchDevice = s.deviceInfo?.toLowerCase().includes(q);
      const matchLocation = s.location?.toLowerCase().includes(q);
      const matchText = s.messages?.some((m) => m.text.toLowerCase().includes(q));
      return (
        matchId || matchEmail || matchPhone || matchPage || matchDevice || matchLocation || matchText
      );
    });
  }, [sessions, activeTabFilter, searchQuery]);

  return (
    <div
      className={`card p-0 bg-white border border-primary-200 shadow-sm rounded-2xl overflow-hidden flex flex-col md:flex-row min-h-[640px] max-h-[780px] ${
        isRtl ? "text-right dir-rtl" : "text-left"
      }`}
    >
      {/* Sidebar: Session List */}
      <div className="w-full md:w-84 border-b md:border-b-0 md:border-r border-primary-200 bg-primary-50/50 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-3.5 border-b border-primary-200 bg-white space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-navy-900 flex items-center gap-2 text-sm">
              <MessageSquare className="w-4 h-4 text-gold-500" />
              {isRtl ? "שיחות צ'אט חי" : "Live Chat Sessions"}
            </h3>

            <div className="flex items-center gap-1.5">
              {/* Desktop notification button */}
              <button
                onClick={requestDesktopNotifications}
                title={
                  desktopNotifAllowed
                    ? isRtl
                      ? "התראות דפדפן פעילות"
                      : "Desktop notifications active"
                    : isRtl
                    ? "לחץ להפעלת התראות דפדפן קופצות"
                    : "Click to enable desktop notifications"
                }
                className={`p-1.5 rounded-lg border transition flex items-center justify-center ${
                  desktopNotifAllowed
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
              </button>

              {/* Sound alert toggle */}
              <button
                onClick={() => {
                  const nextSound = !soundEnabled;
                  setSoundEnabled(nextSound);
                  if (nextSound) playNotificationChime();
                }}
                title={
                  soundEnabled
                    ? isRtl
                      ? "התראות קוליות פעילות"
                      : "Sound Alerts Active"
                    : isRtl
                    ? "התראות קוליות כבויות"
                    : "Sound Alerts Muted"
                }
                className={`p-1.5 rounded-lg border transition flex items-center justify-center ${
                  soundEnabled
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                }`}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-gray-400" />
                )}
              </button>

              <button
                onClick={fetchSessionsFromApi}
                disabled={isRefreshing}
                title={isRtl ? "רענן רשימה" : "Refresh List"}
                className="p-1.5 text-primary-500 hover:text-navy-900 hover:bg-primary-100 rounded-lg transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-primary-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? "חפש לפי מזהה, עיר, דף, טקסט..." : "Search by ID, city, page, text..."}
              className="w-full pl-9 pr-3 py-1.5 bg-primary-50 border border-primary-200 rounded-xl text-xs focus:outline-none focus:border-gold-400 text-navy-900 font-medium"
            />
          </div>

          {/* Status Filter Tabs (Active / All / Closed) */}
          <div className="flex items-center gap-1 bg-primary-100/70 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTabFilter("active")}
              className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-[11px] ${
                activeTabFilter === "active"
                  ? "bg-white text-navy-900 shadow-2xs"
                  : "text-primary-600 hover:text-navy-900"
              }`}
            >
              {isRtl ? "פעילות" : "Active"} (
              {sessions.filter((s) => s.status !== "closed").length})
            </button>
            <button
              onClick={() => setActiveTabFilter("closed")}
              className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-[11px] ${
                activeTabFilter === "closed"
                  ? "bg-white text-navy-900 shadow-2xs"
                  : "text-primary-600 hover:text-navy-900"
              }`}
            >
              {isRtl ? "סגורות" : "Closed"} (
              {sessions.filter((s) => s.status === "closed").length})
            </button>
            <button
              onClick={() => setActiveTabFilter("all")}
              className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-[11px] ${
                activeTabFilter === "all"
                  ? "bg-white text-navy-900 shadow-2xs"
                  : "text-primary-600 hover:text-navy-900"
              }`}
            >
              {isRtl ? "הכל" : "All"} ({sessions.length})
            </button>
          </div>
        </div>

        {/* Sessions Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-primary-100">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-primary-400 flex flex-col items-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary-300 stroke-[1.5]" />
              {isRtl ? "לא נמצאו שיחות צ'אט" : "No live chat sessions found"}
              <button
                onClick={fetchSessionsFromApi}
                className="mt-2 text-[11px] bg-white border border-primary-200 px-3 py-1 rounded-lg text-navy-800 font-semibold hover:bg-primary-50"
              >
                {isRtl ? "רענן שיחות" : "Refresh Chats"}
              </button>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isSelected = selectedSession?.sessionId === session.sessionId;
              const msgs = session.messages || [];
              const lastMsg = msgs[msgs.length - 1];
              const lastTime = lastMsg
                ? new Date(lastMsg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              const hasUnansweredUserMsg =
                lastMsg && lastMsg.sender === "user";

              return (
                <button
                  key={session.sessionId}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                  className={`w-full p-3 text-left transition duration-150 flex flex-col gap-1.5 ${
                    isSelected
                      ? "bg-white border-l-4 border-l-gold-500 shadow-sm"
                      : "hover:bg-white/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-navy-900 flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          session.status === "closed"
                            ? "bg-gray-400"
                            : hasUnansweredUserMsg
                            ? "bg-gold-500 animate-ping"
                            : "bg-emerald-500"
                        }`}
                      ></span>
                      Visitor #{session.shortId}
                      {session.status === "closed" && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-normal">
                          {isRtl ? "סגור" : "Closed"}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-primary-400 font-medium">{lastTime}</span>
                  </div>

                  {/* Badges: Page, Device & City Location */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {session.location && (
                      <span className="text-[10px] bg-rose-50 text-rose-800 font-semibold px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                        {session.location}
                      </span>
                    )}
                    {session.currentPage && (
                      <span className="text-[10px] bg-amber-50 text-amber-800 font-medium px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                        {session.currentPage === "/" ? "Home" : session.currentPage}
                      </span>
                    )}
                    {session.deviceInfo && (
                      <span className="text-[10px] bg-gray-100 text-gray-700 font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
                        {session.deviceInfo.includes("Mobile") ? (
                          <Smartphone className="w-2.5 h-2.5 text-gray-500 shrink-0" />
                        ) : (
                          <Laptop className="w-2.5 h-2.5 text-gray-500 shrink-0" />
                        )}
                        {session.deviceInfo}
                      </span>
                    )}
                  </div>

                  {session.visitorEmail && (
                    <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                      <Mail className="w-3 h-3 text-blue-500 shrink-0" />
                      {session.visitorEmail}
                    </span>
                  )}
                  {session.visitorPhone && (
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                      {session.visitorPhone}
                    </span>
                  )}

                  <p className="text-xs text-navy-700 line-clamp-1 font-normal">
                    {lastMsg
                      ? `${lastMsg.sender === "user" ? "Visitor: " : "Lab: "}${lastMsg.text}`
                      : `Chat #${session.shortId}`}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Display Pane */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedSession ? (
          <>
            {/* Top Bar Header */}
            <div className="p-3.5 border-b border-primary-200 bg-white flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-navy-900 text-gold-400 flex items-center justify-center font-extrabold text-sm shadow-sm shrink-0">
                    #{selectedSession.shortId}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-navy-900 text-base">
                        {isRtl ? `גולש באתר #${selectedSession.shortId}` : `Web Visitor #${selectedSession.shortId}`}
                      </h4>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${
                          selectedSession.status === "closed"
                            ? "bg-gray-100 text-gray-600 border-gray-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {selectedSession.status === "closed"
                          ? isRtl
                            ? "שיחה סגורה"
                            : "Resolved"
                          : isRtl
                          ? "שיחה פעילה"
                          : "Active"}
                      </span>
                    </div>
                    <p className="text-[11px] text-primary-400 flex items-center gap-1 mt-0.5 font-medium">
                      <Clock className="w-3 h-3 text-primary-400" />
                      Started{" "}
                      {new Date(selectedSession.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {selectedSession.referrer && ` • Source: ${selectedSession.referrer}`}
                    </p>
                  </div>
                </div>

                {/* Session Actions: Resolve / Reopen / Delete */}
                <div className="flex items-center gap-1.5">
                  {selectedSession.status !== "closed" ? (
                    <button
                      onClick={() => handleUpdateSessionStatus("resolve")}
                      className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shadow-2xs"
                      title={isRtl ? "סמן שיחה כטופלה / סגורה" : "Mark as Resolved"}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isRtl ? "סגור שיחה" : "Resolve"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateSessionStatus("reopen")}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shadow-2xs"
                      title={isRtl ? "פתח מחדש שיחה" : "Reopen Chat"}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isRtl ? "פתח מחדש" : "Reopen"}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleUpdateSessionStatus("delete")}
                    className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 p-2 rounded-xl transition"
                    title={isRtl ? "מחק שיחה" : "Delete Chat"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Badges Bar */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-primary-100/60">
                {selectedSession.location && (
                  <span className="text-[11px] bg-rose-50 text-rose-800 font-semibold px-2 py-0.5 rounded-lg border border-rose-200 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-600 shrink-0" />
                    {selectedSession.location}
                  </span>
                )}
                {selectedSession.currentPage && (
                  <span className="text-[11px] bg-amber-50 text-amber-900 font-semibold px-2 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-amber-600 shrink-0" />
                    {selectedSession.currentPage === "/" ? "Home" : selectedSession.currentPage}
                  </span>
                )}
                {selectedSession.deviceInfo && (
                  <span className="text-[11px] bg-purple-50 text-purple-800 font-semibold px-2 py-0.5 rounded-lg border border-purple-200 flex items-center gap-1">
                    {selectedSession.deviceInfo.includes("Mobile") ? (
                      <Smartphone className="w-3 h-3 text-purple-600 shrink-0" />
                    ) : (
                      <Laptop className="w-3 h-3 text-purple-600 shrink-0" />
                    )}
                    {selectedSession.deviceInfo}
                  </span>
                )}
                {selectedSession.visitorPhone && (
                  <span className="text-[11px] bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                    {selectedSession.visitorPhone}
                  </span>
                )}
              </div>

              {/* Linked Customer Orders Card */}
              {linkedOrders.length > 0 && (
                <div className="bg-gold-50/70 border border-gold-200 rounded-xl p-2.5 text-xs text-navy-900 space-y-1.5">
                  <div className="font-bold flex items-center justify-between text-gold-900">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-gold-600" />
                      {isRtl
                        ? `הזמנה מקושרת ללקוח (${linkedOrders.length})`
                        : `Linked Customer Order (${linkedOrders.length})`}
                    </span>
                  </div>
                  {linkedOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-white p-2 rounded-lg border border-gold-200/80 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div>
                        <span className="font-extrabold text-navy-900">#{ord.id}</span> •{" "}
                        <span className="font-semibold text-navy-800">{ord.customerName}</span> (
                        <span className="text-primary-600">{ord.phone || "No phone"}</span>)
                        <div className="text-[11px] text-primary-500 mt-0.5">
                          Status: <span className="font-bold text-navy-900">{ord.status}</span>
                          {ord.result && ` • Result: ${ord.result}`}
                        </div>
                      </div>
                      <a
                        href={`/track?q=${ord.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] bg-navy-900 text-gold-400 font-bold px-2 py-1 rounded-lg shrink-0 flex items-center gap-1 hover:bg-navy-800 transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Track
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-primary-50/40 min-h-[340px]">
              {!selectedSession.messages || selectedSession.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-primary-400">
                  <MessageSquare className="w-10 h-10 text-primary-300 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-navy-800">
                    {isRtl ? "אין עדיין הודעות בשיחה זו" : "No messages recorded yet in this session"}
                  </p>
                </div>
              ) : (
                selectedSession.messages.map((msg) => {
                  const isAdmin = msg.sender === "admin";
                  const dateStr = new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAdmin ? "items-end" : "items-start"} space-y-1`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                          isAdmin
                            ? "bg-navy-900 text-white font-medium rounded-br-none"
                            : "bg-white border border-primary-200 text-navy-900 font-normal rounded-bl-none shadow-sm"
                        }`}
                      >
                        <div
                          className={`text-[10px] font-bold mb-1 flex items-center gap-1 ${
                            isAdmin ? "text-gold-400" : "text-primary-500"
                          }`}
                        >
                          {isAdmin ? (
                            <ShieldCheck className="w-3 h-3 text-gold-400" />
                          ) : (
                            <User className="w-3 h-3 text-primary-500" />
                          )}
                          {isAdmin
                            ? "Lab Representative (Staff / AI)"
                            : `Visitor #${selectedSession.shortId}`}
                        </div>
                        <p className={`whitespace-pre-wrap ${isRtl ? "text-right" : "text-left"}`}>{msg.text}</p>
                      </div>
                      <span className="text-[10px] text-primary-400 px-1">{dateStr}</span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Canned Replies Bar (תשובות מוכנות בלחיצה אחת) */}
            <div className="px-3.5 py-2 bg-primary-100/60 border-t border-primary-200/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-navy-800 shrink-0 flex items-center gap-1 mr-1">
                <Zap className="w-3 h-3 text-gold-600" />
                {isRtl ? "תשובות מוכנות:" : "Canned:"}
              </span>
              {cannedResponses.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => setReplyText(item.text)}
                    className="text-[11px] bg-white hover:bg-gold-50 text-navy-900 border border-primary-200 hover:border-gold-400 px-2.5 py-1 rounded-lg shrink-0 font-medium transition shadow-2xs flex items-center gap-1.5"
                  >
                    <IconComp className="w-3 h-3 text-gold-600 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Admin Input Bar */}
            <div className="p-3.5 border-t border-primary-200 bg-white space-y-2">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleSuggestAiReply}
                  disabled={isGeneratingAi}
                  className="flex items-center gap-1.5 text-xs text-gold-700 hover:text-gold-800 bg-gold-50 hover:bg-gold-100 border border-gold-200 px-3 py-1 rounded-lg transition font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5 text-gold-600 animate-spin-slow" />
                  {isGeneratingAi
                    ? isRtl
                      ? "יוצר מענה AI מותאם..."
                      : "Generating AI Suggestion..."
                    : isRtl
                    ? "הצעת מענה AI חכם"
                    : "Suggest AI Reply"}
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendAdminReply();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={
                    isRtl ? "הקלד תשובה לגולש באתר..." : "Type your reply to website visitor..."
                  }
                  className={`flex-1 px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-xl text-xs sm:text-sm text-navy-900 focus:outline-none focus:border-gold-400 font-medium ${
                    isRtl ? "text-right" : "text-left"
                  }`}
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSending}
                  className="px-5 py-2.5 bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold rounded-xl flex items-center gap-2 text-xs transition disabled:opacity-40 shadow-sm shrink-0"
                >
                  <Send className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
                  {isRtl ? "שלח תשובה" : "Send Reply"}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-primary-400">
            <MessageSquare className="w-12 h-12 text-primary-300 mb-3 stroke-[1.5]" />
            <p className="font-bold text-sm text-navy-800">
              {isRtl ? "בחר שיחת צ'אט מהרשימה בצד" : "Select a chat session from the list to reply"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
