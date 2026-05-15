export type Language = "en" | "he";

interface Translations {
  [key: string]: {
    en: string;
    he: string;
  };
}

export const translations: Translations = {
  // Navigation
  home: { en: "Home", he: "בית" },
  track_order: { en: "Track Order", he: "מעקב הזמנה" },
  contact: { en: "Contact", he: "צור קשר" },
  admin: { en: "Admin", he: "ניהול" },
  
  // Hero Section
  hero_title: { en: "The Shatnez Lab", he: "מעבדת השעטנז" },
  hero_subtitle: { en: "Precision & Care", he: "דיוק ומסירות" },
  hero_desc: { 
    en: "Professional shatnez inspection services for your garments and textiles. In-lab testing and VIP home visits available.", 
    he: "שירותי בדיקת שעטנז מקצועיים לבגדים וטקסטיל. בדיקות במעבדה וביקורי VIP בבית הלקוח." 
  },
  trusted_badge: { en: "Trusted Professional Shatnez Testing", he: "בדיקת שעטנז מקצועית ואמינה" },
  
  // CTAs
  track_your_order: { en: "Track Your Order", he: "עקוב אחר הזמנתך" },
  contact_us: { en: "Contact Us", he: "צרו קשר" },
  call_now: { en: "Call Now", he: "התקשרו עכשיו" },
  
  // Phone System
  phone_title: { en: "24/7 Automated Phone Updates", he: "עדכונים טלפוניים 24/7" },
  phone_desc: { 
    en: "Call (845) 552-4744 anytime to check your order status or add new testing requests.", 
    he: "התקשרו למספר (845) 552-4744 בכל עת כדי לבדוק סטטוס הזמנה או להוסיף בקשות בדיקה." 
  },

  // Services
  our_services: { en: "Our Services", he: "השירותים שלנו" },
  services_desc: { en: "Comprehensive shatnez testing solutions tailored to your needs", he: "פתרונות בדיקת שעטנז מקיפים המותאמים לצרכים שלך" },
  in_lab: { en: "In-Lab Testing", he: "בדיקה במעבדה" },
  in_lab_desc: { en: "Thorough microscopic examination in our state-of-the-art facility.", he: "בדיקה מיקרוסקופית יסודית במתקן המתקדם שלנו." },
  vip_home: { en: "VIP Home Service", he: "שירות VIP עד הבית" },
  vip_home_desc: { en: "Can't make it to the lab? We come to you! Premium home inspection.", he: "לא יכולים להגיע למעבדה? אנחנו באים אליכם! בדיקה בבית הלקוח." },
  express: { en: "Express Processing", he: "טיפול אקספרס" },
  express_desc: { en: "Need results urgently? Same-day or next-day turnaround.", he: "צריכים תוצאות דחוף? שירות באותו יום או ביום למחרת." },

  // How it works
  how_it_works: { en: "How It Works", he: "איך זה עובד?" },
  how_desc: { en: "Simple, transparent process from drop-off to results", he: "תהליך פשוט ושקוף מהמסירה ועד התוצאות" },
  step1_title: { en: "Submit Garment", he: "מסירת הבגד" },
  step1_desc: { en: "Drop off at our lab or schedule VIP pickup", he: "מסירה במעבדה או קביעת איסוף VIP" },
  step2_title: { en: "Testing", he: "בדיקה" },
  step2_desc: { en: "Expert microscopic analysis performed", he: "ביצוע ניתוח מיקרוסקופי מומחה" },
  step3_title: { en: "Quality Check", he: "בקרת איכות" },
  step3_desc: { en: "Double-verified results for accuracy", he: "אימות כפול של התוצאות לדיוק מירבי" },
  step4_title: { en: "Get Results", he: "קבלת תוצאות" },
  step4_desc: { en: "Receive your report with status update", he: "קבלת דוח עם עדכון סטטוס" },

  // Footer / CTA Bottom
  ready_to_start: { en: "Ready to Get Started?", he: "מוכנים להתחיל?" },
  cta_desc: { en: "Whether you need in-lab testing or our premium VIP home service, we're here to help.", he: "בין אם אתם צריכים בדיקה במעבדה או שירות VIP עד הבית, אנחנו כאן לעזור." },

  // Track Page
  track_title: { en: "Track Your Order", he: "עקוב אחר הזמנתך" },
  track_subtitle: { en: "Enter your order number or phone number to check the current status of your garment", he: "הזן את מספר ההזמנה או מספר הטלפון שלך כדי לבדוק את הסטטוס הנוכחי של הבגד" },
  search_placeholder: { en: "Enter order number or phone (e.g., ORD-001 or 845-709-2022)", he: "הזן מספר הזמנה או טלפון (למשל, ORD-001 או 845-709-2022)" },
  search_btn: { en: "Track", he: "עקוב" },
  searching: { en: "Searching...", he: "מחפש..." },
  order_not_found: { en: "Order Not Found", he: "הזמנה לא נמצאה" },
  not_found_desc: { en: "We couldn't find an order with that number or phone. Please double-check and try again, or contact us for assistance.", he: "לא הצלחנו למצוא הזמנה עם המספר או הטלפון הזה. אנא בדוק שנית ונסה שוב, או צור קשר לעזרה." },
  found_orders: { en: "Found {n} Orders", he: "נמצאו {n} הזמנות" },
  back_to_results: { en: "← Back to results", he: "← חזרה לתוצאות" },
  progress: { en: "Progress", he: "התקדמות" },
  order_details: { en: "Order Details", he: "פרטי הזמנה" },
  customer: { en: "Customer", he: "לקוח" },
  date_received: { en: "Date Received", he: "תאריך קבלה" },
  est_completion: { en: "Estimated Completion", he: "סיום משוער" },
  phone: { en: "Phone", he: "טלפון" },
  notes: { en: "Notes", he: "הערות" },
  call: { en: "Call", he: "התקשר" },
  sms: { en: "SMS", he: "הודעה" },

  // Statuses
  status_received: { en: "Received", he: "התקבל" },
  status_testing: { en: "In Testing", he: "בבדיקה" },
  status_review: { en: "Under Review", he: "בביקורת" },
  status_ready: { en: "Ready for Pickup", he: "מוכן לאיסוף" },
  status_delivered: { en: "Delivered", he: "נמסר" },
  status_issue: { en: "Attention Needed", he: "דרוש טיפול" },
  
  status_desc_received: { en: "Your garment has been received and logged into our system.", he: "הבגד שלך התקבל ונרשם במערכת שלנו." },
  status_desc_testing: { en: "Our technicians are currently performing microscopic analysis.", he: "הטכנאים שלנו מבצעים כעת ניתוח מיקרוסקופי." },
  status_desc_review: { en: "Results are being double-checked by senior staff for accuracy.", he: "התוצאות נבדקות פעמיים על ידי צוות בכיר לדיוק מירבי." },
  status_desc_ready: { en: "Testing is complete! Your garment is ready for pickup or delivery.", he: "הבדיקה הושלמה! הבגד שלך מוכן לאיסוף או למשלוח." },
  status_desc_delivered: { en: "Your garment has been delivered. Thank you for your business!", he: "הבגד שלך נמסר. תודה שבחרת בנו!" },
  status_desc_issue: { en: "Please contact us regarding your order.", he: "אנא צור קשר בנוגע להזמנה שלך." },

  // Contact Page
  get_in_touch: { en: "Get in Touch", he: "צרו קשר" },
  contact_subtitle: { en: "Have questions or need to schedule a service? We're here to help.", he: "יש לכם שאלות או צריכים לקבוע שירות? אנחנו כאן לעזור." },
  call_us: { en: "Call Us", he: "התקשרו אלינו" },
  tap_to_call: { en: "Tap to call now", he: "לחץ להתקשרות" },
  whatsapp: { en: "WhatsApp", he: "וואטסאפ" },
  whatsapp_desc: { en: "Message us directly", he: "שלחו לנו הודעה" },
  quick_responses: { en: "Quick responses", he: "מענה מהיר" },
  location: { en: "Location", he: "מיקום" },
  hours: { en: "Hours", he: "שעות פעילות" },
  send_message: { en: "Send a Message", he: "שלחו הודעה" },
  name: { en: "Name", he: "שם" },
  email: { en: "Email", he: "אימייל" },
  message: { en: "Message", he: "הודעה" },
  your_name: { en: "Your name", he: "השם שלך" },
  your_phone: { en: "Your phone number", he: "מספר הטלפון שלך" },
  your_email: { en: "your@email.com", he: "your@email.com" },
  how_can_help: { en: "How can we help you?", he: "איך אפשר לעזור לך?" },
  send_btn: { en: "Send Message", he: "שלח הודעה" },
  msg_sent: { en: "Message Sent!", he: "ההודעה נשלחה!" },
  msg_sent_desc: { en: "We'll get back to you as soon as possible.", he: "נחזור אליך בהקדם האפשרי." },
  
  // Admin Page
  admin_panel: { en: "Admin Panel", he: "לוח ניהול" },
  orders_management: { en: "Orders Management", he: "ניהול הזמנות" },
  phone_settings: { en: "Phone Settings", he: "הגדרות טלפון" },
  logout: { en: "Logout", he: "התנתק" },
  enter_pin: { en: "Enter Admin PIN", he: "הזן קוד מנהל" },
  login: { en: "Login", he: "התחבר" },
  stats: { en: "Stats", he: "סטטיסטיקה" },
  total_orders: { en: "Total Orders", he: "סה\"כ הזמנות" },
  active_testing: { en: "Active Testing", he: "בבדיקה פעילה" },
  ready_for_pickup: { en: "Ready for Pickup", he: "מוכן לאיסוף" },
  add_new_order: { en: "Add New Order", he: "הוסף הזמנה חדשה" },
  search_orders: { en: "Search orders...", he: "חפש הזמנות..." },
  customer_name: { en: "Customer Name", he: "שם הלקוח" },
  status: { en: "Status", he: "סטטוס" },
  date: { en: "Date", he: "תאריך" },
  actions: { en: "Actions", he: "פעולות" },
  customer: { en: "Customer", he: "לקוח" },
  date_received: { en: "Date Received", he: "תאריך קבלה" },
  est_completion: { en: "Est. Completion", he: "סיום משוער" },
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
    if (saved === "en" || saved === "he") {
      setLanguage(saved);
      document.documentElement.dir = saved === "en" ? "ltr" : "rtl";
      document.documentElement.lang = saved;
    }
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

  const isRtl = language === "he";

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
