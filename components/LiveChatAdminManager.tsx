"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { subscribeToAllChatSessions, addChatMessage, ChatSession, ChatMessage } from "@/lib/liveChat";

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevVisitorMsgCountRef = useRef<number>(-1);

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
    setSessions(newSessions);

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
        console.log("[LiveChat Sound] New visitor message detected! Playing chime sound.");
        playNotificationChime();
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

  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId) || sessions[0] || null;

  // Only scroll down when selected session changes or new messages arrive (fixes jumping bug)
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
          };
        }
        return s;
      })
    );

    try {
      await addChatMessage(selectedSession.sessionId, "admin", text);
      await fetchSessionsFromApi();
    } catch (err) {
      console.error("Failed to send admin chat reply:", err);
    } finally {
      setIsSending(false);
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
          phone: "LiveChat Visitor",
          messages: msgsToAnalyze,
          orders: [],
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

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const matchId = s.shortId?.toLowerCase().includes(q);
    const matchEmail = s.visitorEmail?.toLowerCase().includes(q);
    const matchPhone = s.visitorPhone?.toLowerCase().includes(q);
    const matchPage = s.currentPage?.toLowerCase().includes(q);
    const matchDevice = s.deviceInfo?.toLowerCase().includes(q);
    const matchText = s.messages?.some((m) => m.text.toLowerCase().includes(q));
    return matchId || matchEmail || matchPhone || matchPage || matchDevice || matchText;
  });

  return (
    <div className={`card p-0 bg-white border border-primary-200 shadow-sm rounded-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] max-h-[750px] ${isRtl ? "text-right dir-rtl" : "text-left"}`}>
      {/* Sidebar: Session List */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-primary-200 bg-primary-50/50 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-primary-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-navy-900 flex items-center gap-2 text-sm">
              <MessageSquare className="w-4 h-4 text-gold-500" />
              {isRtl ? "שיחות צ'אט חי" : "Live Chat Sessions"}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const nextSound = !soundEnabled;
                  setSoundEnabled(nextSound);
                  if (nextSound) playNotificationChime();
                }}
                title={soundEnabled ? (isRtl ? "התראות קוליות פעילות" : "Sound Alerts Active") : (isRtl ? "התראות קוליות כבויות" : "Sound Alerts Muted")}
                className={`p-1.5 rounded-lg border transition flex items-center justify-center ${
                  soundEnabled
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                }`}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
              </button>

              <button
                onClick={fetchSessionsFromApi}
                disabled={isRefreshing}
                title={isRtl ? "רענן רשימה" : "Refresh List"}
                className="p-1.5 text-primary-500 hover:text-navy-900 hover:bg-primary-100 rounded-lg transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <span className="text-xs bg-gold-100 text-gold-800 font-bold px-2 py-0.5 rounded-full border border-gold-200">
                {sessions.length}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-primary-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? "חפש לפי מזהה, דף, אימייל..." : "Search by ID, page, email..."}
              className="w-full pl-9 pr-3 py-1.5 bg-primary-50 border border-primary-200 rounded-xl text-xs focus:outline-none focus:border-gold-400 text-navy-900"
            />
          </div>
        </div>

        {/* Sessions Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-primary-100">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-primary-400 flex flex-col items-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary-300 stroke-[1.5]" />
              {isRtl ? "לא נמצאו שיחות צ'אט (לחץ רענון)" : "No live chat sessions found (click refresh)"}
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
                ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "";

              return (
                <button
                  key={session.sessionId}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                  className={`w-full p-3.5 text-left transition duration-150 flex flex-col gap-1.5 ${
                    isSelected
                      ? "bg-white border-l-4 border-l-gold-500 shadow-sm"
                      : "hover:bg-white/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-navy-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Visitor #{session.shortId}
                    </span>
                    <span className="text-[10px] text-primary-400 font-medium">{lastTime}</span>
                  </div>

                  {/* Current Page Badge */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {session.currentPage && (
                      <span className="text-[10px] bg-amber-50 text-amber-800 font-medium px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                        {session.currentPage === "/" ? "Homepage" : session.currentPage}
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

                  <p className="text-xs text-navy-700 line-clamp-1 font-normal">
                    {lastMsg ? `${lastMsg.sender === "user" ? "Visitor: " : "Lab: "}${lastMsg.text}` : `Chat #${session.shortId} (Active)`}
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
            <div className="p-4 border-b border-primary-200 bg-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-900 text-gold-400 flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                  #{selectedSession.shortId}
                </div>
                <div>
                  <h4 className="font-bold text-navy-900 text-sm flex items-center gap-2 flex-wrap">
                    Live Web Visitor #{selectedSession.shortId}
                    {selectedSession.currentPage && (
                      <span className="text-[11px] bg-amber-50 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                        🌐 Viewing: {selectedSession.currentPage === "/" ? "Homepage (/)" : selectedSession.currentPage}
                      </span>
                    )}
                    {selectedSession.deviceInfo && (
                      <span className="text-[11px] bg-purple-50 text-purple-700 font-bold px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                        💻 {selectedSession.deviceInfo}
                      </span>
                    )}
                    {selectedSession.visitorEmail && (
                      <span className="text-[11px] bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                        ✉️ {selectedSession.visitorEmail}
                      </span>
                    )}
                    {selectedSession.visitorPhone && (
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        📞 {selectedSession.visitorPhone}
                      </span>
                    )}
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      Active
                    </span>
                  </h4>
                  <p className="text-xs text-primary-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-primary-400" />
                    Started {new Date(selectedSession.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {selectedSession.referrer && ` • Source: ${selectedSession.referrer}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (soundEnabled) playNotificationChime();
                }}
                title={isRtl ? "נגן צליל דוגמה" : "Play Test Chime"}
                className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 shrink-0"
              >
                <Bell className="w-3.5 h-3.5 text-emerald-600" />
                {isRtl ? "צליל התראה" : "Sound Alert"}
              </button>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-primary-50/40 min-h-[350px]">
              {(!selectedSession.messages || selectedSession.messages.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-primary-400">
                  <MessageSquare className="w-10 h-10 text-primary-300 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-navy-800">
                    {isRtl ? "אין עדיין הודעות בשיחה זו" : "No messages recorded yet in this session"}
                  </p>
                  <p className="text-[11px] text-primary-400 mt-1">
                    {isRtl ? "תוכל לכתוב הודעה למטה כדי להשיב לגולש" : "Type a reply below to send a message to this visitor"}
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
                        <div className={`text-[10px] font-bold mb-1 flex items-center gap-1 ${isAdmin ? "text-gold-400" : "text-primary-500"}`}>
                          {isAdmin ? <ShieldCheck className="w-3 h-3 text-gold-400" /> : <User className="w-3 h-3 text-primary-500" />}
                          {isAdmin ? "Lab Representative (Admin / AI)" : `Visitor #${selectedSession.shortId}`}
                        </div>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <span className="text-[10px] text-primary-400 px-1">{dateStr}</span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
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
                  {isGeneratingAi ? (isRtl ? "יוצר מענה AI..." : "Generating AI Reply...") : (isRtl ? "הצעת מענה AI" : "Suggest AI Reply")}
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
                  placeholder={isRtl ? "הקלד תשובה לגולש באתר..." : "Type your reply to website visitor..."}
                  className="flex-1 px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-xl text-xs sm:text-sm text-navy-900 focus:outline-none focus:border-gold-400"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSending}
                  className="px-5 py-2.5 bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold rounded-xl flex items-center gap-2 text-xs transition disabled:opacity-40 shadow-sm shrink-0"
                >
                  <Send className="w-4 h-4" />
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
