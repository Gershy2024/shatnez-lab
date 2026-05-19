"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Phone, MapPin, Printer, ShieldCheck, Microscope, RefreshCw, Layers } from "lucide-react";
import { motion } from "framer-motion";

export default function BusinessCardPage() {
  const { t, isRtl, language } = useLanguage();
  const [isFlipped, setIsFlipped] = useState(false);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shatnez Lab Business Card</title>
          <style>
            @page {
              size: 3.5in 2in;
              margin: 0;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .page-break {
                page-break-after: always;
              }
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              background: #ffffff;
            }
            .card-print {
              width: 3.5in;
              height: 2in;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
              background: #0d1b2a;
              color: #ffffff;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 0.2in 0.25in;
            }
            .card-front {
              background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%);
              border: 4px solid #d4af37;
              align-items: center;
              justify-content: center;
              text-align: center;
            }
            .card-back {
              background: #ffffff;
              color: #0d1b2a;
              border: 4px solid #1e3a5f;
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              padding: 0.15in 0.2in;
            }
            .gold-border {
              position: absolute;
              inset: 0.05in;
              border: 1px solid rgba(212, 175, 55, 0.4);
              pointer-events: none;
            }
            .logo-container {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 0.1in;
            }
            .logo-icon {
              width: 24px;
              height: 24px;
              background: #d4af37;
              border-radius: 6px;
            }
            .title-main {
              font-size: 18px;
              font-weight: 800;
              letter-spacing: 1px;
              color: #ffffff;
              margin: 0;
            }
            .title-main-gold {
              color: #d4af37;
            }
            .subtitle {
              font-size: 8px;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              color: #a0aec0;
              margin: 4px 0 0 0;
            }
            .info-col {
              display: flex;
              flex-direction: column;
              gap: 4px;
              max-width: 2.1in;
              text-align: left;
            }
            .info-col.rtl {
              text-align: right;
            }
            .info-item {
              font-size: 8px;
              display: flex;
              align-items: center;
              gap: 5px;
              color: #4a5568;
            }
            .info-item.rtl {
              flex-direction: row-reverse;
            }
            .info-item strong {
              color: #0d1b2a;
            }
            .qr-col {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .qr-code {
              width: 1.1in;
              height: 1.1in;
              border: 1px solid #e2e8f0;
              padding: 4px;
              background: white;
              border-radius: 6px;
            }
            .qr-text {
              font-size: 6px;
              color: #718096;
              margin-top: 4px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .prices-row {
              display: flex;
              gap: 10px;
              margin-top: 6px;
              border-top: 1px solid #e2e8f0;
              padding-top: 4px;
            }
            .price-tag {
              font-size: 7px;
              background: #f7fafc;
              padding: 2px 5px;
              border-radius: 3px;
              border: 1px solid #edf2f7;
              color: #2d3748;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <!-- FRONT SIDE -->
          <div class="card-print card-front">
            <div class="gold-border"></div>
            <div style="font-size: 24px; color: #d4af37; margin-bottom: 5px;">🔬</div>
            <h1 class="title-main">THE SHATNEZ <span class="title-main-gold">LAB</span></h1>
            <p class="subtitle" style="color: #ffffff; opacity: 0.85;">
              ${isRtl ? "בדיקת שעטנז מקצועית ומוסמכת" : "Professional Shatnez Verification"}
            </p>
            <div style="margin-top: 15px; font-size: 10px; color: #d4af37; letter-spacing: 1px; font-weight: 600;">
              📞 845-709-2022
            </div>
          </div>

          <div class="page-break"></div>

          <!-- BACK SIDE -->
          <div class="card-print card-back">
            <div class="info-col ${isRtl ? "rtl" : ""}">
              <div style="font-size: 11px; font-weight: 800; color: #1e3a5f; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; ${isRtl ? "justify-content: flex-end;" : ""}">
                <span>🔬</span>
                <span>${isRtl ? "מעבדת השעטנז" : "The Shatnez Lab"}</span>
              </div>
              
              <div class="info-item ${isRtl ? "rtl" : ""}">
                <strong>📞:</strong> <span>845-709-2022</span>
              </div>
              <div class="info-item ${isRtl ? "rtl" : ""}">
                <strong>📍:</strong> <span>14 Buchanan Rd, Spring Valley NY</span>
              </div>
              <div class="info-item ${isRtl ? "rtl" : ""}">
                <strong>🕒:</strong> <span>24/7 Drop-Off & Phone Check</span>
              </div>

              <div class="prices-row" style="${isRtl ? "justify-content: flex-end;" : ""}">
                <span class="price-tag">${isRtl ? "בגד פשוט: $5" : "Simple Garment: $5"}</span>
                <span class="price-tag">${isRtl ? "בגד עם בטנה: $10" : "Lined (Suits/Coats): $10"}</span>
              </div>
            </div>

            <div class="qr-col">
              <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(origin + "/track")}" alt="QR" />
              <span class="qr-text">${isRtl ? "סרוק למעקב הזמנה" : "Scan to track order"}</span>
            </div>
          </div>

          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="section-padding bg-gradient-to-b from-primary-50/50 to-white min-h-[80vh] flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full text-center space-y-8">
        {/* Intro Header */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-navy-900 tracking-tight">
            {isRtl ? "כרטיס ביקור דיגיטלי" : "Digital Business Card"}
          </h1>
          <p className="text-primary-600 text-sm sm:text-base max-w-lg mx-auto">
            {isRtl
              ? "צפה בכרטיס הדו-צדדי האינטראקטיבי שלנו, שתף אותו או הדפס אותו ישירות בגודל סטנדרטי."
              : "View our interactive double-sided card, share it, or print it directly in standard size."}
          </p>
        </div>

        {/* 3D Flipping Card Container */}
        <div className="flex flex-col items-center justify-center py-8">
          <div 
            className="w-full max-w-[370px] h-[220px] cursor-pointer group"
            style={{ perspective: "1000px" }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <motion.div
              className="w-full h-full relative"
              style={{ transformStyle: "preserve-3d" }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              {/* FRONT SIDE (Navy & Gold Premium) */}
              <div 
                className="absolute inset-0 w-full h-full rounded-2xl p-6 bg-navy-950 text-white flex flex-col justify-between border-2 border-gold-400 shadow-2xl overflow-hidden select-none"
                style={{ backfaceVisibility: "hidden" }}
              >
                {/* Background Textures */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/10 via-transparent to-transparent pointer-events-none" />
                <div className="absolute inset-0 border border-gold-400/20 rounded-xl m-1.5 pointer-events-none" />
                
                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gold-400 rounded-lg flex items-center justify-center">
                      <Microscope className="w-4 h-4 text-navy-950" />
                    </div>
                    <div>
                      <span className="font-bold text-sm tracking-wide block">THE SHATNEZ LAB</span>
                      <span className="text-[9px] text-primary-400 tracking-widest block uppercase">EST. 2026</span>
                    </div>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-gold-400 animate-pulse" />
                </div>

                <div className="space-y-1 text-center z-10 my-auto">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                    {isRtl ? "מעבדת השעטנז" : "THE SHATNEZ LAB"}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-gold-400 font-medium tracking-widest uppercase">
                    {isRtl ? "בדיקת שעטנז מקצועית ומוסמכת" : "Professional Shatnez Inspection"}
                  </p>
                </div>

                <div className="flex justify-between items-center text-[10px] text-primary-300 font-mono tracking-wide z-10">
                  <span>📞 845-709-2022</span>
                  <span>shatnez-lab.vercel.app</span>
                </div>
              </div>

              {/* BACK SIDE (White & Navy Content) */}
              <div 
                className="absolute inset-0 w-full h-full rounded-2xl p-5 bg-white text-navy-900 flex justify-between border-2 border-navy-900 shadow-2xl overflow-hidden select-none"
                style={{ 
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)"
                }}
              >
                <div className="absolute inset-0 bg-primary-50/20 pointer-events-none" />
                
                {/* Details Section */}
                <div className={`flex flex-col justify-between text-left w-[62%] ${isRtl ? "text-right order-2 items-end" : "order-1"}`}>
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-xs text-navy-950 flex items-center gap-1.5">
                      <Microscope className="w-3.5 h-3.5 text-gold-500" />
                      <span>{isRtl ? "מעבדת השעטנז" : "The Shatnez Lab"}</span>
                    </h3>
                    <p className="text-[8px] text-primary-500 font-medium leading-relaxed">
                      {isRtl 
                        ? "בדיקות מעבדה, שירותי VIP וחנויות" 
                        : "Microscopic analysis, VIP pickups & certificates"}
                    </p>
                  </div>

                  <div className="space-y-1.5 py-1">
                    <div className={`flex items-center gap-1.5 text-[9px] text-primary-700 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <Phone className="w-3 h-3 text-gold-500 shrink-0" />
                      <span className="font-semibold">845-709-2022</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[9px] text-primary-700 ${isRtl ? "flex-row-reverse" : ""}`}>
                      <MapPin className="w-3 h-3 text-gold-500 shrink-0" />
                      <span>14 Buchanan Rd, Spring Valley</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-1 border-t border-primary-100 pt-1.5">
                    <span className="text-[7.5px] bg-primary-50 border border-primary-100 px-1.5 py-0.5 rounded font-bold text-navy-950">
                      {isRtl ? "פשוט: $5" : "Simple: $5"}
                    </span>
                    <span className="text-[7.5px] bg-primary-50 border border-primary-100 px-1.5 py-0.5 rounded font-bold text-navy-950">
                      {isRtl ? "בטנה: $10" : "Lined: $10"}
                    </span>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className={`flex flex-col items-center justify-center w-[33%] border-primary-100 ${isRtl ? "order-1 border-r pr-2 pr-0 pl-2 pl-0" : "order-2 border-l pl-2 pl-0 pr-2 pr-0"}`}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin + "/track" : "")}`} 
                    className="w-20 h-20 border border-primary-100 p-1 rounded-lg bg-white shadow-sm"
                    alt="QR Code"
                  />
                  <span className="text-[6.5px] text-primary-500 font-bold uppercase tracking-wider mt-1 block">
                    {isRtl ? "סרוק למעקב" : "Scan to track"}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Flip Hint */}
          <button 
            onClick={() => setIsFlipped(!isFlipped)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary-500 hover:text-navy-900 transition-colors font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isRtl ? "לחץ כדי להפוך כרטיס" : "Click to flip card"}
          </button>
        </div>

        {/* Buttons Action */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-sm mx-auto">
          <button
            onClick={handlePrint}
            className="btn-primary flex items-center justify-center gap-2 shadow-lg"
          >
            <Printer className="w-5 h-5" />
            {isRtl ? "הדפס כרטיס ביקור" : "Print Business Card"}
          </button>
          
          <a
            href="tel:845-709-2022"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-semibold border-2 border-navy-900/20 text-navy-900 hover:bg-navy-900/5 transition-all duration-300"
          >
            <Phone className="w-5 h-5" />
            {isRtl ? "התקשר למעבדה" : "Call Lab"}
          </a>
        </div>

        {/* Features Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-primary-100 text-right">
          {[
            {
              title: isRtl ? "שירות טלפוני 24/7" : "24/7 Phone Check System",
              desc: isRtl 
                ? "התקשרו למספר 845-709-2022 בכל שעה ועקבו אחר סטטוס ההזמנות שלכם באופן אוטומטי ומיידי."
                : "Dial 845-709-2022 anytime to query progress or manage drop-offs via automated IVR menu.",
              icon: Phone
            },
            {
              title: isRtl ? "כתובת למסירה" : "Lab Drop-Off Box",
              desc: isRtl
                ? "קופסת מסירה מאובטחת 24 שעות ביממה בכתובת 14 Buchanan Rd, Spring Valley NY."
                : "Drop your garments securely at 14 Buchanan Rd, Spring Valley NY. Safe drop-off box.",
              icon: MapPin
            },
            {
              title: isRtl ? "מחירון שעטנז" : "Clear Affordable Pricing",
              desc: isRtl
                ? "בגד פשוט כגון חולצות/מכנסיים ב-$5 בלבד. בגדים מורכבים עם בטנה כגון חליפות/מעילים ב-$10 בלבד."
                : "Simple items (shirts, pants) for $5. Complex lined garments (suits, coats) for $10.",
              icon: Layers
            }
          ].map((feat, idx) => (
            <div key={idx} className={`card p-6 flex flex-col gap-3 ${isRtl ? "text-right items-start" : "text-left items-start"}`}>
              <div className="w-10 h-10 bg-gold-400/10 rounded-xl flex items-center justify-center text-gold-600">
                <feat.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-navy-900 text-sm sm:text-base">{feat.title}</h3>
              <p className="text-xs text-primary-600 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
