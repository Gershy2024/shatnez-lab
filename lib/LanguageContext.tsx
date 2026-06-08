"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

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
  shipping: { en: "Ship to Us", he: "משלוח אלינו" },
  contact: { en: "Contact", he: "צור קשר" },
  admin: { en: "Admin", he: "ניהול" },
  business_card: { en: "Business Card", he: "כרטיס ביקור" },
  
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
    en: "Call 845-552-4744 anytime to check your order status or add new testing requests.", 
    he: "התקשרו למספר \u200E845-552-4744\u200E בכל עת כדי לבדוק סטטוס הזמנה או להוסיף בקשות בדיקה." 
  },

  // Our Services
  our_services: { en: "Our Services", he: "השירותים שלנו" },
  services_desc: { en: "Comprehensive shatnez testing solutions tailored to your needs", he: "פתרונות בדיקת שעטנז מקיפים המותאמים לצרכים שלך" },
  in_lab: { en: "In-Lab Testing", he: "בדיקה במעבדה" },
  in_lab_desc: { en: "Thorough microscopic examination in our state-of-the-art facility.", he: "בדיקה מיקרוסקופית יסודית במתקן המתקדם שלנו." },
  vip_home: { en: "VIP Home Service", he: "שירות VIP עד הבית" },
  vip_home_desc: { en: "Can't make it to the lab? We come to you! Premium home inspection.", he: "לא יכולים להגיע למעבדה? אנחנו באים אליכם! בדיקה בבית הלקוח." },
  store_testing: { en: "Store & Inventory Certification", he: "בדיקת חנויות ומלאי" },
  store_testing_desc: { en: "On-site certification for clothing stores and warehouses to ensure entire stock is shatnez-free.", he: "בדיקה ואישור של חנויות ביגוד ומחסנים במקום כדי להבטיח שכל המלאי נקי משעטנז." },

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

  // FAQ Section
  faq_title: { en: "Frequently Asked Questions", he: "שאלות ותשובות נפוצות" },
  faq_desc: { en: "Everything you need to know about our shatnez testing process and certified laboratory.", he: "כל מה שרציתם לדעת על תהליך בדיקת השעטנז המקצועי שלנו במעבדה המוסמכת." },
  faq_q1: { en: "How does the shatnez testing process work?", he: "איך עובד תהליך בדיקת השעטנז במעבדה?" },
  faq_a1: { en: "We carefully open hidden seams (like under collars or inside shoulder pads) and examine the internal fibers under a high-power microscope. We look for specific physical characteristics of linen and wool fibers (such as lumen or scales) to ensure they are not mixed.", he: "אנו פורמים בעדינות תפרים נסתרים (כמו תחתית הצווארון או כריות הכתפיים) ובוחנים את הסיבים הפנימיים תחת מיקרוסקופ עוצמתי במעבדה. אנו מחפשים מאפיינים פיזיים ספציפיים של פשתן וצמר (כמו לומן או קשקשים) כדי לוודא שאינם מעורבים, ולאחר מכן תופרים הכל בחזרה." },
  faq_q2: { en: "Why use a certified lab instead of checking myself?", he: "מה ההבדל בין בדיקה ביתית לבדיקת מעבדה מוסמכת?" },
  faq_a2: { en: "Shatnez fibers can be microscopically thin, blended directly into the yarn, or hidden deep inside the shoulder padding. A professional microscope and expert training are required to identify threads accurately. Visual inspection at home is not sufficient.", he: "סיבי שעטנז יכולים להיות דקים ברמה מיקרוסקופית, מעורבבים ישירות לתוך הסיב או חבויים עמוק בתוך כריות הכתפיים. נדרשים מיקרוסקופ מקצועי והכשרה מומחית כדי לזהות חוטים בצורה מדויקת. אי אפשר פשוט 'להסתכל' על הבגד ולהיות בטוחים שהוא נקי." },
  faq_q3: { en: "Which garments must be tested?", he: "אילו בגדים חייבים בבדיקה במעבדת שעטנז?" },
  faq_a3: { en: "Any garment containing wool or linen, especially structured clothing like men's suits, coats, and blazers from high-end brands. Even 100% synthetic garments should be checked if they have decorative wool or linen elements.", he: "כל בגד המכיל צמר או פשתן חייב בבדיקה, וכן בגדים מחויטים כמו חליפות גברים, מעילים וז'קטים ממותגים (לעיתים קרובות משתמשים בפשתן לחיזוק הצווארון גם אם הבד החיצוני הוא צמר טהור). חשוב לדעת שמותגים יקרים הם לרוב בעלי סיכון גבוה יותר מאשר חליפות זולות." },

  // Footer / CTA Bottom
  ready_to_start: { en: "Ready to Get Started?", he: "מוכנים להתחיל?" },
  cta_desc: { en: "Whether you need in-lab testing or our premium VIP home service, we're here to help.", he: "בין אם אתם צריכים בדיקה במעבדה או שירות VIP עד הבית, אנחנו כאן לעזור." },

  // Track Page
  track_title: { en: "Track Your Order", he: "עקוב אחר הזמנתך" },
  track_subtitle: { en: "Enter your order number or phone number to check the current status of your garment", he: "הזן את מספר ההזמנה או מספר הטלפון שלך כדי לבדוק את הסטטוס הנוכחי של הבגד" },
  search_placeholder: { en: "Enter order number or phone (e.g., 101 or 845-552-4744)", he: "הזן מספר הזמנה או טלפון (לדוגמה, 101 או ‎845-552-4744‎)" },
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
  email_us: { en: "Email Us", he: "שלחו לנו אימייל" },
  tap_to_email: { en: "Tap to send email (copies to clipboard)", he: "לחץ לשליחת אימייל (מעתיק ללוח)" },
  copied: { en: "Email copied to clipboard!", he: "האימייל הועתק ללוח בהצלחה!" },
  tap_to_map: { en: "Tap to view on map", he: "לחץ לפתיחה במפה" },
  whatsapp: { en: "WhatsApp", he: "וואטסאפ" },
  whatsapp_desc: { en: "Message us directly", he: "שלחו לנו הודעה" },
  quick_responses: { en: "Quick responses", he: "מענה מהיר" },
  location: { en: "Location", he: "מיקום" },
  hours: { en: "Hours", he: "שעות פעילות" },
  dropoff_info: { en: "Drop-off Info", he: "הנחיות מסירה" },
  dropoff_details: { 
    en: "Drop off garments at 14 Buchanan Rd. Place payment in the envelope/bag with the garment. Simple garments: $5. Lined garments (suits/coats): $10.",
    he: "מסרו את הבגדים בכתובת 14 Buchanan Rd. הניחו את התשלום במעטפה או שקית יחד עם הבגד. בגד פשוט: $5. בגד עם בטנה (חליפות/מעילים): $10."
  },
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
  test_result: { en: "Test Result", he: "תוצאת הבדיקה" },
  
  // Shatnez Info / Statistics Page
  shatnez_info: { en: "Shatnez Info", he: "מידע ושעטנז" },
  stats_title: { en: "Shatnez Statistics & Education", he: "סטטיסטיקה והסברה של שעטנז" },
  stats_subtitle: { en: "Explore real-time data from our laboratory and learn how to keep your garments shatnez-free.", he: "גלו נתונים בזמן אמת מהמעבדה שלנו ולמדו כיצד לשמור על הבגדים שלכם נקיים משעטנז." },
  stats_garments_tested: { en: "Garments Tested", he: "בגדים שנבדקו" },
  stats_shatnez_found: { en: "Shatnez Detected", he: "נמצא שעטנז" },
  stats_turnaround: { en: "Turnaround Time", he: "זמן טיפול ממוצע" },
  stats_active_cases: { en: "Currently Checking", he: "בבדיקה כעת" },
  stats_days_val: { en: "1-2 Business Days", he: "1-2 ימי עסקים" },
  
  // Interactive Garment Explorer
  stats_interactive_title: { en: "Interactive Garment Explorer", he: "חוקר בגד אינטראקטיבי" },
  stats_interactive_desc: { en: "Click on the highlighted target zones to reveal where shatnez is commonly found in tailored clothing.", he: "לחצו על אזורי המטרה המודגשים כדי לגלות היכן שעטנז מצוי בדרך כלל בביגוד מחויט." },
  
  // Hotspot Details (Collar, Shoulders, Canvas, Pockets, Tassels)
  hotspot_collar_title: { en: "Undercollar & Collar Stiffeners", he: "צווארון ותחתית הצווארון" },
  hotspot_collar_desc: { en: "Linen undercollar felt is often used in wool coats and suit jackets to maintain collar shape and stiffness.", he: "לבד פשתן מתחת לצווארון משמש לעיתים קרובות במעילי צמר וז'קטים כדי לשמור על צורת הצווארון ונוקשותו." },
  hotspot_shoulders_title: { en: "Shoulder Pads & Reinforcement", he: "כריות כתפיים וחיזוקים" },
  hotspot_shoulders_desc: { en: "Shoulder pads frequently contain canvas made from a mix of wool, cotton, linen, or recycled linen fibers.", he: "כריות כתפיים מכילות לעיתים קרובות בד קנבס העשוי מתערובת של צמר, כותנה, פשתן או סיבי פשתן ממוחזרים." },
  hotspot_canvas_title: { en: "Chest Canvas Interlining", he: "בטנת קנבס בחזה" },
  hotspot_canvas_desc: { en: "A structured interlining is sewn inside high-quality suits to drape naturally. This canvas often contains horsehair, wool, and linen threads.", he: "בטנה מובנית תפורה בתוך חליפות איכותיות כדי להעניק להן מראה טבעי. קנבס זה מכיל לעיתים קרובות שיער סוס, צמר וחוטי פשתן." },
  hotspot_pockets_title: { en: "Pocket Stays & Pocket Corners", he: "חיזוקי כיסים ופינות כיס" },
  hotspot_pockets_desc: { en: "Pocket openings and linings are often reinforced with linen tape or linen threads to prevent tearing under pressure.", he: "פתחי הכיסים והבטנות מחוזקים לעיתים קרובות בסרט פשתן או בחוטי פשתן כדי למנוע קרע תחת לחץ." },
  hotspot_linings_title: { en: "Linings & Interfacing", he: "בטנות ומקשחים" },
  hotspot_linings_desc: { en: "Internal linings, particularly in high-wear areas like cuffs, hems, or body linings, can contain hidden linen or wool threads.", he: "בטנות פנימיות, במיוחד באזורים בעלי שחיקה גבוהה כמו חפתים, מכפלות או בטנת הגוף, עלולות להכיל חוטי פשתן או צמר נסתרים." },

  // Educational Quiz Section
  stats_quiz_title: { en: "Shatnez Educational Quiz", he: "חידון שעטנז חינוכי" },
  stats_quiz_question_1: { en: "Is a label saying '100% Wool' enough to guarantee there is no Shatnez?", he: "האם תווית המציינת '100% צמר' מספיקה כדי להבטיח שאין שעטנז?" },
  stats_quiz_q1_op_yes: { en: "Yes, labels are legally binding.", he: "כן, תוויות מחייבות על פי חוק." },
  stats_quiz_q1_op_no: { en: "No, labels only represent the outer fabric.", he: "לא, התוויות מייצגות רק את הבד החיצוני." },
  stats_quiz_q1_explain: { en: "Correct! Labels are regulated only for outer fabrics. Internal canvases, shoulder pads, undercollars, and sewing threads are not required by law to be listed on standard clothing labels, and these are the most common places for linen to be mixed with wool.", he: "נכון! תוויות מחויבות בחוק רק עבור הבד החיצוני. קנבס פנימי, כריות כתפיים, תחתית הצווארון וחוטי תפירה אינם חייבים ברישום על פי החוק, ואלו בדיוק המקומות הנפוצים שבהם מעורב פשתן עם צמר." },
  
  stats_quiz_question_2: { en: "Which materials mixed together create Shatnez?", he: "אילו חומרים המעורבבים יחד יוצרים שעטנז?" },
  stats_quiz_q2_op_correct: { en: "Wool and Linen", he: "צמר ופשתן" },
  stats_quiz_q2_op_incorrect: { en: "Cotton and Linen, or Wool and Polyester", he: "כותנה ופשתן, או צמר ופוליאסטר" },
  stats_quiz_q2_explain: { en: "Correct! The biblical prohibition of Shatnez specifically applies only to the mixture of sheep's wool and linen. Other materials like cotton, polyester, silk, or cashmere mixed with wool or linen are permitted.", he: "נכון! איסור שעטנז מן התורה חל אך ורק על תערובת של צמר כבשים ופשתן. חומרים אחרים כמו כותנה, פוליאסטר, משי או קשמיר המעורבבים עם צמר או פשתן מותרים לחלוטין." },

  stats_quiz_question_3: { en: "Is checking required for synthetic garments like 100% Polyester?", he: "האם נדרשת בדיקה לבגדים סינתטיים כמו 100% פוליאסטר?" },
  stats_quiz_q3_op_yes: { en: "No, unless they have wool decorative threads/trims.", he: "לא, אלא אם כן יש בהם עיטורים או חוטים מצמר." },
  stats_quiz_q3_op_always: { en: "Yes, all garments must be checked equally.", he: "כן, יש לבדוק את כל הבגדים במידה שווה." },
  stats_quiz_q3_explain: { en: "Correct! Pure synthetic or cotton garments do not require shatnez checking unless they contain decorative wool/linen elements, collar attachments, or if there is a suspicion of mislabeling in high-risk brands.", he: "נכון! בגדים סינתטיים או כותנה טהורים אינם דורשים בדיקת שעטנז, אלא אם כן הם מכילים אלמנטים קישוטיים מצמר/פשתן, חיבורי צווארון, או אם קיים חשש לתווית כוזבת במותגים בסיכון גבוה." },

  // Myths Section
  stats_myths_title: { en: "Shatnez Myths vs. Facts", he: "שעטנז: מיתוסים מול עובדות" },
  stats_myths_desc: { en: "Debunking common misconceptions about shatnez testing and laws.", he: "מנפצים תפיסות מוטעות נפוצות לגבי בדיקת שעטנז והלכותיו." },
  
  myth_1_title: { en: "Myth: Only cheap suits or cheap clothing contain shatnez.", he: "מיתוס: רק חליפות או בגדים זולים מכילים שעטנז." },
  myth_1_desc: { en: "Fact: Actually, high-end, expensive designer suits often contain genuine linen canvases for structure, or linen undercollars for durability, making expensive garments higher risk than cheap polyester-blend suits.", he: "עובדה: למעשה, חליפות מעצבים יוקרתיות ויקרות מכילות לרוב קנבס פשתן אמיתי לצורך עיצוב המבנה, או תחתית צווארון מפשתן לעמידות, מה שהופך בגדים יקרים לבעלי סיכון גבוה יותר מאשר חליפות זולות המעורבות בפוליאסטר." },
  
  myth_2_title: { en: "Myth: If I buy from an Orthodox Jewish store, it is pre-checked.", he: "מיתוס: אם אני קונה מחנות של יהודים שומרי מצוות, זה נבדק מראש." },
  myth_2_desc: { en: "Fact: Unless the store explicitly gives you a certified Shatnez-Free tag attached to that specific garment, stores do not check every suit in stock. It is the customer's responsibility to bring it to a certified lab.", he: "עובדה: אלא אם כן החנות מצמידה במפורש תווית 'נקי משעטנז' מאושרת לבגד הספציפי הזה, החנויות אינן בודקות כל חליפה שבמלאי. באחריות הלקוח להביא את הבגד לבדיקה במעבדה מוסמכת." },
  
  myth_3_title: { en: "Myth: I can check for shatnez myself at home by looking closely.", he: "מיתוס: אני יכול לבדוק שעטנז בעצמי בבית על ידי הסתכלות מקרוב." },
  myth_3_desc: { en: "Fact: Shatnez fibers can be microscopically thin, blended directly into the yarn, or hidden deep inside the shoulder padding or collar. A professional microscope and expert training are required to identify threads accurately.", he: "עובדה: סיבי שעטנז יכולים להיות דקים ברמה מיקרוסקופית, מעורבבים ישירות לתוך הסיב, או חבויים עמוק בתוך כריות הכתפיים או הצווארון. נדרשים מיקרוסקופ מקצועי והכשרה מומחית כדי לזהות חוטים בצורה מדויקת." },

  // Disclaimer
  halachic_disclaimer: {
    en: "Important Note: This dashboard and visual guide are for educational and illustrative purposes only. For final halachic rulings, please consult a qualified Halachic authority (Moreh Hora'ah).",
    he: "הערה חשובה: לוח הבקרה והמדריך החזותי נועדו למטרות לימודיות והסברתיות בלבד. להלכה למעשה, יש להתייעץ עם מורה הוראה מוסמך."
  },

  // Fibers
  fiber_wool: { en: "Sheep's Wool", he: "צמר כבשים" },
  fiber_linen: { en: "Linen", he: "פשתן" },
  fiber_cotton: { en: "Cotton", he: "כותנה" },
  fiber_silk: { en: "Silk", he: "משי" },
  fiber_polyester: { en: "Polyester", he: "פוליאסטר" },
  fiber_cashmere: { en: "Cashmere", he: "קשמיר" },
  fiber_alpaca: { en: "Alpaca", he: "אלפקה" },

  // Brand Risk Directory
  brand_title: { en: "Brand Shatnez Risk Directory", he: "מדריך רמות סיכון של מותגים" },
  brand_desc: { en: "Search or browse risk ratings for popular brands based on actual lab findings.", he: "חפשו או דפדפו בדירוגי הסיכון של מותגים פופולריים על סמך ממצאים אמיתיים מהמעבדה." },
  brand_search_placeholder: { en: "Type brand name (e.g., Zara, Hugo Boss...)", he: "הקלידו שם מותג (למשל: זארה, הוגו בוס...)" },
  brand_risk_high: { en: "High Risk", he: "סיכון גבוה" },
  brand_risk_medium: { en: "Medium Risk", he: "סיכון בינוני" },
  brand_risk_low: { en: "Low Risk", he: "סיכון נמוך" },
  brand_common_zones: { en: "Typical findings:", he: "ממצאים שכיחים:" },

  // Lab Journey
  journey_title: { en: "Garment's Journey in the Lab", he: "מסע הבגד במעבדה" },
  journey_desc: { en: "Follow the step-by-step process of how we inspect and certify your clothing.", he: "עקבו אחר התהליך שלב אחר שלב שבו אנו בודקים ומאשרים את הבגדים שלכם." },
  journey_step_1_title: { en: "1. Intake & Logging", he: "1. קבלה ורישום" },
  journey_step_1_desc: { en: "The garment is received, tagged with a unique barcode, and registered in our database to ensure perfect tracking.", he: "הבגד מתקבל במעבדה, מוצמדת לו תווית ברקוד ייחודית והוא נרשם במערכת כדי להבטיח מעקב מושלם." },
  journey_step_2_title: { en: "2. Precision Opening", he: "2. פרימה עדינה" },
  journey_step_2_desc: { en: "Our technicians carefully open hidden seams under collars, linings, and shoulder pads to access internal components.", he: "הטכנאים שלנו פורמים בעדינות תפרים פנימיים נסתרים מתחת לצווארונים, בטנות וכריות כתפיים כדי לגשת לרכיבים הפנימיים." },
  journey_step_3_title: { en: "3. Microscope Analysis", he: "3. אנליזה מיקרוסקופית" },
  journey_step_3_desc: { en: "Threads are examined under high-power stereomicroscopes to inspect their structure and distinguish wool and linen fibers.", he: "הסיבים נבדקים תחת מיקרוסקופים סטריאוסקופיים רבי-עוצמה כדי לזהות את מבנה הסיב ולהבדיל בין צמר לפשתן." },
  journey_step_4_title: { en: "4. Chemical & Burn Tests", he: "4. מבחן בעירה וכימיה" },
  journey_step_4_desc: { en: "If fibers cannot be verified visually, we perform controlled chemical solubility tests or burn tests to verify the exact material.", he: "במקרים של ספק בסיבים, אנו מבצעים בדיקות מבוקרות של מסיסות כימית או שריפת סיבים כדי לוודא את סוג החומר המדויק." },
  journey_step_5_title: { en: "5. Resewing & Certification", he: "5. תפירה ואישור" },
  journey_step_5_desc: { en: "We close all opened seams to factory standards. If clean, we attach our certified 'Shatnez-Free' tag. If shatnez is found, we notify you and offer removal.", he: "אנו סוגרים ותופרים חזרה את כל התפרים שנפתחו לפי סטנדרט היצרן. במידה והבגד נקי, מוצמדת תווית מאושרת. אם נמצא שעטנז, אנו מעדכנים אתכם ומציעים שירות הסרה." },

  // Recent Alerts
  alerts_title: { en: "Recent Lab Alerts & Findings", he: "התראות וממצאים מהמעבדה" },
  alerts_desc: { en: "Stay updated on real garment issues discovered and resolved by our lab.", he: "התעדכנו בממצאים אמיתיים שהתגלו ותוקנו לאחרונה במעבדה שלנו." },
  alerts_garment: { en: "Garment:", he: "סוג הבגד:" },
  alerts_finding: { en: "Finding:", he: "הממצא:" },
  alerts_action: { en: "Action Taken:", he: "כיצד תוקן:" },

  // Admin Tested Items Guide (Explore Tab)
  admin_tab_explore: { en: "What We Inspect", he: "מה אנו בודקים" },
  explore_title: { en: "Shatnez Inspection Visual Guide", he: "מדריך חזותי לבדיקות שעטנז" },
  explore_subtitle: { en: "Interactive dashboard detailing target areas, risk levels, and laboratory guidelines for tested garments.", he: "לוח בקרה אינטראקטיבי המפרט אזורי מטרה, רמות סיכון והנחיות מעבדה לבגדים שנבדקים." },
  explore_search_placeholder: { en: "Search items (e.g. suit, sweater, pants...)", he: "חפש פריטים (למשל: חליפה, סוודר, מכנסיים...)" },
  explore_risk_level: { en: "Shatnez Risk:", he: "רמת סיכון שעטנז:" },
  explore_risk_high: { en: "High Risk", he: "סיכון גבוה" },
  explore_risk_medium: { en: "Medium Risk", he: "סיכון בינוני" },
  explore_risk_low: { en: "Low Risk", he: "סיכון נמוך" },
  explore_typical_areas: { en: "Typical Checked Areas:", he: "אזורים שכיחים לבדיקה:" },
  explore_lab_notes: { en: "Lab Verification Guidelines:", he: "הנחיות אימות במעבדה:" },
  explore_common_findings: { en: "Common Findings & History:", he: "ממצאים נפוצים והיסטוריה:" },
  explore_close_details: { en: "Close Details", he: "סגור פרטים" },
  explore_click_to_view: { en: "Click to explore testing guidelines", he: "לחץ כדי לחקור הנחיות בדיקה" },
  privacy_policy: { en: "Privacy Policy", he: "מדיניות פרטיות" },
  terms_conditions: { en: "Terms & Conditions", he: "תנאי שימוש" },
  sms_consent_text: {
    en: "By providing your phone number, you agree to receive text messages (such as order status updates) from The Shatnez Lab. Message & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help. View our",
    he: "במסירת מספר הטלפון שלך, הינך מסכים לקבל הודעות טקסט (כגון עדכוני סטטוס הזמנה) ממעבדת השעטנז. ייתכן שייגבו דמי הודעות ונתונים. תדירות ההודעות משתנה. השב STOP לביטול, HELP לעזרה. קרא את"
  },
  and: { en: "and", he: "וכן" },
  
  // Shipping Page
  shipping_title: { en: "Mail-In Shipping Instructions", he: "מדריך משלוח בגדים למעבדה" },
  shipping_subtitle: { en: "Send your garments to our laboratory from anywhere. Easy, quick, and secure.", he: "שלחו את הבגדים שלכם למעבדה שלנו מכל מקום. קל, מהיר ובטוח." },
  shipping_step1_title: { en: "1. Copy Our Address", he: "1. העתקת הכתובת" },
  shipping_step1_desc: { en: "Use the copy buttons below to easily paste our destination details into your shipping provider.", he: "השתמשו בכפתור ההעתקה למטה כדי להדביק את הכתובת שלנו ככתובת היעד באתר המשלוחים." },
  shipping_step2_title: { en: "2. Buy & Print a Label", he: "2. קניית תווית משלוח" },
  shipping_step2_desc: { en: "We recommend using Pirate Ship for the cheapest commercial rates (UPS & USPS), or purchase directly from USPS or UPS.", he: "אנו ממליצים להשתמש ב-Pirate Ship לקבלת המחירים המוזלים ביותר (USPS ו-UPS), או לקנות ישירות מ-USPS או UPS." },
  shipping_step3_title: { en: "3. Pack & Include Contact Info", he: "3. אריזה ופרטי קשר" },
  shipping_step3_desc: { en: "Pack your garments securely. You MUST include a note inside the package with your Name, Phone Number, and return address so we can contact you.", he: "ארזו את הבגדים היטב. חובה לצרף פתק בתוך החבילה עם שמכם המלא, מספר טלפון וכתובת חזרה כדי שנוכל לעדכן אתכם." },
  shipping_step4_title: { en: "4. Mail & Track", he: "4. שליחה ומעקב" },
  shipping_step4_desc: { en: "Drop the package off at any post office or carrier box. We will contact you as soon as it arrives and we log it in!", he: "מסרו את החבילה בכל סניף דואר או נקודת שירות. אנו ניצור איתכם קשר ברגע שהחבילה תגיע ותירשם במערכת." },
  our_address: { en: "Our Mailing Address", he: "כתובת המעבדה למשלוח" },
  copy_full_address: { en: "Copy Full Address", he: "העתק כתובת מלאה" },
  copied_address: { en: "Copied!", he: "הועתק ללוח!" },
  copy_field: { en: "Copy {field}", he: "העתק {field}" },
  street: { en: "Street", he: "רחוב" },
  city: { en: "City", he: "עיר" },
  state: { en: "State", he: "מדינה" },
  zip: { en: "Zip Code", he: "מיקוד" },
  name_placeholder: { en: "The Shatnez Lab", he: "מעבדת השעטנז" },
  shipping_carriers_title: { en: "Recommended Shipping Providers", he: "חברות שילוח מומלצות" },
  pirateship_desc: { en: "Free account, 100% free to use. Provides deep commercial discounts (up to 89% off) for USPS & UPS labels. Perfect for individual packages.", he: "שירות פופולרי וחינמי המציע הנחות ענק (עד 89% הנחה) עבור תוויות של USPS ו-UPS. מומלץ מאוד לחבילות בודדות." },
  usps_desc: { en: "Buy directly from the United States Postal Service online. Best for standard domestic mailing.", he: "קנו תווית ישירות מהאתר הרשמי של דואר ארה\"ב. מתאים למכתבים וחבילות קטנות." },
  ups_desc: { en: "Buy directly from United Parcel Service. Reliable and fast for larger, structured garments like suits and heavy coats.", he: "קנו תווית ישירות מ-UPS. אמין ומהיר, במיוחד לחבילות גדולות או פריטים כבדים כמו חליפות ומעילים." },
  buy_label_on: { en: "Go to {site}", he: "מעבר לאתר {site}" },
  inclusion_checklist: { en: "Important Checklist for Your Package", he: "רשימת תיוג חשובה לפני שסוגרים את החבילה" },
  checklist_name: { en: "Your Full Name, Phone Number, and return address", he: "שמכם המלא, מספר הטלפון וכתובת למשלוח חזרה" },
  checklist_items: { en: "Number of garments and type (e.g. 1 suit, 2 coats) so we can verify", he: "מספר הבגדים וסוגם (כדי שנוכל לוודא ששום דבר לא הלך לאיבוד)" },
  checklist_payment: { en: "Payment inside the bag ($5 per simple item, $10 per lined item)", he: "צירוף תשלום בתוך החבילה ($5 לבגד פשוט, $10 לבגד מעומלן או עם בטנה כגון חליפה/מעיל)" },
  checklist_ready: { en: "I have packed everything correctly!", he: "ארזתי את הכל כנדרש!" },
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
