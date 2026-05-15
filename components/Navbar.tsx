"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Microscope } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage, Language } from "@/lib/LanguageContext";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/track", label: t("track_order") },
    { href: "/contact", label: t("contact") },
    { href: "/admin", label: t("admin") },
  ];

  const languages: { code: Language; label: string; text: string }[] = [
    { code: "en", label: "English", text: "US" },
    { code: "he", label: "עברית", text: "IL" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-primary-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center
                          group-hover:bg-gold-500 transition-colors duration-300">
              <Microscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-navy-900 tracking-tight">
              The Shatnez <span className="text-gold-500">Lab</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-navy-700
                           hover:text-navy-900 hover:bg-primary-50 transition-all duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1.5 pl-6 border-l border-primary-100">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300
                            focus:outline-none focus:ring-2 focus:ring-gold-400/50
                            ${language === lang.code 
                              ? "bg-gold-400 text-navy-900 shadow-lg shadow-gold-400/20 scale-105" 
                              : "text-primary-400 hover:bg-primary-50 hover:text-navy-900 hover:scale-105"}`}
                  title={lang.label}
                >
                  {lang.text}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile buttons */}
          <div className="flex items-center gap-2 md:hidden">
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-primary-50 text-xs font-bold border-none rounded-lg py-1 px-2 focus:ring-0 text-navy-900"
            >
              {languages.map(l => (
                <option key={l.code} value={l.code}>{l.text}</option>
              ))}
            </select>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-navy-700 hover:bg-primary-50 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-primary-100 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-lg text-sm font-medium text-navy-700
                           hover:text-navy-900 hover:bg-primary-50 transition-all duration-200 text-center"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
