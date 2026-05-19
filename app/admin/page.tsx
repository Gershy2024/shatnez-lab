"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Plus, Trash2, Save, X, Package, Search, LogOut, Printer, Volume2, Copy, Music, FileAudio, Play, Pause, FileText, Network, Webhook, Sliders, CreditCard, RefreshCw } from "lucide-react";
import PrintCard from "@/components/PrintCard";
import { Order, OrderStatus, subscribeToOrders, saveOrder, deleteOrder, getAdminSettings, saveAdminSettings, getAudioFiles, uploadAudioFile, deleteAudioFile, AudioFileInfo } from "@/lib/db";
import { Settings, Phone, Info, Microscope, ShieldCheck, MapPin } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function AdminPage() {
  const { t, isRtl } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    status: "received",
    dateReceived: new Date().toISOString().split("T")[0],
    estimatedCompletion: "",
    notes: "",
    result: "",
    phone: "",
  });
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminPin, setAdminPin] = useState("1234");
  const [forwardingNumber, setForwardingNumber] = useState("8457092022");
  const [showSettings, setShowSettings] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newForwardingNumber, setNewForwardingNumber] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [ivrGeneralEn, setIvrGeneralEn] = useState("");
  const [ivrGeneralHe, setIvrGeneralHe] = useState("");
  const [ivrSpecialEn, setIvrSpecialEn] = useState("");
  const [ivrSpecialHe, setIvrSpecialHe] = useState("");

  const [audioFiles, setAudioFiles] = useState<AudioFileInfo[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [playingName, setPlayingName] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [activeBlueprintTab, setActiveBlueprintTab] = useState("flow");
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  const [adminNotes, setAdminNotes] = useState("");

  const [notifications, setNotifications] = useState<{ id: string; message: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
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
      setForwardingNumber(s.forwardingNumber);
      setNewPin(s.pin);
      setNewForwardingNumber(s.forwardingNumber);
      setIvrGeneralEn(s.ivrGeneralEn || "");
      setIvrGeneralHe(s.ivrGeneralHe || "");
      setIvrSpecialEn(s.ivrSpecialEn || "");
      setIvrSpecialHe(s.ivrSpecialHe || "");
      setAdminNotes(s.adminNotes || "");
    });

    loadAudioFiles();

    const unsub = subscribeToOrders((data) => {
      setOrders(data);
      setLoading(false);
    });
    return () => unsub();
  }, [isAuthenticated]);

  useEffect(() => {
    getAdminSettings().then(s => {
      setAdminPin(s.pin);
      setForwardingNumber(s.forwardingNumber);
      setNewPin(s.pin);
      setNewForwardingNumber(s.forwardingNumber);
      setIvrGeneralEn(s.ivrGeneralEn || "");
      setIvrGeneralHe(s.ivrGeneralHe || "");
      setIvrSpecialEn(s.ivrSpecialEn || "");
      setIvrSpecialHe(s.ivrSpecialHe || "");
      setAdminNotes(s.adminNotes || "");
    });
    if (isAuthenticated) {
      loadAudioFiles();
    }
  }, [isAuthenticated]);

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

  const handleCopyAudioUrl = (name: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/audio?name=${name.toLowerCase().trim()}`;
    navigator.clipboard.writeText(url);
    showToast(isRtl ? `הקישור הועתק ללוח ויכול לשמש ב-Twilio!` : `Link copied to clipboard for use in Twilio!`, "success");
  };

  const handleTogglePlay = (name: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/audio?name=${name.toLowerCase().trim()}`;

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
    if (pin === adminPin) {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const updatedPin = newPin.length === 4 ? newPin : adminPin;
      const updatedForwarding = newForwardingNumber || forwardingNumber;
      
      await saveAdminSettings({ 
        pin: updatedPin,
        forwardingNumber: updatedForwarding,
        ivrGeneralEn,
        ivrGeneralHe,
        ivrSpecialEn,
        ivrSpecialHe,
        adminNotes
      });
      
      setAdminPin(updatedPin);
      setForwardingNumber(updatedForwarding);
      setNewPin(updatedPin);
      setNewForwardingNumber(updatedForwarding);
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
      return match ? parseInt(match[1], 10) : 0;
    });
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    const next = max < 100 ? 101 : max + 1;
    return String(next);
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.customerName) return;

    const nextId = generateNextId();

    const order: Order = {
      id: nextId,
      customerName: newOrder.customerName,
      phone: newOrder.phone || "",
      status: (newOrder.status as OrderStatus) || "received",
      dateReceived: newOrder.dateReceived || new Date().toISOString().split("T")[0],
      estimatedCompletion: newOrder.estimatedCompletion || "",
      notes: newOrder.notes || "",
      result: newOrder.result || "",
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
    });
  };

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    await saveOrder({ ...order, status });
  };

  const updateResult = async (orderId: string, result: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    await saveOrder({ ...order, result });
  };

  const handleDelete = async (orderId: string) => {
    if (confirm(isRtl ? "האם אתה בטוח שברצונך למחוק הזמנה זו?" : "Are you sure you want to delete this order?")) {
      await deleteOrder(orderId);
    }
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.phone && o.phone.includes(searchQuery))
  );

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
              <p className="text-sm text-primary-500 mt-1">{t("enter_pin")}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
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
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-300px)] bg-primary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
          <div className={isRtl ? "text-right" : ""}>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900">{t("orders_management")}</h1>
            <p className="text-primary-600 mt-1">{isRtl ? "נהל ועקוב אחר כל הזמנות הלקוחות" : "Manage and track all customer orders"}</p>
          </div>
          <div className={`flex flex-col sm:flex-row items-center gap-3 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-navy-600 hover:bg-navy-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              {t("phone_settings")}
            </button>
            <button
              onClick={() => setShowBlueprintModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gold-600 hover:bg-gold-50 transition-colors"
            >
              <FileAudio className="w-4 h-4" />
              {isRtl ? "מפת מערכת IVR" : "IVR System Blueprint"}
            </button>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                localStorage.removeItem("admin_authenticated");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-primary-600 hover:text-navy-900 hover:bg-primary-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t("logout")}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isRtl ? "direction-rtl" : ""}`}>
                {/* Admin PIN Change */}
                <div className={`card p-6 bg-white shadow-sm border border-navy-100 ${isRtl ? "text-right" : ""}`}>
                  <div className={`flex items-center gap-2 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <Lock className="w-5 h-5 text-navy-600" />
                    <h2 className="text-lg font-bold text-navy-900">{isRtl ? "שינוי קוד מנהל" : "Change Admin PIN"}</h2>
                  </div>
                  <p className="text-sm text-primary-600 mb-4">
                    {isRtl ? "הקוד משמש לכניסה לאתר ולתפריט הניהול הטלפוני." : "This PIN is used for both website access and phone admin menu."}
                  </p>
                  <div className="space-y-4">
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
                        placeholder="e.g. 8457092022"
                        className={`w-full px-3 py-2 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none ${isRtl ? "text-right" : ""}`}
                      />
                    </div>
                    <button 
                      onClick={handleUpdateSettings}
                      className="btn-primary w-full py-2"
                    >
                      {isRtl ? "עדכן הגדרות" : "Update Settings"}
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

                {/* IVR Audio Files Manager */}
                <div className={`card p-6 bg-white shadow-sm border border-navy-100 lg:col-span-1 flex flex-col justify-between ${isRtl ? "text-right" : ""}`}>
                  <div>
                    <div className={`flex items-center gap-2 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <Volume2 className="w-5 h-5 text-navy-600" />
                      <h2 className="text-lg font-bold text-navy-900">{isRtl ? "ניהול קבצי שמע ל-IVR" : "IVR Audio Manager"}</h2>
                    </div>
                    <p className="text-xs text-primary-600 mb-4">
                      {isRtl 
                        ? "העלה קבצי MP3 (עד 1MB) כדי לקבל קישורים שתוכל להדביק בווידג'טים של Twilio Studio (למשל welcome, info, vip)." 
                        : "Upload custom MP3 audio files (max 1MB) to generate links you can paste directly into Twilio Studio."}
                    </p>

                    {/* Upload Form */}
                    <form onSubmit={handleUploadAudio} className="space-y-3 mb-4 pb-4 border-b border-primary-100">
                      <div>
                        <label className="block text-xs font-semibold text-primary-500 mb-1 uppercase">{isRtl ? "שם הקובץ (באנגלית בלבד)" : "Audio File Name (English)"}</label>
                        <input
                          type="text"
                          required
                          value={audioName}
                          onChange={(e) => setAudioName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                          placeholder="e.g. welcome, info, vip"
                          className={`w-full px-3 py-1.5 rounded-lg border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-xs ${isRtl ? "text-right" : ""}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-primary-500 mb-1 uppercase">{isRtl ? "קובץ MP3" : "Select MP3 File"}</label>
                        <input
                          id="audio-file-input"
                          type="file"
                          required
                          accept="audio/mpeg, audio/mp3"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setAudioFile(e.target.files[0]);
                            }
                          }}
                          className={`w-full text-xs text-primary-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-navy-50 file:text-navy-700 hover:file:bg-navy-100 cursor-pointer`}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isUploading}
                        className="btn-primary w-full py-1.5 text-xs inline-flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isUploading ? (isRtl ? "מעלה..." : "Uploading...") : (isRtl ? "העלה קובץ" : "Upload File")}
                      </button>
                    </form>

                    {/* Audio Files List */}
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">{isRtl ? "קבצים שהועלו:" : "Uploaded Files:"}</h3>
                      {audioFiles.length === 0 ? (
                        <p className="text-xs text-primary-400 italic text-center py-2">{isRtl ? "אין קבצים" : "No custom audio files"}</p>
                      ) : (
                        audioFiles.map((file) => (
                          <div key={file.name} className={`flex items-center justify-between p-2 bg-primary-50 rounded-lg border border-primary-100 text-xs ${isRtl ? "flex-row-reverse" : ""}`}>
                            <div className="flex items-center gap-1.5 truncate">
                              <Music className="w-3.5 h-3.5 text-navy-500 shrink-0" />
                              <span className="font-medium text-navy-800 truncate" title={file.name}>
                                {file.name}.mp3
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleTogglePlay(file.name)}
                                className={`p-1 rounded transition-colors ${
                                  playingName === file.name 
                                    ? "text-gold-600 bg-gold-50 hover:bg-gold-100" 
                                    : "text-navy-500 hover:text-navy-700 hover:bg-navy-100"
                                }`}
                                title={playingName === file.name ? (isRtl ? "עצור שמיעה" : "Pause preview") : (isRtl ? "שמע קובץ" : "Play preview")}
                              >
                                {playingName === file.name ? (
                                  <Pause className="w-3.5 h-3.5 animate-pulse" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => handleCopyAudioUrl(file.name)}
                                className="p-1 rounded text-navy-500 hover:text-navy-700 hover:bg-navy-100 transition-colors"
                                title={isRtl ? "העתק קישור" : "Copy URL"}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAudio(file.name)}
                                className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                title={isRtl ? "מחק קובץ" : "Delete file"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
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
                      value={newOrder.phone || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })}
                      placeholder="845-709-2022"
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

        {/* Orders Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`bg-primary-50 border-b border-primary-100 ${isRtl ? "text-right" : "text-left"}`}>
                  <th className={`px-6 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>Order ID</th>
                  <th className={`px-6 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("customer")}</th>
                  <th className={`px-6 py-4 text-sm font-semibold text-navy-800 hidden md:table-cell ${isRtl ? "text-right" : "text-left"}`}>{t("phone")}</th>
                  <th className={`px-6 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("status")}</th>
                  <th className={`px-6 py-4 text-sm font-semibold text-navy-800 hidden sm:table-cell ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "התקבל" : "Received"}</th>
                  <th className={`px-6 py-4 text-sm font-semibold text-navy-800 hidden lg:table-cell ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "סיום משוער" : "Est. Completion"}</th>
                  <th className={`px-6 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "תוצאה" : "Result"}</th>
                  <th className={`px-6 py-4 text-sm font-semibold text-navy-800 ${isRtl ? "text-right" : "text-left"}`}>{t("actions")}</th>
                </tr>
              </thead>
              <tbody className={isRtl ? "text-right" : "text-left"}>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-primary-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-primary-300" />
                      <p>{isRtl ? "לא נמצאו הזמנות" : "No orders found"}</p>
                      {searchQuery && <p className="text-sm mt-1">{isRtl ? "נסה לשנות את החיפוש" : "Try adjusting your search"}</p>}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-primary-50 hover:bg-primary-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-navy-900">{order.id}</td>
                      <td className="px-6 py-4 text-primary-700">{order.customerName}</td>
                      <td className="px-6 py-4 text-primary-600 hidden md:table-cell">
                        {order.phone ? (
                          <a href={`tel:${order.phone}`} className="hover:text-navy-600 hover:underline">
                            {order.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                          className={`px-3 py-1.5 rounded-lg border border-primary-200 bg-white text-sm
                                   focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                                   cursor-pointer ${isRtl ? "text-right" : ""}`}
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-primary-600 hidden sm:table-cell">{order.dateReceived}</td>
                      <td className="px-6 py-4 text-primary-600 hidden lg:table-cell">{order.estimatedCompletion || "—"}</td>
                      <td className="px-6 py-4">
                        <select
                          value={order.result || ""}
                          onChange={(e) => updateResult(order.id, e.target.value)}
                          className={`w-full px-2 py-1 text-sm rounded border border-primary-200 bg-white
                                   focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-transparent
                                   cursor-pointer ${isRtl ? "text-right" : ""}`}
                        >
                          {resultOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className={`px-6 py-4 ${isRtl ? "text-left" : "text-right"}`}>
                        <button
                          onClick={() => setPrintOrder(order)}
                          className="p-2 rounded-lg text-navy-400 hover:text-navy-600 hover:bg-navy-50 transition-colors mr-1"
                          title={isRtl ? "הדפס כרטיס" : "Print card"}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={isRtl ? "מחק הזמנה" : "Delete order"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {printOrder && (
          <PrintCard order={printOrder} onClose={() => setPrintOrder(null)} />
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
                  onClick={() => setActiveBlueprintTab("audio")}
                  className={`px-4 py-2 rounded-lg transition-colors shrink-0 focus:outline-none flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : ""}`}
                  style={{
                    backgroundColor: activeBlueprintTab === "audio" ? "#0f172a" : "transparent",
                    color: activeBlueprintTab === "audio" ? "#ffffff" : "#0369a1"
                  }}
                >
                  <Volume2 className="w-4 h-4 shrink-0" />
                  <span>{isRtl ? "ניהול קבצי קול (IVR)" : "IVR Audio Manager"}</span>
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
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. IVR AUDIO MANAGER TAB */}
                {activeBlueprintTab === "audio" && (
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isRtl ? "text-right" : ""}`}>
                    {/* Upload Card */}
                    <div className="bg-white border border-primary-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
                          <Volume2 className="w-5 h-5 text-gold-600" />
                          <h3 className="text-lg font-bold text-navy-900">{isRtl ? "העלה קובץ שמע חדש (MP3)" : "Upload Custom MP3"}</h3>
                        </div>
                        <p className="text-xs text-primary-600 mb-4 leading-relaxed">
                          {isRtl 
                            ? "הורד קובץ שמע מ-ElevenLabs, תן לו שם קצר באנגלית (למשל: welcome) והעלה אותו לכאן כדי לקבל קישור ישיר ל-Twilio Studio." 
                            : "Download an MP3 from ElevenLabs, name it (e.g. welcome) and upload it here to get an instant Twilio link."}
                        </p>
                        
                        <form onSubmit={handleUploadAudio} className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-primary-500 mb-1 uppercase">
                              {isRtl ? "שם הקובץ (באנגלית בלבד, ללא רווחים)" : "Audio File Name (English only)"}
                            </label>
                            <input
                              type="text"
                              required
                              value={audioName}
                              onChange={(e) => setAudioName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                              placeholder="e.g. welcome, info, vip"
                              className={`w-full px-3 py-2 rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-primary-500 mb-1 uppercase">
                              {isRtl ? "בחר קובץ MP3" : "Select MP3 File"}
                            </label>
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
                              className={`w-full text-sm text-primary-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-navy-50 file:text-navy-700 hover:file:bg-navy-100 cursor-pointer`}
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isUploading}
                            className="btn-primary w-full py-2.5 text-sm inline-flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            {isUploading ? (isRtl ? "מעלה קובץ..." : "Uploading...") : (isRtl ? "העלה קובץ שמע" : "Upload Audio")}
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Library Card */}
                    <div className="bg-white border border-primary-100 rounded-2xl p-6 shadow-sm flex flex-col">
                      <div className={`flex items-center justify-between border-b border-primary-100 pb-3 mb-4 ${isRtl ? "flex-row-reverse" : ""}`}>
                        <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                          <Music className="w-5 h-5 text-navy-600" />
                          <h3 className="text-lg font-bold text-navy-900">{isRtl ? "ספריית קבצי הקול שלך" : "Your Audio Library"}</h3>
                        </div>
                        <span className="text-xs bg-navy-50 text-navy-700 px-2 py-0.5 rounded-full font-bold">
                          {audioFiles.length} {isRtl ? "קבצים" : "Files"}
                        </span>
                      </div>

                      <div className="space-y-2 flex-1 max-h-[300px] overflow-y-auto pr-1">
                        {audioFiles.length === 0 ? (
                          <div className="text-center py-12 text-primary-400">
                            <Music className="w-12 h-12 mx-auto mb-2 text-primary-200" />
                            <p className="text-xs italic">{isRtl ? "אין קבצי קול מועלים עדיין" : "No uploaded audio files yet"}</p>
                          </div>
                        ) : (
                          audioFiles.map((file) => (
                            <div key={file.name} className={`flex items-center justify-between p-3 bg-primary-50 hover:bg-primary-100/50 rounded-xl border border-primary-100 text-sm transition-colors ${isRtl ? "flex-row-reverse" : ""}`}>
                              <div className="flex items-center gap-2.5 truncate">
                                <FileAudio className="w-5 h-5 text-navy-500 shrink-0" />
                                <div className="truncate text-left font-sans">
                                  <span className="font-bold text-navy-800 truncate block text-xs md:text-sm" title={file.name}>
                                    {file.name}.mp3
                                  </span>
                                  <span className="text-[10px] text-primary-400 block">
                                    {new Date(file.uploadedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleTogglePlay(file.name)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    playingName === file.name 
                                      ? "text-gold-600 bg-gold-50 hover:bg-gold-100" 
                                      : "text-navy-500 hover:text-navy-700 hover:bg-navy-100"
                                  }`}
                                  title={playingName === file.name ? (isRtl ? "עצור" : "Pause") : (isRtl ? "שמע קובץ" : "Play")}
                                >
                                  {playingName === file.name ? (
                                    <Pause className="w-4 h-4 animate-pulse" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleCopyAudioUrl(file.name)}
                                  className="p-1.5 rounded-lg text-navy-500 hover:text-navy-700 hover:bg-navy-100 border border-primary-100 bg-white transition-colors"
                                  title={isRtl ? "העתק קישור ל-Twilio" : "Copy Twilio URL"}
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAudio(file.name)}
                                  className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 border border-primary-100 bg-white transition-colors"
                                  title={isRtl ? "מחק קובץ" : "Delete file"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
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
                          Body: {"{ \"From\": \"+18457092022\" }"}
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
                          Body: {"{ \"phone\": \"8457092022\" }"}
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
                                <span>📞 845-709-2022</span>
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
                                    <span className="font-bold">845-709-2022</span>
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
                      <div className="flex gap-3 justify-center max-w-xs mx-auto">
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
                                      📞 845-709-2022
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
                                      <div class="info-item \${isRtl ? "rtl" : ""}"><strong>📞:</strong> <span>845-709-2022</span></div>
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
                          className="btn-primary flex-1 flex items-center justify-center gap-2 text-xs py-2 shadow"
                        >
                          <Printer className="w-4 h-4" />
                          {isRtl ? "הדפס כרטיס" : "Print Card"}
                        </button>
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
  );
}
