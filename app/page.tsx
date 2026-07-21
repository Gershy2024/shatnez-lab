"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Microscope, Truck, Home, ShieldCheck, Clock, Phone, ChevronRight, Plus, Minus, MapPin } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { saveDeliveryRequest, getAdminSettings } from "@/lib/db";

const pageTranslations = {
  delivery_service_title: {
    en: "Next-Day Pickup & Delivery",
    he: "איסוף ומשלוח מהיום למחר"
  },
  delivery_service_desc: {
    en: "We collect your garments directly from your door, check them in our lab, and deliver them back the very next day. Simple and hassle-free door-to-door service.",
    he: "אנו אוספים את הבגדים ישירות מדלת הבית שלך, בודקים אותם במעבדה, ומחזירים אותם למחרת. שירות מדלת לדלת פשוט ונוח."
  },
  delivery_price: {
    en: "Plus checking fees",
    he: "בתוספת דמי הבדיקה"
  },
  request_pickup_btn: {
    en: "Request Pickup Now",
    he: "בקש איסוף כעת"
  },
  pickup_form_title: {
    en: "Request Pickup & Delivery",
    he: "בקשת שירות איסוף ומשלוח"
  },
  pickup_form_desc: {
    en: "Fill out the details below and we will contact you to coordinate the pickup.",
    he: "מלא את הפרטים למטה וניצור עמך קשר לתיאום האיסוף."
  },
  full_name_label: {
    en: "Full Name",
    he: "שם מלא"
  },
  phone_label: {
    en: "Phone Number",
    he: "מספר טלפון"
  },
  address_label: {
    en: "Address / Directions",
    he: "כתובת מגורים / הנחיות הגעה"
  },
  notes_label: {
    en: "Special Notes / Stating Garments",
    he: "הערות מיוחדות / פירוט בגדים"
  },
  submitting: {
    en: "Submitting...",
    he: "שולח..."
  },
  submit_btn: {
    en: "Submit Request",
    he: "שלח בקשה"
  },
  cancel_btn: {
    en: "Cancel",
    he: "ביטול"
  },
  success_title: {
    en: "Request Received!",
    he: "הבקשה התקבלה!"
  },
  success_desc: {
    en: "Thank you! Your pickup request has been saved. We will contact you shortly to coordinate the pickup.",
    he: "תודה רבה! בקשת האיסוף שלך נשמרה. ניצור עמך קשר בהקדם לתיאום האיסוף."
  }
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

export default function HomePage() {
  const { t, isRtl } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", address: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handlePickupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const callSid = `web_del_${Date.now()}`;
      
      await saveDeliveryRequest({
        id: callSid,
        phone: formData.phone,
        customerName: formData.name,
        timestamp: Date.now(),
        status: "pending",
        createdAt: new Date().toISOString(),
        notes: `Address: ${formData.address}${formData.notes ? ` | Notes: ${formData.notes}` : ""}`
      });

      const settings = await getAdminSettings();
      const adminPhone = settings.forwardingNumber || "8455524744";
      const smsMessage = `New Online Pickup & Delivery request from ${formData.name} (${formData.phone}). Address: "${formData.address}". Garments: "${formData.notes || "None stated"}".`;
      
      await fetch("/api/twilio/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: adminPhone, message: smsMessage })
      });

      setSubmitSuccess(true);
      setFormData({ name: "", phone: "", address: "", notes: "" });
    } catch (err) {
      console.error("Failed to submit pickup request:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-navy-700/40 via-transparent to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className={`max-w-3xl ${isRtl ? "text-right" : "text-left"}`}
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium mb-6 border border-white/10">
              <ShieldCheck className="w-4 h-4 text-gold-400" />
              {t("trusted_badge")}
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            >
              {t("hero_title")}
              <span className="block text-gold-400 mt-2">{t("hero_subtitle")}</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-lg sm:text-xl text-primary-300 leading-relaxed mb-10 max-w-2xl"
            >
              {t("hero_desc")}
            </motion.p>
            
            <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
              <Link href="/track" className="btn-primary inline-flex items-center gap-2">
                <Truck className="w-5 h-5" />
                {t("track_your_order")}
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-semibold border-2 border-white/20 text-white hover:bg-white/10 transition-all duration-300">
                <Phone className="w-5 h-5" />
                {t("contact_us")}
              </Link>
            </motion.div>

            {/* Automated Phone System Info */}
            <motion.div 
              variants={fadeInUp}
              className="mt-12 p-6 bg-gold-400/10 backdrop-blur-sm rounded-2xl border border-gold-400/20 max-w-xl"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gold-400 rounded-lg flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6 text-navy-900" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gold-400">{t("phone_title")}</h3>
                  <p className="text-primary-300 mt-1">
                    {t("phone_desc")}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section className="section-padding bg-primary-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">{t("our_services")}</h2>
            <p className="text-lg text-primary-600 max-w-2xl mx-auto">
              {t("services_desc")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Microscope,
                title: t("in_lab"),
                description: t("in_lab_desc"),
                color: "bg-navy-100 text-navy-600",
              },
              {
                icon: Home,
                title: t("vip_home"),
                description: t("vip_home_desc"),
                color: "bg-gold-100 text-gold-600",
              },
              {
                icon: ShieldCheck,
                title: t("store_testing"),
                description: t("store_testing_desc"),
                color: "bg-navy-100 text-navy-600",
              },
            ].map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card p-8"
              >
                <div className={`w-14 h-14 ${service.color} rounded-xl flex items-center justify-center mb-6`}>
                  <service.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-3">{service.title}</h3>
                <p className="text-primary-600 leading-relaxed">{service.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 p-6 bg-gold-50/80 backdrop-blur-sm rounded-2xl border border-gold-200/60 max-w-3xl mx-auto text-center shadow-sm"
          >
            <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${isRtl ? "sm:flex-row-reverse" : ""}`}>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gold-100 text-gold-800 border border-gold-300 ${isRtl ? "flex-row-reverse" : ""}`}>
                <Clock className="w-3.5 h-3.5 text-gold-600" />
                {t("on_spot_badge")}
              </span>
              <p className="text-navy-900 font-medium text-sm sm:text-base">
                {t("on_spot_text")}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pickup & Delivery Promo Banner */}
      <section className="bg-gradient-to-r from-navy-900 via-navy-850 to-navy-950 text-white relative overflow-hidden py-16 border-y border-gold-400/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-gold-500/10 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`flex flex-col lg:flex-row items-center justify-between gap-8 ${isRtl ? "lg:flex-row-reverse" : ""}`}>
            <div className={`max-w-2xl ${isRtl ? "text-right" : "text-left"}`}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gold-400/20 text-gold-400 border border-gold-400/30 mb-4">
                <Truck className="w-3.5 h-3.5" />
                {isRtl ? "שירות חדש!" : "New Service!"}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                {isRtl ? pageTranslations.delivery_service_title.he : pageTranslations.delivery_service_title.en}
              </h2>
              <p className="text-primary-200 text-base sm:text-lg mb-6 leading-relaxed">
                {isRtl ? pageTranslations.delivery_service_desc.he : pageTranslations.delivery_service_desc.en}
              </p>
              <div className="flex items-center gap-2 text-gold-400 font-bold text-lg sm:text-xl">
                <span>{isRtl ? pageTranslations.delivery_price.he : pageTranslations.delivery_price.en}</span>
              </div>
            </div>
            <div className="shrink-0">
              <button
                onClick={() => setShowPickupModal(true)}
                className="btn-primary py-4 px-8 text-base shadow-lg shadow-gold-500/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Truck className="w-5 h-5" />
                <span>{isRtl ? pageTranslations.request_pickup_btn.he : pageTranslations.request_pickup_btn.en}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-padding bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">{t("how_it_works")}</h2>
            <p className="text-lg text-primary-600 max-w-2xl mx-auto">
              {t("how_desc")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "01", title: t("step1_title"), desc: t("step1_desc") },
              { step: "02", title: t("step2_title"), desc: t("step2_desc") },
              { step: "03", title: t("step3_title"), desc: t("step3_desc") },
              { step: "04", title: t("step4_title"), desc: t("step4_desc") },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-gold-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gold-400/20">
                  <span className="text-2xl font-bold text-white">{item.step}</span>
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">{item.title}</h3>
                <p className="text-sm text-primary-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section for SEO and Authority */}
      <section className="section-padding bg-primary-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">{t("faq_title")}</h2>
            <p className="text-lg text-primary-600">
              {t("faq_desc")}
            </p>
          </motion.div>

          <div className="space-y-4">
            {[1, 2, 3].map((num, index) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-primary-100 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === num ? null : num)}
                  className={`w-full px-6 py-5 flex items-center justify-between text-left transition-colors duration-200 ${
                    openFaq === num ? "bg-navy-50" : "hover:bg-primary-50"
                  }`}
                >
                  <h3 className={`text-lg font-bold ${openFaq === num ? "text-navy-900" : "text-navy-800"}`}>
                    {t(`faq_q${num}`)}
                  </h3>
                  <div className={`flex-shrink-0 ml-4 ${openFaq === num ? "text-gold-500" : "text-primary-400"}`}>
                    {openFaq === num ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                </button>
                <AnimatePresence>
                  {openFaq === num && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 text-primary-600 leading-relaxed border-t border-primary-100/50 pt-4">
                        {t(`faq_a${num}`)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-navy-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold-500/10 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("ready_to_start")}</h2>
            <p className="text-lg text-primary-300 mb-8 max-w-2xl mx-auto">
              {t("cta_desc")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="tel:845-552-4744" 
                className="btn-primary inline-flex items-center gap-2"
              >
                <Phone className="w-5 h-5" />
                <span dir="ltr">{t("call_now")}: 845-552-4744</span>
              </a>
              <Link href="/track" className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-semibold border-2 border-white/20 text-white hover:bg-white/10 transition-all duration-300">
                {t("track_your_order")}
                <ChevronRight className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pickup Request Modal */}
      <AnimatePresence>
        {showPickupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPickupModal(false)}
              className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-primary-150 p-6 sm:p-8"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowPickupModal(false)}
                className="absolute top-4 right-4 text-primary-400 hover:text-navy-900 transition-colors p-1"
              >
                <Minus className="w-6 h-6" />
              </button>

              <div className={`space-y-6 ${isRtl ? "text-right" : "text-left"}`}>
                <div>
                  <h3 className="text-2xl font-bold text-navy-950">
                    {isRtl ? pageTranslations.pickup_form_title.he : pageTranslations.pickup_form_title.en}
                  </h3>
                  <p className="text-sm text-primary-500 mt-1">
                    {isRtl ? pageTranslations.pickup_form_desc.he : pageTranslations.pickup_form_desc.en}
                  </p>
                </div>

                {submitSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-emerald-50 rounded-2xl border border-emerald-150 text-center space-y-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto font-bold text-lg">✓</div>
                    <h4 className="font-bold text-emerald-900 text-lg">
                      {isRtl ? pageTranslations.success_title.he : pageTranslations.success_title.en}
                    </h4>
                    <p className="text-emerald-700 text-sm leading-relaxed">
                      {isRtl ? pageTranslations.success_desc.he : pageTranslations.success_desc.en}
                    </p>
                    <button
                      onClick={() => {
                        setSubmitSuccess(false);
                        setShowPickupModal(false);
                      }}
                      className="btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white mt-4 py-2 px-6"
                    >
                      {isRtl ? "סגור" : "Close"}
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handlePickupSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-navy-900 mb-1.5">
                        {isRtl ? pageTranslations.full_name_label.he : pageTranslations.full_name_label.en}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                        placeholder={isRtl ? "ישראל ישראלי" : "John Doe"}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-navy-900 mb-1.5">
                        {isRtl ? pageTranslations.phone_label.he : pageTranslations.phone_label.en}
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm text-left"
                        dir="ltr"
                        placeholder="845-552-4744"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-navy-900 mb-1.5">
                        {isRtl ? pageTranslations.address_label.he : pageTranslations.address_label.en}
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                        placeholder={isRtl ? "רחוב ומספר בית, קומה, דירה והנחיות" : "14 Buchanan Rd, Floor 2, Apt 3"}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-navy-900 mb-1.5">
                        {isRtl ? pageTranslations.notes_label.he : pageTranslations.notes_label.en}
                      </label>
                      <textarea
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border border-primary-200 focus:ring-2 focus:ring-gold-400 focus:outline-none text-sm ${isRtl ? "text-right" : ""}`}
                        placeholder={isRtl ? "איזה סוג בגדים? (למשל: חליפה ומעיל)" : "Which garments? (e.g., suit, coat)"}
                      />
                    </div>

                    <div className={`flex gap-3 pt-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 btn-primary py-3 px-4 shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {submitting ? (
                          <span>{isRtl ? pageTranslations.submitting.he : pageTranslations.submitting.en}</span>
                        ) : (
                          <>
                            <Truck className="w-4 h-4" />
                            <span>{isRtl ? pageTranslations.submit_btn.he : pageTranslations.submit_btn.en}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPickupModal(false)}
                        className="px-5 py-3 rounded-xl border border-primary-200 hover:bg-primary-50 text-navy-800 text-sm font-semibold transition-all"
                      >
                        {isRtl ? pageTranslations.cancel_btn.he : pageTranslations.cancel_btn.en}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
