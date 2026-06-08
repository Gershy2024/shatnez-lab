"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Copy, 
  Check, 
  ExternalLink, 
  Package, 
  Truck, 
  Printer, 
  MapPin, 
  CheckSquare, 
  Square,
  ArrowRight,
  Info,
  HelpCircle,
  FileText
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function ShippingPage() {
  const { t, isRtl } = useLanguage();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Checklist State
  const [checklist, setChecklist] = useState({
    contactInfo: false,
    garmentDetails: false,
    paymentIncluded: false,
  });

  const addressDetails = {
    name: "The Shatnez Lab",
    street: "14 Buchanan Rd",
    city: "Spring Valley",
    state: "NY",
    zip: "10977",
    full: "The Shatnez Lab\n14 Buchanan Rd\nSpring Valley, NY 10977"
  };

  const handleCopy = (text: string, fieldName: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const toggleChecklist = (key: keyof typeof checklist) => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isChecklistComplete = Object.values(checklist).every(Boolean);

  return (
    <div className="min-h-[calc(100vh-300px)] bg-primary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`text-center mb-12 ${isRtl ? "text-right" : ""}`}
        >
          <div className="w-16 h-16 bg-gold-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-gold-600 animate-pulse" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-3">{t("shipping_title")}</h1>
          <p className="text-primary-600 max-w-2xl mx-auto text-base sm:text-lg">
            {t("shipping_subtitle")}
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          
          {/* Step 1: Copy Our Address */}
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="card p-6 sm:p-8 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-sm">1</span>
                <h2 className="text-xl font-bold text-navy-900">{t("shipping_step1_title")}</h2>
              </div>
              <p className="text-sm text-primary-600 mb-6">{t("shipping_step1_desc")}</p>
              
              {/* Address Display Box */}
              <div className="relative bg-primary-100/50 border border-primary-200/60 rounded-2xl p-6 mb-6">
                <div className="absolute top-4 right-4 text-primary-400">
                  <MapPin className="w-5 h-5 text-gold-500" />
                </div>
                <div className={`space-y-1 font-mono text-sm sm:text-base text-navy-900 ${isRtl ? "text-right" : "text-left"}`}>
                  <p className="font-semibold text-navy-950">{addressDetails.name}</p>
                  <p>{addressDetails.street}</p>
                  <p>{addressDetails.city}, {addressDetails.state} {addressDetails.zip}</p>
                </div>
              </div>
            </div>

            {/* Copy Actions */}
            <div className="space-y-3">
              <button
                onClick={() => handleCopy(addressDetails.full, "full")}
                className="w-full btn-secondary flex items-center justify-center gap-2 hover:bg-gold-500 hover:border-gold-500 transition-colors"
              >
                {copiedField === "full" ? (
                  <>
                    <Check className="w-5 h-5 text-green-400" />
                    <span>{t("copied_address")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    <span>{t("copy_full_address")}</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { field: "street", label: t("street"), value: addressDetails.street },
                  { field: "city", label: t("city"), value: addressDetails.city },
                  { field: "state", label: t("state"), value: addressDetails.state },
                  { field: "zip", label: t("zip"), value: addressDetails.zip },
                ].map((item) => (
                  <button
                    key={item.field}
                    onClick={() => handleCopy(item.value, item.field)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border border-primary-200/80 bg-white text-navy-700
                              hover:bg-primary-50 hover:border-gold-300 active:scale-[0.98] transition-all flex items-center justify-between
                              ${copiedField === item.field ? "border-green-500 text-green-600 bg-green-50" : ""}`}
                  >
                    <span>{item.label}</span>
                    {copiedField === item.field ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3 text-primary-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Step 2: Buy & Print a Label */}
          <motion.div
            initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="card p-6 sm:p-8 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-sm">2</span>
                <h2 className="text-xl font-bold text-navy-900">{t("shipping_step2_title")}</h2>
              </div>
              <p className="text-sm text-primary-600 mb-6">{t("shipping_step2_desc")}</p>
              
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary-400 mb-4">{t("shipping_carriers_title")}</h3>
              
              {/* Carrier list */}
              <div className="space-y-4">
                
                {/* Pirate Ship (Recommended) */}
                <div className="border border-gold-200 bg-gold-50/20 rounded-xl p-4 transition-all hover:border-gold-300">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-gold-400 text-navy-950 font-bold text-[10px] uppercase tracking-wider">
                        {isRtl ? "מומלץ ביותר" : "Highly Recommended"}
                      </span>
                      <h4 className="font-bold text-navy-900">Pirate Ship</h4>
                    </div>
                    <a
                      href="https://www.pirateship.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-gold-600 hover:text-gold-700 flex items-center gap-1 shrink-0"
                    >
                      <span>{t("buy_label_on").replace("{site}", "Pirate Ship")}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-primary-600 leading-relaxed">{t("pirateship_desc")}</p>
                </div>

                {/* USPS */}
                <div className="border border-primary-200/60 rounded-xl p-4 transition-all hover:border-primary-300">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-bold text-navy-900">USPS Click-N-Ship</h4>
                    <a
                      href="https://cns.usps.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-navy-600 hover:text-navy-700 flex items-center gap-1 shrink-0"
                    >
                      <span>{t("buy_label_on").replace("{site}", "USPS")}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-primary-600 leading-relaxed">{t("usps_desc")}</p>
                </div>

                {/* UPS */}
                <div className="border border-primary-200/60 rounded-xl p-4 transition-all hover:border-primary-300">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-bold text-navy-900">UPS Shipping</h4>
                    <a
                      href="https://www.ups.com/ship"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-navy-600 hover:text-navy-700 flex items-center gap-1 shrink-0"
                    >
                      <span>{t("buy_label_on").replace("{site}", "UPS")}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-primary-600 leading-relaxed">{t("ups_desc")}</p>
                </div>

              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Step 3: Pack & Include Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="card p-6 sm:p-8 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-sm">3</span>
                <h2 className="text-xl font-bold text-navy-900">{t("shipping_step3_title")}</h2>
              </div>
              <p className="text-sm text-primary-600 mb-6">{t("shipping_step3_desc")}</p>
              
              {/* Checklist Card */}
              <div className="bg-primary-50 rounded-2xl p-5 border border-primary-200/60 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy-800 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gold-500" />
                  {t("inclusion_checklist")}
                </h3>
                
                {/* Checklist Item 1 */}
                <button
                  onClick={() => toggleChecklist("contactInfo")}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all text-right
                            ${checklist.contactInfo ? "bg-green-50/40 border border-green-100" : "bg-white border border-primary-100 hover:border-gold-300"}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {checklist.contactInfo ? (
                      <CheckSquare className="w-5 h-5 text-green-600" />
                    ) : (
                      <Square className="w-5 h-5 text-primary-400" />
                    )}
                  </div>
                  <span className={`text-xs sm:text-sm text-navy-900 ${isRtl ? "text-right" : "text-left"}`}>
                    {t("checklist_name")}
                  </span>
                </button>

                {/* Checklist Item 2 */}
                <button
                  onClick={() => toggleChecklist("garmentDetails")}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all text-right
                            ${checklist.garmentDetails ? "bg-green-50/40 border border-green-100" : "bg-white border border-primary-100 hover:border-gold-300"}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {checklist.garmentDetails ? (
                      <CheckSquare className="w-5 h-5 text-green-600" />
                    ) : (
                      <Square className="w-5 h-5 text-primary-400" />
                    )}
                  </div>
                  <span className={`text-xs sm:text-sm text-navy-900 ${isRtl ? "text-right" : "text-left"}`}>
                    {t("checklist_items")}
                  </span>
                </button>

                {/* Checklist Item 3 */}
                <button
                  onClick={() => toggleChecklist("paymentIncluded")}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all text-right
                            ${checklist.paymentIncluded ? "bg-green-50/40 border border-green-100" : "bg-white border border-primary-100 hover:border-gold-300"}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {checklist.paymentIncluded ? (
                      <CheckSquare className="w-5 h-5 text-green-600" />
                    ) : (
                      <Square className="w-5 h-5 text-primary-400" />
                    )}
                  </div>
                  <span className={`text-xs sm:text-sm text-navy-900 ${isRtl ? "text-right" : "text-left"}`}>
                    {t("checklist_payment")}
                  </span>
                </button>
              </div>
            </div>

            {/* Checklist Complete Alert */}
            <div className="mt-6 h-12 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {isChecklistComplete ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full py-2 px-4 bg-green-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                  >
                    <span>{t("checklist_ready")} 📦</span>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-primary-500 flex items-center gap-1.5"
                  >
                    <Info className="w-3.5 h-3.5 text-gold-500 shrink-0" />
                    <span>{isRtl ? "אנא סמן את כל שלבי רשימת התיוג כדי לוודא מוכנות" : "Please complete the checklist to proceed"}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Step 4: Mail & Track */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="card p-6 sm:p-8 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-sm">4</span>
                <h2 className="text-xl font-bold text-navy-900">{t("shipping_step4_title")}</h2>
              </div>
              <p className="text-sm text-primary-600 mb-6">{t("shipping_step4_desc")}</p>
              
              {/* Process timeline card */}
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-gold-100 text-gold-600 flex items-center justify-center text-xs font-bold border border-gold-300">
                      1
                    </div>
                    <div className="w-0.5 h-10 bg-primary-200"></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">{isRtl ? "מסירה למשלוח" : "Drop Off"}</h4>
                    <p className="text-xs text-primary-500 mt-0.5">{isRtl ? "מסרו את החבילה בכל סניף דואר או נקודת UPS/FedEx." : "Leave it with your selected shipping carrier."}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-gold-100 text-gold-600 flex items-center justify-center text-xs font-bold border border-gold-300">
                      2
                    </div>
                    <div className="w-0.5 h-10 bg-primary-200"></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">{isRtl ? "קבלה ורישום במעבדה" : "Intake & Phone Notification"}</h4>
                    <p className="text-xs text-primary-500 mt-0.5">{isRtl ? "מיד כשהחבילה תגיע אלינו, תקבלו עדכון טלפוני/SMS והזמנתכם תירשם." : "We'll call or text you immediately to confirm receipt and log your order."}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-gold-100 text-gold-600 flex items-center justify-center text-xs font-bold border border-gold-300">
                      3
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">{isRtl ? "מעקב באתר" : "Track Online"}</h4>
                    <p className="text-xs text-primary-500 mt-0.5">{isRtl ? "עקבו אחר סטטוס הבדיקה באתר שלנו באמצעות מספר הטלפון שלכם!" : "Track step-by-step progress on our website using your phone number!"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA to Track Page */}
            <div className="mt-8">
              <a 
                href="/track"
                className={`w-full btn-primary flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform ${isRtl ? "flex-row-reverse" : ""}`}
              >
                <span>{t("track_your_order")}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>

        </div>

      </div>
    </div>
  );
}
