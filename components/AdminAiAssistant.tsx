"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Trash2,
  Copy,
  Check,
  Bot,
  User,
  RefreshCw,
  PhoneCall,
  Package,
  Volume2,
  MapPin,
  HelpCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Mic,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { Order, CallRecord, Voicemail, DeliveryRequest } from "@/lib/db";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface AdminAiAssistantProps {
  isRtl: boolean;
  orders: Order[];
  calls: CallRecord[];
  voicemails: Voicemail[];
  deliveries: DeliveryRequest[];
  billingData?: any;
  isFloatingModal?: boolean;
  onCloseModal?: () => void;
}

export default function AdminAiAssistant({
  isRtl,
  orders,
  calls,
  voicemails,
  deliveries,
  billingData,
  isFloatingModal = false,
  onCloseModal,
}: AdminAiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: isRtl
        ? `שלום גרשי! 👋 אני עוזר ה-AI המנהלתי שלך במעבדת השעטנז. 
יש לי גישה חיה לכל יומני השיחות, ההזמנות, הודעות התא הקולי, בקשות המשלוח וההגדרות.

איך אוכל לעזור לך היום? תוכל לבחור אחת מהשאלות המהירות למטה או להקליד כל שאלה בחופשיות.`
        : `Hello Gershy! 👋 I am your Executive AI Assistant for The Shatnez Lab.
I have real-time access to all call logs, orders, voicemails, delivery requests, and system configurations.

How can I assist you today? You can tap any quick prompt below or ask anything in free text.`,
      timestamp: Date.now(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Quick prompt presets
  const quickPrompts = isRtl
    ? [
        { label: "📊 סיכום פעילות היום", query: "תן לי סיכום מנהלים קצר של כל מה שקרה היום במעבדה (שיחות, הזמנות, משלוחים ותא קולי)." },
        { label: "📞 שיחות היום", query: "כמה שיחות נכנסות ויוצאות היו היום? מה המתקשרים חיפשו ואיזה שלוחות הקישו?" },
        { label: "📦 הזמנות מוכנות לאיסוף", query: "כמה הזמנות מוכנות כרגע לאיסוף? תן לי רשימה של שמות הלקוחות והטלפונים שלהם." },
        { label: "📥 תא קולי חדש", query: "האם יש הודעות קוליות חדשות שלא נקראו? ממי הן ובאילו שעות התקבלו?" },
        { label: "🔬 ממצאי שעטנז", query: "באילו הזמנות נמצא שעטנז (Shatnez Found) ומה הסטטוס שלהן?" },
        { label: "🚚 בקשות משלוח פתוחות", query: "כמה בקשות משלוח ממתינות כרגע לטיפול ומה פרטי הלקוחות?" },
      ]
    : [
        { label: "📊 Today's Summary", query: "Give me an executive summary of today's operations (calls, orders, deliveries, and voicemails)." },
        { label: "📞 Today's Calls", query: "How many inbound and outbound calls were there today? What did callers search for or press?" },
        { label: "📦 Ready Orders", query: "Which orders are currently ready for pickup? List customer names and phone numbers." },
        { label: "📥 New Voicemails", query: "Are there any unread voicemails? Who left them and at what time?" },
        { label: "🔬 Shatnez Found", query: "Which orders had Shatnez detected (Shatnez Found) and what are their statuses?" },
        { label: "🚚 Pending Deliveries", query: "How many delivery requests are currently pending and who requested them?" },
      ];

  // Quick stats calculations
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const callsTodayCount = calls.filter((c) => c.timestamp >= startOfToday).length;
  const readyOrdersCount = orders.filter((o) => !o.archived && o.status === "ready").length;
  const unreadVmCount = voicemails.filter((v) => !v.read).length;
  const pendingDeliveriesCount = deliveries.filter((d) => d.status === "pending").length;

  const handleSendMessage = async (userQuery?: string) => {
    const queryToSend = (userQuery || input).trim();
    if (!queryToSend || isLoading) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      text: queryToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!userQuery) setInput("");
    setIsLoading(true);

    try {
      // Build conversation history for context
      const historyPayload = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role === "user" ? "user" : "model",
          text: m.text,
        }));

      // Gather client data snapshot
      const clientData = {
        orders,
        calls,
        voicemails,
        deliveries,
        billingData,
      };

      const res = await fetch("/api/gemini/admin-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryToSend,
          history: historyPayload,
          isRtl,
          clientData,
        }),
      });

      const data = await res.json();

      if (data.success && data.reply) {
        const botMsg: Message = {
          id: `bot_${Date.now()}`,
          role: "assistant",
          text: data.reply,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        const errorMsg: Message = {
          id: `bot_err_${Date.now()}`,
          role: "assistant",
          text: isRtl
            ? `⚠️ שגיאה: ${data.error || "לא ניתן היה לקבל תשובה משרת ה-AI."}`
            : `⚠️ Error: ${data.error || "Failed to generate AI response."}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      console.error("AI Assistant query error:", err);
      const errorMsg: Message = {
        id: `bot_net_err_${Date.now()}`,
        role: "assistant",
        text: isRtl
          ? "⚠️ שגיאת תקשורת בחיבור לשרת ה-AI. אנא נסה שוב."
          : "⚠️ Network error connecting to AI service. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleClearHistory = () => {
    if (
      confirm(
        isRtl
          ? "האם אתה בטוח שברצונך לנקות את היסטוריית השיחה הנוכחית?"
          : "Are you sure you want to clear the current chat history?"
      )
    ) {
      setMessages([
        {
          id: "welcome_reset",
          role: "assistant",
          text: isRtl
            ? "השיחה אופסה. מה תרצה לבדוק כעת?"
            : "Chat reset. What would you like to look up now?",
          timestamp: Date.now(),
        },
      ]);
    }
  };

  // Helper for rendering simple markdown
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className="font-bold text-navy-950 text-sm mt-3 mb-1">
            {line.replace("### ", "")}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={idx} className="font-extrabold text-navy-950 text-base mt-4 mb-2 border-b border-primary-100 pb-1">
            {line.replace("## ", "")}
          </h3>
        );
      }
      if (line.startsWith("# ")) {
        return (
          <h2 key={idx} className="font-black text-navy-950 text-lg mt-4 mb-2">
            {line.replace("# ", "")}
          </h2>
        );
      }

      // Bullet points
      if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
        const content = line.trim().substring(2);
        return (
          <div key={idx} className="flex items-start gap-2 my-1 leading-relaxed">
            <span className="text-gold-500 font-bold mt-1 text-xs">•</span>
            <span className="flex-1">{parseBold(content)}</span>
          </div>
        );
      }

      // Numbered list
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={idx} className="flex items-start gap-2 my-1.5 leading-relaxed">
            <span className="bg-primary-100 text-navy-900 font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0">
              {numMatch[1]}
            </span>
            <span className="flex-1">{parseBold(numMatch[2])}</span>
          </div>
        );
      }

      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      // Normal paragraph
      return (
        <p key={idx} className="my-1 leading-relaxed">
          {parseBold(line)}
        </p>
      );
    });
  };

  // Helper to parse **bold** text inside strings
  const parseBold = (str: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-navy-950">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div
      className={`bg-white rounded-3xl border border-primary-200 shadow-xl overflow-hidden flex flex-col ${
        isFloatingModal ? "h-[620px] max-h-[85vh]" : "min-h-[650px] max-h-[800px]"
      } ${isRtl ? "text-right" : "text-left"}`}
    >
      {/* 1. Header Bar */}
      <div className="p-4 sm:p-5 border-b border-primary-100 bg-gradient-to-r from-navy-900 via-navy-900 to-navy-950 text-white flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gold-400/20 border border-gold-400/40 flex items-center justify-center text-gold-400 shadow-inner shrink-0">
            <Sparkles className="w-5 h-5 text-gold-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base sm:text-lg text-white">
                {isRtl ? "עוזר AI למנהל" : "Executive AI Assistant"}
              </h2>
              <span className="bg-gold-500/20 text-gold-300 border border-gold-400/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live Gemini 2.5
              </span>
            </div>
            <p className="text-xs text-navy-300">
              {isRtl
                ? "ניתוח נתונים, סטטיסטיקות ותשובות בזמן אמת על פעילות המעבדה"
                : "Real-time lab operations analysis, call statistics & order tracking"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearHistory}
            title={isRtl ? "נקה שיחה" : "Clear Chat"}
            className="p-2 text-navy-400 hover:text-white hover:bg-navy-800 rounded-xl transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {isFloatingModal && onCloseModal && (
            <button
              onClick={onCloseModal}
              title={isRtl ? "סגור" : "Close"}
              className="p-2 text-navy-400 hover:text-white hover:bg-navy-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Live Metrics Bar */}
      <div className="bg-primary-50/70 border-b border-primary-200/80 px-4 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-primary-100 shadow-xs">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <PhoneCall className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] text-primary-400 block font-medium">
              {isRtl ? "שיחות היום" : "Calls Today"}
            </span>
            <span className="font-bold text-navy-950">{callsTodayCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-primary-100 shadow-xs">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] text-primary-400 block font-medium">
              {isRtl ? "מוכן לאיסוף" : "Ready Orders"}
            </span>
            <span className="font-bold text-navy-950">{readyOrdersCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-primary-100 shadow-xs">
          <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] text-primary-400 block font-medium">
              {isRtl ? "תא קולי חדש" : "Unread Voicemails"}
            </span>
            <span className="font-bold text-navy-950">{unreadVmCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-primary-100 shadow-xs">
          <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] text-primary-400 block font-medium">
              {isRtl ? "משלוחים ממתינים" : "Pending Deliveries"}
            </span>
            <span className="font-bold text-navy-950">{pendingDeliveriesCount}</span>
          </div>
        </div>
      </div>

      {/* 3. Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-primary-50/20">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const dateStr = new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm shadow-sm leading-relaxed relative group ${
                  isUser
                    ? "bg-navy-900 text-white rounded-br-none font-medium"
                    : "bg-white text-navy-900 border border-primary-200 rounded-bl-none font-normal"
                }`}
              >
                {/* Header tag */}
                <div
                  className={`text-[10px] font-bold mb-1.5 flex items-center justify-between gap-3 ${
                    isUser ? "text-gold-400" : "text-primary-500"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isUser ? (
                      <>
                        <User className="w-3 h-3 text-gold-400" />
                        <span>{isRtl ? "אתה (מנהל המעבדה)" : "You (Admin)"}</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-gold-600" />
                        <span>{isRtl ? "עוזר AI למנהל" : "Executive AI"}</span>
                      </>
                    )}
                  </div>

                  {!isUser && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      title={isRtl ? "העתק תשובה" : "Copy response"}
                      className="opacity-60 hover:opacity-100 text-primary-400 hover:text-navy-900 transition flex items-center gap-1 text-[10px]"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-semibold">{isRtl ? "הועתק" : "Copied"}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{isRtl ? "העתק" : "Copy"}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="whitespace-pre-wrap">
                  {isUser ? msg.text : renderFormattedText(msg.text)}
                </div>
              </div>

              <span className="text-[10px] text-primary-400 px-1 font-mono">{dateStr}</span>
            </motion.div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2"
          >
            <div className="bg-white border border-primary-200 rounded-2xl rounded-bl-none p-3.5 shadow-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold-500 animate-spin-slow" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-primary-600 font-medium">
                  {isRtl ? "מנתח נתונים ומכין תשובה..." : "Analyzing lab data & preparing answer..."}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Quick Question Chips */}
      <div className="border-t border-primary-100 bg-white px-3.5 py-2.5">
        <div className="text-[10px] text-primary-400 font-semibold mb-1.5 uppercase tracking-wider">
          {isRtl ? "שאלות מהירות:" : "Quick Questions:"}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p.query)}
              disabled={isLoading}
              className="px-2.5 py-1 bg-primary-50 hover:bg-gold-50 hover:border-gold-300 border border-primary-200 rounded-lg text-xs text-navy-800 hover:text-gold-900 transition font-medium whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Input Area */}
      <div className="p-3.5 border-t border-primary-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isRtl
                ? "שאל את העוזר כל שאלה (למשל: כמה שיחות נכנסו היום? מי מחכה למשלוח?)..."
                : "Ask the assistant anything (e.g. how many calls today? which orders are ready?)..."
            }
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-xl text-xs sm:text-sm text-navy-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-5 py-2.5 bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm transition disabled:opacity-40 shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{isRtl ? "שלח" : "Send"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
