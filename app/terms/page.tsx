"use client";

import { motion } from "framer-motion";
import { FileText, HelpCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function TermsPage() {
  const { t, isRtl } = useLanguage();

  return (
    <div className="min-h-[calc(100vh-300px)] bg-primary-50 py-12 sm:py-16 lg:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`text-center mb-12 ${isRtl ? "text-right" : ""}`}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold-100 text-gold-600 mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-3">
            {isRtl ? "תנאי שימוש" : "Terms & Conditions"}
          </h1>
          <p className="text-primary-600">
            {isRtl 
              ? "תנאי השימוש והסכמי השירות של מעבדת השעטנז" 
              : "Service terms and conditions for The Shatnez Lab"}
          </p>
        </motion.div>

        {/* Content Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="card p-8 sm:p-10 space-y-8 text-primary-800"
        >
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-gold-500 shrink-0" />
              {isRtl ? "1. תיאור השירות" : "1. Description of Services"}
            </h2>
            <div className="text-sm leading-relaxed space-y-2">
              {isRtl ? (
                <p>
                  מעבדת השעטנז (The Shatnez Lab) מספקת שירותי בדיקה מעבדתיים מקצועיים לזיהוי שעטנז (תערובת צמר ופשתן) בבגדים ומוצרי טקסטיל. בנוסף, המערכת מציעה אפשרות למעקב הזמנות אונליין ועדכוני סטטוס אוטומטיים.
                </p>
              ) : (
                <p>
                  The Shatnez Lab provides professional laboratory testing services to inspect and verify the presence of shatnez (mixtures of wool and linen) in garments and textile products. The system also offers online order tracking and automated updates.
                </p>
              )}
            </div>
          </section>

          {/* Section 2 - SMS Terms - CRITICAL FOR A2P 10DLC COMPLIANCE */}
          <section className="p-6 bg-gold-50 border border-gold-200 rounded-2xl space-y-4">
            <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-gold-600 shrink-0" />
              {isRtl ? "2. תנאי הצטרפות להודעות טקסט (SMS)" : "2. SMS Text Messaging Terms"}
            </h2>
            <div className="text-sm leading-relaxed space-y-3 text-navy-900">
              {isRtl ? (
                <>
                  <p>
                    במסירת מספר הטלפון שלך במעבדה או באמצעות האתר, הינך מסכים לקבל הודעות טקסט (SMS) לנייד שלך לגבי עדכוני סטטוס ותפעול של ההזמנות שלך.
                  </p>
                  <ul className="list-disc list-inside space-y-2 pl-4">
                    <li>
                      <strong>ביטול השירות:</strong> באפשרותך לבטל את שירות ההודעות בכל עת. פשוט שלח את המילה <strong>STOP</strong> למספר ממנו קיבלת את ההודעה. לאחר שליחת STOP, נשלח אליך הודעה חוזרת לאישור הסרתך מהמנוי. לאחר מכן, לא תקבל מאיתנו הודעות נוספות. להצטרפות מחדש, ניתן להירשם שוב דרך האתר או במעבדה.
                    </li>
                    <li>
                      <strong>תמיכה ועזרה:</strong> אם נתקלת בבעיה בשירות ההודעות, תוכל להשיב במילה <strong>HELP</strong> לקבלת עזרה, או ליצור קשר ישירות בטלפון 845-552-4744.
                    </li>
                    <li>
                      <strong>עלויות ותדירות:</strong> דמי הודעות ונתונים עשויים לחול על פי תנאי תוכנית הסלולר שלך (Msg & data rates may apply). תדירות ההודעות משתנה בהתאם להתקדמות בדיקת הבגד שלך. פנה לספק הסלולר שלך לפרטים על תוכנית התעריפים שלך.
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <p>
                    By providing your mobile phone number at our lab intake or via our website, you consent to receive transactional and operational text messages (SMS) concerning your orders.
                  </p>
                  <ul className="list-disc list-inside space-y-2 pl-4">
                    <li>
                      <strong>Opt-Out:</strong> You can cancel the SMS service at any time. Just reply/text <strong>STOP</strong> to our phone number. After you send the message <strong>STOP</strong>, we will send you a reply to confirm that you have been unsubscribed. After this, you will no longer receive SMS messages from us. To rejoin, simply submit your request at the lab or sign up again.
                    </li>
                    <li>
                      <strong>Help:</strong> If you are experiencing issues with the messaging program, you can text <strong>HELP</strong> for assistance, or contact us directly at 845-552-4744.
                    </li>
                    <li>
                      <strong>Rates & Frequency:</strong> As always, message and data rates may apply for any messages sent to you from us and to us from you (Msg & data rates may apply). Message frequency varies based on your order activity. Please consult your wireless provider for questions about your text or data plan.
                    </li>
                  </ul>
                </>
              )}
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-gold-500 shrink-0" />
              {isRtl ? "3. קבלת החלטות הלכתיות" : "3. Halachic Information Disclaimer"}
            </h2>
            <div className="text-sm leading-relaxed space-y-2">
              {isRtl ? (
                <p>
                  המידע והנתונים המוצגים באתר נועדו למטרות הסברה וחינוך בלבד. אנו עושים מאמץ מירבי להבטיח את הדיוק המדעי והמקצועי של הבדיקות, אך להלכה למעשה ופסיקה סופית, יש להיוועץ עם סמכות הלכתית (מורה הוראה).
                </p>
              ) : (
                <p>
                  The information and interactive resources on this website are for educational and illustrative purposes. While we strive to achieve the highest level of professional laboratory precision, final halachic rulings should be obtained from a qualified rabbinical authority.
                </p>
              )}
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy-900">
              {isRtl ? "4. שינויים בתנאים" : "4. Changes to Terms"}
            </h2>
            <div className="text-sm leading-relaxed space-y-2">
              {isRtl ? (
                <p>
                  אנו שומרים לעצמנו את הזכות לעדכן או לשנות תנאים אלו בכל עת. השינויים ייכנסו לתוקף מיד עם פרסומם באתר זה. המשך השימוש בשירותים מהווה הסכמה לתנאים המעודכנים.
                </p>
              ) : (
                <p>
                  We reserve the right to update or modify these Terms & Conditions at any time. Changes will take effect immediately upon posting on this website. Continued use of our services constitutes acceptance of the updated terms.
                </p>
              )}
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy-900">
              {isRtl ? "5. פרטי התקשרות" : "5. Contact Info"}
            </h2>
            <div className="text-sm leading-relaxed space-y-1">
              <p className="font-semibold">The Shatnez Lab</p>
              <p>14 Buchanan Rd, Spring Valley, NY 10977</p>
              <p dir="ltr">Phone: 845-552-4744</p>
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
