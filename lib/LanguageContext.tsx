"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "en" | "he" | "yi";

interface Translations {
  [key: string]: {
    en: string;
    he: string;
    yi: string;
  };
}

export const translations: Translations = {
  // Navigation
  home: { en: "Home", he: "בית", yi: "היים" },
  track_order: { en: "Track Order", he: "מעקב הזמנה", yi: "טראק אָרדער" },
  contact: { en: "Contact", he: "צור קשר", yi: "קאָנטאַקט" },
  admin: { en: "Admin", he: "ניהול", yi: "אדמין" },
  
  // Hero Section
  hero_title: { en: "The Shatnez Lab", he: "מעבדת השעטנז", yi: "די שעטנז לאַבאָראַטאָריע" },
  hero_subtitle: { en: "Precision & Care", he: "דיוק ומסירות", yi: "פּינקטלעכקייט און זאָרג" },
  hero_desc: { 
    en: "Professional shatnez inspection services for your garments and textiles. In-lab testing and VIP home visits available.", 
    he: "שירותי בדיקת שעטנז מקצועיים לבגדים וטקסטיל. בדיקות במעבדה וביקורי VIP בבית הלקוח.", 
    yi: "פּראָפעסיאָנעלע שעטנז אינספּעקציע באַדינונגען פֿאַר אייערע קליידער. טעסטינג אין לאַבאָראַטאָריע און VIP היים וויזיטס." 
  },
  trusted_badge: { en: "Trusted Professional Shatnez Testing", he: "בדיקת שעטנז מקצועית ואמינה", yi: "פאַרלאָזלעך פאַכמאַן שעטנז טעסטינג" },
  
  // CTAs
  track_your_order: { en: "Track Your Order", he: "עקוב אחר הזמנתך", yi: "טראַק אייער אָרדער" },
  contact_us: { en: "Contact Us", he: "צרו קשר", yi: "קאָנטאַקט אונדז" },
  call_now: { en: "Call Now", he: "התקשרו עכשיו", yi: "רופט יעצט" },
  
  // Phone System
  phone_title: { en: "24/7 Automated Phone Updates", he: "עדכונים טלפוניים 24/7", yi: "24/7 אָטאַמאַטיק טעלעפאָן דערהייַנטיקונגען" },
  phone_desc: { 
    en: "Call (845) 552-4744 anytime to check your order status or add new testing requests.", 
    he: "התקשרו למספר (845) 552-4744 בכל עת כדי לבדוק סטטוס הזמנה או להוסיף בקשות בדיקה.", 
    yi: "רופט (845) 552-4744 קיין צייט צו קאָנטראָלירן אייער אָרדער סטאַטוס אָדער צוגעבן נייע טעסטינג רעקוועסטס." 
  },

  // Services
  our_services: { en: "Our Services", he: "השירותים שלנו", yi: "אונדזערע באַדינונגען" },
  services_desc: { en: "Comprehensive shatnez testing solutions tailored to your needs", he: "פתרונות בדיקת שעטנז מקיפים המותאמים לצרכים שלך", yi: "פולשטענדיק שעטנז טעסטינג סאַלושאַנז צוגעפּאַסט צו אייערע באדערפענישן" },
  in_lab: { en: "In-Lab Testing", he: "בדיקה במעבדה", yi: "טעסטינג אין לאַבאָראַטאָריע" },
  in_lab_desc: { en: "Thorough microscopic examination in our state-of-the-art facility.", he: "בדיקה מיקרוסקופית יסודית במתקן המתקדם שלנו.", yi: "גרונטיק מיקראָסקאָפּיק דורכקוק אין אונדזער מאָדערן מעכירעס." },
  vip_home: { en: "VIP Home Service", he: "שירות VIP עד הבית", yi: "VIP היים סערוויס" },
  vip_home_desc: { en: "Can't make it to the lab? We come to you! Premium home inspection.", he: "לא יכולים להגיע למעבדה? אנחנו באים אליכם! בדיקה בבית הלקוח.", yi: "קענט נישט קומען אין לאַבאָראַטאָריע? מיר קומען צו אייך! פּרעמיום היים דורכקוק." },
  express: { en: "Express Processing", he: "טיפול אקספרס", yi: "עקספּרעס פּראַסעסינג" },
  express_desc: { en: "Need results urgently? Same-day or next-day turnaround.", he: "צריכים תוצאות דחוף? שירות באותו יום או ביום למחרת.", yi: "דארפט רעזולטאַטן דרינגלעך? זעלבן טאָג אָדער ווייַטער טאָג." },

  // How it works
  how_it_works: { en: "How It Works", he: "איך זה עובד?", yi: "ווי עס אַרבעט" },
  how_desc: { en: "Simple, transparent process from drop-off to results", he: "תהליך פשוט ושקוף מהמסירה ועד התוצאות", yi: "פּשוט, טראַנספּעראַנט פּראָצעס פֿון אָפּגעבן ביז רעזולטאַטן" },
  step1_title: { en: "Submit Garment", he: "מסירת הבגד", yi: "אָפּגעבן קליידער" },
  step1_desc: { en: "Drop off at our lab or schedule VIP pickup", he: "מסירה במעבדה או קביעת איסוף VIP", yi: "אָפּגעבן אין לאַבאָראַטאָריע אָדער סקעדזשולן VIP פּיקאַפּ" },
  step2_title: { en: "Testing", he: "בדיקה", yi: "טעסטינג" },
  step2_desc: { en: "Expert microscopic analysis performed", he: "ביצוע ניתוח מיקרוסקופי מומחה", yi: "עקספּערט מיקראָסקאָפּיק אַנאַליסיס" },
  step3_title: { en: "Quality Check", he: "בקרת איכות", yi: "קוואַליטי טשעק" },
  step3_desc: { en: "Double-verified results for accuracy", he: "אימות כפול של התוצאות לדיוק מירבי", yi: "דאָבל-וועריפייד רעזולטאַטן פֿאַר פּינקטלעכקייט" },
  step4_title: { en: "Get Results", he: "קבלת תוצאות", yi: "באַקומען רעזולטאַטן" },
  step4_desc: { en: "Receive your report with status update", he: "קבלת דוח עם עדכון סטטוס", yi: "באַקומען אייער באַריכט מיט סטאַטוס דערהייַנטיקן" },

  // Footer / CTA Bottom
  ready_to_start: { en: "Ready to Get Started?", he: "מוכנים להתחיל?", yi: "גרייט צו אָנהייבן?" },
  cta_desc: { en: "Whether you need in-lab testing or our premium VIP home service, we're here to help.", he: "בין אם אתם צריכים בדיקה במעבדה או שירות VIP עד הבית, אנחנו כאן לעזור.", yi: "צי איר דאַרפֿן לאַבאָראַטאָריע טעסטינג אָדער אונדזער פּרעמיום VIP היים סערוויס, מיר זענען דאָ צו העלפן." },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  // Persist language choice
  useEffect(() => {
    const saved = localStorage.getItem("language") as Language;
    if (saved) setLanguage(saved);
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
    document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
    document.documentElement.lang = lang;
  };

  const t = (key: string) => {
    if (!translations[key]) return key;
    return translations[key][language];
  };

  const isRtl = language === "he" || language === "yi";

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t, isRtl }}>
      <div dir={isRtl ? "rtl" : "ltr"}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
