"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, MapPin, Clock, MessageCircle, Send, CheckCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function ContactPage() {
  const { t, isRtl } = useLanguage();
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });
      
      if (response.ok) {
        setSubmitted(true);
        setFormData({ name: "", email: "", phone: "", message: "" });
        setTimeout(() => setSubmitted(false), 3000);
      } else {
        alert("Something went wrong. Please try again.");
      }
    } catch (error) {
      alert("Network error. Please try again.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-300px)] bg-primary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`text-center mb-12 ${isRtl ? "text-right" : ""}`}
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-3">{t("get_in_touch")}</h1>
          <p className="text-primary-600 max-w-2xl mx-auto">
            {t("contact_subtitle")}
          </p>
        </motion.div>

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 ${isRtl ? "direction-rtl" : ""}`}>
          {/* Contact Info Cards */}
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-1 space-y-6"
          >
            <a 
              href="tel:845-709-2022"
              className="card p-6 flex items-start gap-4 hover:shadow-lg transition-all duration-300 group block"
            >
              <div className="w-12 h-12 bg-gold-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-gold-200 transition-colors">
                <Phone className="w-6 h-6 text-gold-600" />
              </div>
              <div className={isRtl ? "text-right" : ""}>
                <h3 className="font-semibold text-navy-900 mb-1">{t("call_us")}</h3>
                <p className="text-primary-600">845-709-2022</p>
                <p className="text-sm text-primary-400 mt-1">{t("tap_to_call")}</p>
              </div>
            </a>

            <a 
              href="https://wa.me/18457092022"
              target="_blank"
              rel="noopener noreferrer"
              className="card p-6 flex items-start gap-4 hover:shadow-lg transition-all duration-300 group block"
            >
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-green-200 transition-colors">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className={isRtl ? "text-right" : ""}>
                <h3 className="font-semibold text-navy-900 mb-1">{t("whatsapp")}</h3>
                <p className="text-primary-600">{t("whatsapp_desc")}</p>
                <p className="text-sm text-primary-400 mt-1">{t("quick_responses")}</p>
              </div>
            </a>

            <div className="card p-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-navy-100 rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-navy-600" />
              </div>
              <div className={isRtl ? "text-right" : ""}>
                <h3 className="font-semibold text-navy-900 mb-1">{t("location")}</h3>
                <p className="text-primary-600">
                  14 Buchanan Rd<br />
                  Spring Valley, NY 10977
                </p>
              </div>
            </div>

            <div className="card p-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-navy-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-navy-600" />
              </div>
              <div className={isRtl ? "text-right" : ""}>
                <h3 className="font-semibold text-navy-900 mb-1">{t("hours")}</h3>
                <p className="text-primary-600">
                  Sun - Thu: 9:00 AM - 6:00 PM<br />
                  Fri: 9:00 AM - 2:00 PM<br />
                  Sat: Closed
                </p>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className={`card p-8 ${isRtl ? "text-right" : ""}`}>
              <h2 className="text-xl font-bold text-navy-900 mb-6">{t("send_message")}</h2>
              
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-bold text-navy-900 mb-2">{t("msg_sent")}</h3>
                  <p className="text-primary-600">{t("msg_sent_desc")}</p>
                </motion.div>
              ) : (
                <form
                  action="https://formspree.io/f/mrejoqvz"
                  method="POST"
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-navy-800 mb-2">{t("name")}</label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border border-primary-200 bg-primary-50
                                 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                                 transition-all duration-200 ${isRtl ? "text-right" : ""}`}
                        placeholder={t("your_name")}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-navy-800 mb-2">{t("phone")}</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border border-primary-200 bg-primary-50
                                 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                                 transition-all duration-200 ${isRtl ? "text-right" : ""}`}
                        placeholder={t("your_phone")}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-2">{t("email")}</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                               transition-all duration-200 ${isRtl ? "text-right" : ""}`}
                      placeholder={t("your_email")}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-navy-800 mb-2">{t("message")}</label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border border-primary-200 bg-primary-50
                               focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent
                               transition-all duration-200 resize-none ${isRtl ? "text-right" : ""}`}
                      placeholder={t("how_can_help")}
                    />
                  </div>
                  
                  <button type="submit" className={`btn-secondary w-full flex items-center justify-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
                    <Send className="w-5 h-5" />
                    {t("send_btn")}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
