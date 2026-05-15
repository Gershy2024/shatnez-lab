"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Microscope, Truck, Home, ShieldCheck, Clock, Phone, ChevronRight } from "lucide-react";

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
            className="max-w-3xl"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium mb-6 border border-white/10">
              <ShieldCheck className="w-4 h-4 text-gold-400" />
              Trusted Professional Shatnez Testing
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            >
              The Shatnez Lab
              <span className="block text-gold-400 mt-2">Precision & Care</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-lg sm:text-xl text-primary-300 leading-relaxed mb-10 max-w-2xl"
            >
              Professional shatnez inspection services for your garments and textiles. 
              In-lab testing and VIP home visits available throughout Spring Valley and surrounding areas.
            </motion.p>
            
            <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
              <Link href="/track" className="btn-primary inline-flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Track Your Order
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-semibold border-2 border-white/20 text-white hover:bg-white/10 transition-all duration-300">
                <Phone className="w-5 h-5" />
                Contact Us
              </Link>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">Our Services</h2>
            <p className="text-lg text-primary-600 max-w-2xl mx-auto">
              Comprehensive shatnez testing solutions tailored to your needs
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Microscope,
                title: "In-Lab Testing",
                description: "Thorough microscopic examination in our state-of-the-art facility. Fast, accurate results with detailed reporting.",
                color: "bg-navy-100 text-navy-600",
              },
              {
                icon: Home,
                title: "VIP Home Service",
                description: "Can&apos;t make it to the lab? We come to you! Premium home inspection service for your convenience and privacy.",
                color: "bg-gold-100 text-gold-600",
              },
              {
                icon: Clock,
                title: "Express Processing",
                description: "Need results urgently? Our express service provides same-day or next-day turnaround for time-sensitive needs.",
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
            <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">How It Works</h2>
            <p className="text-lg text-primary-600 max-w-2xl mx-auto">
              Simple, transparent process from drop-off to results
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Submit Garment", desc: "Drop off at our lab or schedule VIP pickup" },
              { step: "02", title: "Testing", desc: "Expert microscopic analysis performed" },
              { step: "03", title: "Quality Check", desc: "Double-verified results for accuracy" },
              { step: "04", title: "Get Results", desc: "Receive your report with status update" },
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
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-primary-300 mb-8 max-w-2xl mx-auto">
              Whether you need in-lab testing or our premium VIP home service, 
              we&apos;re here to help with professional care.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="tel:845-709-2022" 
                className="btn-primary inline-flex items-center gap-2"
              >
                <Phone className="w-5 h-5" />
                Call Now: 845-709-2022
              </a>
              <Link href="/track" className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-semibold border-2 border-white/20 text-white hover:bg-white/10 transition-all duration-300">
                Track Order
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
