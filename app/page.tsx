"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Microscope, Truck, Home, ShieldCheck, Clock, Phone, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

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
                href="tel:845-709-2022" 
                className="btn-primary inline-flex items-center gap-2"
              >
                <Phone className="w-5 h-5" />
                {t("call_now")}: 845-709-2022
              </a>
              <Link href="/track" className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-semibold border-2 border-white/20 text-white hover:bg-white/10 transition-all duration-300">
                {t("track_your_order")}
                <ChevronRight className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
