"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Plus, Trash2, Save, X, Package, Search, LogOut, Printer } from "lucide-react";
import PrintCard from "@/components/PrintCard";
import { Order, OrderStatus, subscribeToOrders, saveOrder, deleteOrder, getAdminSettings, saveAdminSettings } from "@/lib/db";
import { Settings, Phone, Info } from "lucide-react";
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

  const statusOptions: { value: OrderStatus; label: string }[] = [
    { value: "received", label: t("status_received") },
    { value: "testing", label: t("status_testing") },
    { value: "review", label: t("status_review") },
    { value: "ready", label: t("status_ready") },
    { value: "delivered", label: t("status_delivered") },
    { value: "issue", label: t("status_issue") },
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
      setIvrGeneralEn(s.ivrGeneralEn || "");
      setIvrGeneralHe(s.ivrGeneralHe || "");
      setIvrSpecialEn(s.ivrSpecialEn || "");
      setIvrSpecialHe(s.ivrSpecialHe || "");
    });

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
      setIvrGeneralEn(s.ivrGeneralEn || "");
      setIvrGeneralHe(s.ivrGeneralHe || "");
      setIvrSpecialEn(s.ivrSpecialEn || "");
      setIvrSpecialHe(s.ivrSpecialHe || "");
    });
  }, []);

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
        ivrSpecialHe
      });
      
      setAdminPin(updatedPin);
      setForwardingNumber(updatedForwarding);
      setNewPin("");
      setNewForwardingNumber("");
      setSaveSuccess(true);
      
      // If Firestore is working, we'll see "Admin settings saved successfully to Firebase" in console.
      // If not, it still saved to LS.
      alert(isRtl ? "הגדרות עודכנו בהצלחה!" : "Settings updated successfully!");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update settings:", err);
      alert(isRtl ? "שגיאה בשמירת ההגדרות. נסה שוב." : "Error saving settings. Please try again.");
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
                    <input
                      type="text"
                      value={newOrder.result || ""}
                      onChange={(e) => setNewOrder({ ...newOrder, result: e.target.value })}
                      placeholder={isRtl ? "למשל: נקי, נמצא שעטנז..." : "e.g. Clean, Shatnez Found..."}
                      className={`w-full px-3 py-2 rounded-lg border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent ${isRtl ? "text-right" : ""}`}
                    />
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
                        <input
                          type="text"
                          value={order.result || ""}
                          onChange={(e) => updateResult(order.id, e.target.value)}
                          placeholder={isRtl ? "אין תוצאה" : "No result yet"}
                          className={`w-full px-2 py-1 text-sm rounded border border-primary-200 bg-white
                                   focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-transparent
                                   transition-all ${isRtl ? "text-right" : ""}`}
                        />
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
      </AnimatePresence>
    </div>
  );
}
