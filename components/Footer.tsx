"use client";

import Link from "next/link";
import { Microscope, Phone, MapPin, Mail } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-navy-900 text-primary-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center">
                <Microscope className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">
                The Shatnez <span className="text-gold-400">Lab</span>
              </span>
            </Link>
            <p className="text-sm text-primary-300 leading-relaxed max-w-xs">
              Professional shatnez testing with precision and care. 
              Your trusted partner in textile inspection.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Quick Links</h3>
            <ul className="space-y-2">
              {[
                { href: "/", label: t("home") },
                { href: "/track", label: t("track_order") },
                { href: "/shipping", label: t("shipping") },
                { href: "/contact", label: t("contact") },
              ].map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-sm text-primary-300 hover:text-gold-400 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                <span className="text-sm text-primary-300">
                  14 Buchanan Rd<br />
                  Spring Valley, NY 10977
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gold-400 shrink-0" />
                <a 
                  href="tel:845-552-4744" 
                  className="text-sm text-primary-300 hover:text-gold-400 transition-colors"
                >
                  <span dir="ltr">845-552-4744</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-sm text-primary-400">
            &copy; {new Date().getFullYear()} The Shatnez Lab. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-primary-400">
            <Link href="/privacy" className="hover:text-gold-400 transition-colors duration-200">
              {t("privacy_policy")}
            </Link>
            <Link href="/terms" className="hover:text-gold-400 transition-colors duration-200">
              {t("terms_conditions")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
