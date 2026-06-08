"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Eye, MessageSquare } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function PrivacyPolicyPage() {
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
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-3">
            {isRtl ? "מדיניות פרטיות" : "Privacy Policy"}
          </h1>
          <p className="text-primary-600">
            {isRtl 
              ? "כיצד אנו שומרים על המידע האישי והפרטיות שלך" 
              : "How we protect and manage your personal information"}
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
              <Lock className="w-5 h-5 text-gold-500 shrink-0" />
              {isRtl ? "1. איסוף מידע" : "1. Information We Collect"}
            </h2>
            <div className="text-sm leading-relaxed space-y-2">
              {isRtl ? (
                <p>
                  אנו אוספים מידע אישי על מנת להעניק לך שירותי בדיקת שעטנז מקצועיים ולעדכן אותך בסטטוס הבדיקה. המידע שאנו אוספים כולל שם, כתובת אימייל, מספר טלפון ופרטי הזמנה.
                </p>
              ) : (
                <p>
                  We collect personal information to provide you with professional shatnez testing services and keep you updated on the status of your garments. This includes your name, email address, phone number, and order details.
                </p>
              )}
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-gold-500 shrink-0" />
              {isRtl ? "2. שימוש במידע" : "2. How We Use Information"}
            </h2>
            <div className="text-sm leading-relaxed space-y-2">
              {isRtl ? (
                <p>
                  אנו משתמשים במידע שלך כדי לעבד הזמנות, לספק עדכוני סטטוס (בטלפון, SMS או אימייל), לנהל את שירות הלקוחות ולשפר את השירותים שלנו.
                </p>
              ) : (
                <p>
                  We use your information to process orders, provide status updates (via phone IVR, SMS notifications, or email), manage customer support, and improve our services.
                </p>
              )}
            </div>
          </section>

          {/* Section 3 - CRITICAL A2P 10DLC COMPLIANCE CLAUSE */}
          <section className="p-6 bg-gold-50 border border-gold-200 rounded-2xl space-y-3">
            <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gold-600 shrink-0" />
              {isRtl ? "3. מדיניות הודעות טקסט (SMS) ואי-שיתוף מידע" : "3. SMS Text Messaging & Non-Disclosure Policy"}
            </h2>
            <div className="text-sm leading-relaxed font-medium text-navy-900 space-y-3">
              {isRtl ? (
                <>
                  <p>
                    <strong>אנו מכבדים את הפרטיות שלך. שום מידע סלולרי לא ישותף עם צדדים שלישיים או שותפים למטרות שיווק או קידום מכירות.</strong>
                  </p>
                  <p>
                    כל הקטגוריות לעיל אינן כוללות מידע הסכמה ונתוני הצטרפות (Opt-in) למשלוח הודעות טקסט; מידע זה לא ישותף, יימכר או יועבר לאף גורם צד שלישי בשום נסיבות.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>We respect your privacy. No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong>
                  </p>
                  <p>
                    All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared, sold, or disclosed to any third parties under any circumstances.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy-900">
              {isRtl ? "4. אבטחת מידע" : "4. Data Security"}
            </h2>
            <div className="text-sm leading-relaxed space-y-2">
              {isRtl ? (
                <p>
                  אנו מיישמים אמצעי אבטחה טכנולוגיים וארגוניים מתאימים כדי להגן על המידע האישי שלך מפני גישה בלתי מורשית, אובדן או שינוי.
                </p>
              ) : (
                <p>
                  We implement appropriate technical and organizational security measures to protect your personal information from unauthorized access, loss, alteration, or disclosure.
                </p>
              )}
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-navy-900">
              {isRtl ? "5. צור קשר" : "5. Contact Us"}
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
