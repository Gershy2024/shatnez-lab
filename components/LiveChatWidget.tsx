"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  CheckCheck,
} from "lucide-react";
import { subscribeToChatSession, ChatMessage, ChatSession } from "@/lib/liveChat";

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

export function LiveChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [shortId, setShortId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize session ID & restore cached chat history from localStorage
  useEffect(() => {
    let storedSession = localStorage.getItem("shatnez_chat_session_id");
    if (!storedSession) {
      storedSession = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem("shatnez_chat_session_id", storedSession);
    }
    setSessionId(storedSession);

    // Restore cached shortId & messages immediately so they persist on page refresh
    const cachedShortId = localStorage.getItem(`shatnez_chat_short_id_${storedSession}`);
    if (cachedShortId) setShortId(cachedShortId);

    const cachedMsgs = localStorage.getItem(`shatnez_chat_messages_${storedSession}`);
    if (cachedMsgs) {
      try {
        const parsed = JSON.parse(cachedMsgs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error("Error parsing cached chat messages:", e);
      }
    }
  }, []);

  // Save messages to localStorage whenever they update
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`shatnez_chat_messages_${sessionId}`, JSON.stringify(messages));
    }
  }, [sessionId, messages]);

  // Save shortId to localStorage whenever it updates
  useEffect(() => {
    if (sessionId && shortId) {
      localStorage.setItem(`shatnez_chat_short_id_${sessionId}`, shortId);
    }
  }, [sessionId, shortId]);

  // Subscribe to real-time chat updates & active HTTP polling with page & device metadata
  useEffect(() => {
    if (!sessionId) return;

    const fetchSessionData = () => {
      const pageParam = encodeURIComponent(window.location.pathname || "/");
      const deviceParam = encodeURIComponent(getDeviceInfo());
      let refParam = "Direct Visit";
      try {
        if (document.referrer) {
          refParam = new URL(document.referrer).hostname;
        }
      } catch (e) {}

      fetch(`/api/chat/session?sessionId=${sessionId}&page=${pageParam}&device=${deviceParam}&ref=${encodeURIComponent(refParam)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.session) {
            if (data.session.shortId) {
              setShortId(data.session.shortId);
              localStorage.setItem(`shatnez_chat_short_id_${sessionId}`, data.session.shortId);
            }
            if (Array.isArray(data.session.messages) && data.session.messages.length > 0) {
              setMessages(data.session.messages);
              localStorage.setItem(`shatnez_chat_messages_${sessionId}`, JSON.stringify(data.session.messages));
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
          setMessages(sessionData.messages);
        }

        // Calculate unread count if chat is closed
        if (!isOpen && sessionData.messages && sessionData.messages.length > 0) {
          const lastMsg = sessionData.messages[sessionData.messages.length - 1];
          if (lastMsg.sender === "admin") {
            setUnreadCount((prev) => (prev > 0 ? prev : 1));
          }
        }
      }
    });

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [sessionId, isOpen, pathname]);

  // Focus input and scroll when widget opens
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 150);

      // Instant re-sync with server when user opens the chat bubble
      if (sessionId) {
        const pageParam = encodeURIComponent(window.location.pathname || "/");
        const deviceParam = encodeURIComponent(getDeviceInfo());

        fetch(`/api/chat/session?sessionId=${sessionId}&page=${pageParam}&device=${deviceParam}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.session && Array.isArray(data.session.messages)) {
              setMessages(data.session.messages);
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, sessionId]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

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
      if (data.success && data.session) {
        if (data.session.shortId) {
          setShortId(data.session.shortId);
          localStorage.setItem(`shatnez_chat_short_id_${sessionId}`, data.session.shortId);
        }
        if (Array.isArray(data.session.messages) && data.session.messages.length > 0) {
          setMessages(data.session.messages);
          localStorage.setItem(`shatnez_chat_messages_${sessionId}`, JSON.stringify(data.session.messages));
        }
      }
    } catch (err) {
      console.error("Failed to send chat message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const quickPrompts = [
    "What are your lab opening hours?",
    "Where is the drop-off location?",
    "How can I check my order status?",
  ];

  // Hide chat widget completely on admin dashboard pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans dir-ltr text-left">
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center gap-3 bg-navy-900 hover:bg-navy-800 text-white px-5 py-3.5 rounded-full shadow-2xl hover:shadow-gold-500/30 hover:scale-105 transition-all duration-300 border border-gold-400/50"
          aria-label="Open Live Support Chat"
        >
          {/* Subtle Glow Ring */}
          <span className="absolute -inset-1 rounded-full bg-gold-400/25 blur-md group-hover:bg-gold-400/50 transition duration-300 animate-pulse"></span>

          <div className="relative flex items-center gap-2.5">
            <div className="relative">
              <MessageCircle className="w-6 h-6 text-gold-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-navy-900 rounded-full animate-ping"></span>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-navy-900 rounded-full"></span>
            </div>

            <span className="font-bold text-sm tracking-wide text-white pr-1">
              Live Chat
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
        <div className="w-[94vw] sm:w-[390px] h-[600px] max-h-[85vh] bg-white border border-primary-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300 text-navy-900">
          
          {/* Header */}
          <div className="relative bg-gradient-to-r from-navy-900 via-navy-800 to-navy-950 p-4 border-b border-navy-700/80 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-gold-500 via-gold-400 to-gold-300 p-[2px] shadow-md">
                  <div className="w-full h-full bg-navy-900 rounded-[14px] flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-gold-400" />
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-navy-900 rounded-full"></span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-white text-base tracking-tight">The Shatnez Lab</h3>
                  <span className="text-[10px] bg-gold-500/20 text-gold-300 font-semibold px-2 py-0.5 rounded-full border border-gold-500/30">
                    Support
                  </span>
                </div>
                <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Online • Lab Representative
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
              aria-label="Close Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Body - Light Warm Cream Background for High Contrast */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-primary-50/70 scrollbar-thin scrollbar-thumb-primary-200">
            {/* Welcome banner */}
            <div className="bg-white border border-gold-300/60 rounded-2xl p-4 text-center text-xs text-navy-800 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-center gap-1.5 text-gold-600 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-gold-500" />
                Welcome to The Shatnez Lab
              </div>
              <p className="text-navy-700 text-xs leading-relaxed">
                Have a question about garment testing, drop-off, or order status? Ask us below and we will assist you immediately.
              </p>
            </div>

            {/* Quick Prompts */}
            {messages.length === 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-navy-800 text-left">Frequently Asked Questions:</p>
                <div className="flex flex-col gap-2">
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="text-left text-xs bg-white hover:bg-gold-50 text-navy-800 font-medium border border-primary-200 hover:border-gold-400 p-3 rounded-xl transition duration-200 flex items-center justify-between group shadow-sm"
                    >
                      <span>{prompt}</span>
                      <ChevronRight className="w-4 h-4 text-gold-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                    </button>
                  ))}
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
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "bg-gradient-to-r from-gold-500 to-gold-600 text-white font-medium rounded-br-none"
                        : "bg-navy-900 text-white font-normal rounded-bl-none border border-navy-800"
                    }`}
                  >
                    {!isUser && (
                      <div className="text-[11px] font-bold text-gold-400 mb-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                        Lab Specialist
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-left">{msg.text}</p>
                  </div>
                  <span className="text-[10px] text-navy-400 font-medium px-1 flex items-center gap-1">
                    {dateStr}
                    {isUser && <CheckCheck className="w-3.5 h-3.5 text-gold-600" />}
                  </span>
                </div>
              );
            })}

            {/* Sending indicator */}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-navy-900 text-slate-200 px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 rounded-bl-none shadow-sm">
                  <span className="w-2 h-2 bg-gold-400 rounded-full animate-ping"></span>
                  Sending message...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Area - High Contrast Light */}
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
                placeholder="Type your message..."
                className="flex-1 bg-transparent text-xs sm:text-sm text-navy-900 placeholder-navy-400 outline-none text-left py-1.5 font-medium"
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="w-9 h-9 rounded-xl bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold flex items-center justify-center disabled:opacity-40 transition shadow-md"
                aria-label="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-navy-500 font-semibold px-1 mt-2">
              <span>Live Lab Representative</span>
              {shortId && <span>Ref ID: #{shortId}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
