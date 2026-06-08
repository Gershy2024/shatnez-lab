"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Microscope, 
  ShieldAlert, 
  Activity, 
  Clock, 
  Award, 
  HelpCircle, 
  CheckCircle, 
  XCircle, 
  Info,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Search,
  X
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { getAllOrders, Order } from "@/lib/db";

interface GarmentDetail {
  id: string;
  name: { en: string; he: string };
  risk: "high" | "medium" | "low" | "custom";
  checkedAreas: { en: string[]; he: string[] };
  labNotes: { en: string; he: string };
  commonFindings: { en: string; he: string };
  svg: (colorClass: string) => React.ReactNode;
}

const GARMENT_ITEMS: GarmentDetail[] = [
  {
    id: "suits",
    name: { en: "Suits & Jackets", he: "חליפות וז'קטים" },
    risk: "high",
    checkedAreas: {
      en: ["Undercollar canvas (felt)", "Chest canvas interfacing", "Shoulder pads", "Sleeve hem linings", "Label attachment threads"],
      he: ["צווארון תחתון (לבד)", "בטנת קנבס בחזה", "כריות כתפיים", "בטנת מכפלת השרוול", "חוטי תפירה של התווית"]
    },
    labNotes: {
      en: "Inspect collars closely. High-end jackets almost always use wool felt mixed with linen reinforcing stitch. Carefully separate and extract threads for microscopic review.",
      he: "בדוק צווארונים בקפידה. ז'קטים יוקרתיים משתמשים כמעט תמיד בלבד צמר המעורבב עם חיזוק פשתן. יש להפריד ולשלוף חוטים בעדינות לבדיקה מיקרוסקופית."
    },
    commonFindings: {
      en: "Linen canvas interfacing inside the lapels is the single most frequent cause of shatnez found in menswear.",
      he: "בטנת קנבס מפשתן בתוך הדש (lapels) היא הסיבה השכיחה ביותר לשעטנז שנמצא בבגדי גברים."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M20 20 L35 85 L50 90 L65 85 L80 20 L68 15 L50 35 L32 15 Z" fill="currentColor" opacity="0.1" />
        <path d="M20 20 L35 85 L50 90 L65 85 L80 20 L68 15 L50 35 L32 15 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M32 15 L42 45 L50 35 L58 45 L68 15" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" />
        <path d="M50 35 L47 55 L50 58 L53 55 Z" fill="#d4af37" opacity="0.6" />
        <path d="M42 15 L50 25 L58 15" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="50" cy="65" r="2.5" fill="#d4af37" />
        <circle cx="50" cy="75" r="2.5" fill="#d4af37" />
        <line x1="28" y1="60" x2="38" y2="60" stroke="currentColor" strokeWidth="2" />
        <line x1="62" y1="60" x2="72" y2="60" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  },
  {
    id: "ladies_coats",
    name: { en: "Ladies Coats", he: "מעילי נשים" },
    risk: "high",
    checkedAreas: {
      en: ["Collar structural lining", "Sleeve cuff bindings", "Inside pocket stays", "Inner decorative trims", "Sewing threads"],
      he: ["מקשחי צווארון מובנים", "חיבורי שולי שרוולים", "תומכי כיסים פנימיים", "סרטים וקישוטים דקורטיביים", "חוטי תפירה"]
    },
    labNotes: {
      en: "Verify the content of the decorative wool piping or lining. Designer brands commonly mix linen threads in wool embroidery and internal reinforcement strips.",
      he: "בדוק את התוכן של עיטורי צמר דקורטיביים או הבטנה. מותגי מעצבים משלבים לרוב חוטי פשתן ברקמת צמר וברצועות חיזוק פנימיות."
    },
    commonFindings: {
      en: "Linen-wool blended threads found in the embroidery patterns of winter wool coats.",
      he: "חוטים מעורבים של פשתן וצמר נמצאו בדוגמאות רקמה של מעילי צמר לחורף."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M25 15 L32 85 L50 92 L68 85 L75 15 L60 12 L50 30 L40 12 Z" fill="currentColor" opacity="0.1" />
        <path d="M25 15 L32 85 L50 92 L68 85 L75 15 L60 12 L50 30 L40 12 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="34" y="50" width="32" height="6" rx="2" fill="#d4af37" opacity="0.8" />
        <circle cx="42" cy="35" r="2" fill="currentColor" />
        <circle cx="58" cy="35" r="2" fill="currentColor" />
        <circle cx="42" cy="45" r="2" fill="currentColor" />
        <circle cx="58" cy="45" r="2" fill="currentColor" />
        <path d="M40 12 L46 38 L50 30 L54 38 L60 12" fill="none" stroke="#d4af37" strokeWidth="2" />
      </svg>
    )
  },
  {
    id: "sweaters",
    name: { en: "Children's Sweaters", he: "סוודרי ילדים" },
    risk: "medium",
    checkedAreas: {
      en: ["Elbow patches and stitching", "Neckline stabilization tape", "Blended collar threads", "Brand labels"],
      he: ["טלאי מרפקים ותפירתם", "סרט תמיכה וייצוב בצווארון", "חוטי צווארון מעורבים", "תווית המותג"]
    },
    labNotes: {
      en: "While the knit itself is usually cotton, synthetic, or acrylic, check decorative elbow patches or collars which might be wool/linen blends.",
      he: "בעוד שהסריג עצמו הוא בדרך כלל כותנה, אקריליק או סינתטי, יש לבדוק טלאי מרפק קישוטיים או צווארונים העלולים להכיל תערובות צמר/פשתן."
    },
    commonFindings: {
      en: "Linen threads used to sew wool patches on children's knitted sweaters.",
      he: "חוטי פשתן ששימשו לתפירת טלאי צמר על סוודרים סרוגים של ילדים."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M25 25 L20 45 L28 48 L30 85 L70 85 L72 48 L80 45 L75 25 Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M30 40 L70 40" stroke="#d4af37" strokeWidth="2" strokeDasharray="3 3" />
        <path d="M30 55 L70 55" stroke="#d4af37" strokeWidth="2.5" />
        <path d="M30 70 L70 70" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
        <path d="M42 25 C45 29, 55 29, 58 25" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "ties",
    name: { en: "Ties", he: "עניבות" },
    risk: "medium",
    checkedAreas: {
      en: ["Inner canvas interlining", "Brand tag stitching", "Tipping fabric (inner end linings)"],
      he: ["בטנת קנבס פנימית", "תפרי תווית המותג", "קצוות בד הבטנה הפנימית"]
    },
    labNotes: {
      en: "Squeeze the tie to feel the inner canvas lining. High-end ties often use linen canvas to help the silk hang without wrinkling. Test the canvas fibers.",
      he: "לחץ על העניבה כדי לחוש בבטנת הקנבס הפנימית. עניבות יוקרתיות משתמשות לרוב בקנבס פשתן כדי לעזור למשי להישאר ללא קמטים. בדוק את סיבי הקנבס."
    },
    commonFindings: {
      en: "Pure wool tie containing a starch-treated linen inner canvas strip.",
      he: "עניבת צמר טהור המכילה רצועת קנבס פנימית מפשתן מוקשה בעמילן."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M35 15 C42 10, 58 10, 65 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M44 20 L56 20 L53 30 L47 30 Z" fill="#d4af37" stroke="#d4af37" strokeWidth="1" />
        <path d="M47 30 L53 30 L57 80 L50 90 L43 80 Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="46" y1="40" x2="54" y2="45" stroke="#d4af37" strokeWidth="2.5" />
        <line x1="48" y1="52" x2="56" y2="57" stroke="#d4af37" strokeWidth="2.5" />
        <line x1="50" y1="64" x2="56" y2="68" stroke="#d4af37" strokeWidth="2.5" />
      </svg>
    )
  },
  {
    id: "hats",
    name: { en: "Hats", he: "כובעים" },
    risk: "medium",
    checkedAreas: {
      en: ["Inner crown buckram", "Brim structural backing", "Sweatband reinforcement", "Stitching thread"],
      he: ["חומר הקשחה פנימי (Buckram)", "תומך מבנה השוליים", "חיזוק סרט הזיעה", "חוטי תפירה"]
    },
    labNotes: {
      en: "Check wool felt hats. The stiffening materials used inside the brim or crown support often contain linen or flax fibers to maintain rigidity.",
      he: "בדוק כובעי לבד מצמר. חומרי ההקשחה המשמשים בשוליים או בכיפת הכובע מכילים לעיתים קרובות סיבי פשתן כדי לשמור על היציבות."
    },
    commonFindings: {
      en: "Linen canvas support sheet stitched directly inside the brim of a wool-felt fedora.",
      he: "יריעת תמיכה מקנבס פשתן התפורה ישירות בתוך שולי כובע פדורה מלבד צמר."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M30 50 C30 20, 70 20, 70 50 Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2.5" />
        <path d="M30 48 L70 48" stroke="#d4af37" strokeWidth="4" />
        <path d="M15 54 C30 54, 70 54, 85 54 C92 54, 92 48, 85 48 C70 48, 30 48, 15 48 C8 48, 8 54, 15 54 Z" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  },
  {
    id: "pants",
    name: { en: "Pants & Trousers", he: "מכנסיים" },
    risk: "low",
    checkedAreas: {
      en: ["Waistband lining and canvas", "Belt loops", "Pocket linings and stays", "Crotch reinforcements"],
      he: ["בטנת חגורת המכנסיים", "לולאות חגורה", "בטנות הכיסים וחיזוקיהם", "תומך פנימי במפשעה"]
    },
    labNotes: {
      en: "Look inside the waistband. Although low risk, wool pants can occasionally contain linen-cotton blended tape inside the waistband for structure.",
      he: "בדוק בתוך חגורת המכנסיים. למרות שרמת הסיכון נמוכה, מכנסי צמר עלולים לפעמים להכיל סרט מעורב פשתן-כותנה בתוך חגורת המכנסיים לעיצוב."
    },
    commonFindings: {
      en: "Linen sizing canvas used inside the waistband stabilizer of wool dress pants.",
      he: "קנבס פשתן המשמש בתוך מייצב חגורת המכנסיים של מכנסי צמר מחויטים."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M30 15 L70 15 L70 22 L30 22 Z" fill="#d4af37" opacity="0.7" />
        <path d="M30 22 L34 90 L48 90 L50 45 L52 90 L66 90 L70 22 Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="41" y1="28" x2="41" y2="85" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="59" y1="28" x2="59" y2="85" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M30 30 L36 38" stroke="currentColor" strokeWidth="1.5" />
        <path d="M70 30 L64 38" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    id: "fiber_id",
    name: { en: "Fiber Identification", he: "זיהוי סיבים" },
    risk: "custom",
    checkedAreas: {
      en: ["Polarized microscopy check", "Burn tests (smell & ash)", "Chemical solubility tests", "Fiber surface node patterns"],
      he: ["בדיקה במיקרוסקופ מקטב", "מבחן בעירה (ריח ואפר)", "מבחני מסיסות כימית", "דוגמת צומת של סיבים"]
    },
    labNotes: {
      en: "Linen has transverse nodes (nodes looking like bamboo joints) and is strongly birefringent under polarized light. Wool shows scale patterns.",
      he: "לפשתן יש קשרים רוחביים (צמתים הדומים למפרקי במבוק) והוא מחזיר אור חזק תחת אור מקטב. לסיב צמר יש קשקשים ייחודיים."
    },
    commonFindings: {
      en: "Identification of pure linen blended inside synthetic-looking threads in labels.",
      he: "זיהוי פשתן טהור המעורבב בתוך חוטים בעלי מראה סינתטי בתוויות הבגד."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <circle cx="45" cy="45" r="28" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="45" cy="45" r="24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" strokeDasharray="2 2" />
        <line x1="65" y1="65" x2="88" y2="88" stroke="#d4af37" strokeWidth="6" strokeLinecap="round" />
        <line x1="68" y1="68" x2="85" y2="85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 35 Q45 50, 60 35" fill="none" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
        <path d="M35 55 Q45 35, 55 55" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "shoes",
    name: { en: "Shoes & Slippers", he: "נעליים ונעלי בית" },
    risk: "medium",
    checkedAreas: {
      en: ["Inner textile layers", "Stitched logos", "Felted insoles", "Under-tongue pads"],
      he: ["שכבות טקסטיל פנימיות", "לוגואים רקומים", "רפידות לבד", "ריפוד מתחת ללשונית"]
    },
    labNotes: {
      en: "Wool felt insoles or wool lining in sneakers/slippers must be checked. The glue backing or canvas backing of the insole might contain linen fibers.",
      he: "יש לבדוק רפידות לבד מצמר או בטנות צמר בנעלי ספורט או נעלי בית. גב הדבק או בד החיזוק של הרפידה עלולים להכיל סיבי פשתן."
    },
    commonFindings: {
      en: "Linen-backed canvas inside the reinforced heel support of wool slippers.",
      he: "קנבס מגובה בפשתן בתוך חיזוק העקב של נעלי בית מצמר."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M15 50 C20 40, 40 38, 55 45 C65 42, 80 48, 88 65 C85 70, 75 72, 50 72 C25 72, 18 62, 15 50 Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M14 62 L89 65 L87 70 L16 70 Z" fill="#d4af37" opacity="0.8" />
        <path d="M48 42 L52 48 M45 44 L50 50 M42 46 L47 52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M22 56 Q50 58, 80 60" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    )
  },
  {
    id: "linen_garments",
    name: { en: "Linen Garments", he: "בגדי פשתן" },
    risk: "high",
    checkedAreas: {
      en: ["Button sewing threads", "Shoulder yoke pads", "Collar interfacing", "Decorative wool embroidery", "Brand labels"],
      he: ["חוטי תפירת כפתורים", "בטנת כתפיים אחורית (Yoke)", "מקשח צווארון פנימי", "רקמת צמר דקורטיבית", "תוויות מותג"]
    },
    labNotes: {
      en: "In a 100% linen shirt, check that the threads used to sew the buttons or structural seams do not contain wool fibers. Check wool embroidery threads on linen dresses.",
      he: "בחולצת 100% פשתן, ודא שהחוטים המשמשים לתפירת הכפתורים או התפרים המבניים אינם מכילים סיבי צמר. בדוק חוטי רקמת צמר על שמלות פשתן."
    },
    commonFindings: {
      en: "Wool threads used to reinforce buttons or attach brand labels to high-quality linen shirts.",
      he: "חוטי צמר המשמשים לחיזוק כפתורים או לחיבור תוויות מותג לחולצות פשתן איכותיות."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M30 18 L40 15 L50 25 L60 15 L70 18 L76 45 L68 47 L67 85 L33 85 L32 47 L24 45 Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="50" y1="25" x2="50" y2="85" stroke="#d4af37" strokeWidth="2" />
        <circle cx="50" cy="38" r="1.5" fill="#d4af37" />
        <circle cx="50" cy="50" r="1.5" fill="#d4af37" />
        <circle cx="50" cy="62" r="1.5" fill="#d4af37" />
        <circle cx="50" cy="74" r="1.5" fill="#d4af37" />
        <path d="M37 32 H44 V40 H37 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M40 37 Q41 33, 43 33" stroke="#d4af37" strokeWidth="1" />
      </svg>
    )
  },
  {
    id: "shawls",
    name: { en: "Shawls & Scarves", he: "צעיפים ושלים" },
    risk: "medium",
    checkedAreas: {
      en: ["Tassel fringe threads", "Woven border decorations", "Brand tags and sewing threads", "Blend percentage test"],
      he: ["חוטי גדילים (פרנזים)", "קישוטי שוליים ארוגים", "תוויות המותג וחוטי תפירתן", "בדיקת אחוז התערובת"]
    },
    labNotes: {
      en: "Wool shawls with decorative patterns or fringes often weave linen threads directly into the edges. Extract sample threads from both body and fringe.",
      he: "צעיפי צמר עם דוגמאות קישוט או פרנזים מגיעים לרוב עם חוטי פשתן הארוגים ישירות בקצוות. יש לקחת דגימות חוטים הן מהגוף והן מהפרנזים."
    },
    commonFindings: {
      en: "A wool shawl containing blended linen fringe tassels, causing a strict shatnez prohibition.",
      he: "של צמר המכיל פרנזים העשויים מפשתן, מה שיוצר איסור שעטנז גמור."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M20 25 C25 20, 75 20, 80 25 C82 35, 75 40, 50 38 C25 40, 18 35, 20 25 Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2.5" />
        <path d="M24 35 L28 80 C28 83, 36 83, 36 80 L35 37 Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2" />
        <path d="M64 37 L63 75 C63 78, 71 78, 71 75 L75 35 Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2" />
        <path d="M28 80 L28 88 M30 80 L30 88 M32 80 L32 88 M34 80 L34 88 M36 80 L36 88" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M63 75 L63 83 M65 75 L65 83 M67 75 L67 83 M69 75 L69 83 M71 75 L71 83" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "skirts",
    name: { en: "Skirts", he: "חצאיות" },
    risk: "low",
    checkedAreas: {
      en: ["Waistband interfacing", "Hem bindings", "Lining sewing threads", "Applique decorations"],
      he: ["מקשח פנימי לחגורה", "סרטי מכפלת", "חוטי תפירת הבטנה", "קישוטי אפליקציה"]
    },
    labNotes: {
      en: "Wool skirts sometimes utilize stiff lining fabrics or canvas reinforcement bands in the waistband, which may be linen-based to prevent rolling.",
      he: "חצאיות צמר עושות שימוש לעיתים בבטנות קשיחות או רצועות חיזוק בחגורת המותן, אשר עשויות להיות מבוססות פשתן כדי למנוע קיפול."
    },
    commonFindings: {
      en: "Linen reinforcing tape inside the waistband casing of wool pleated skirts.",
      he: "סרט חיזוק פשתן בתוך תעלת חגורת המותן של חצאיות קפלים מצמר."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M35 15 L65 15 L62 23 L38 23 Z" fill="#d4af37" opacity="0.7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M38 23 L18 85 L82 85 L62 23 Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="43" y1="23" x2="31" y2="85" stroke="currentColor" strokeWidth="1.5" />
        <line x1="50" y1="23" x2="50" y2="85" stroke="currentColor" strokeWidth="1.5" />
        <line x1="57" y1="23" x2="69" y2="85" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 80 L80 80" stroke="#d4af37" strokeWidth="2.5" strokeDasharray="3 3" />
      </svg>
    )
  },
  {
    id: "more",
    name: { en: "And More...", he: "ועוד..." },
    risk: "custom",
    checkedAreas: {
      en: ["Upholstery fabric backings", "Decorative pillows & cushions", "Wool blankets with linen seams", "Kitchen linens near wool elements"],
      he: ["גב ריפוד רהיטים", "כריות נוי ומושבים", "שמיכות צמר עם תפרי פשתן", "מוצרי פשתן למטבח ליד מוצרי צמר"]
    },
    labNotes: {
      en: "Shatnez issues can occur in home furnishings. High-quality wool blankets, carpets, or linen-backed cushions require thorough fiber verification.",
      he: "בעיות שעטנז יכולות להתרחש גם בריהוט ועיצוב הבית. שמיכות צמר איכותיות, שטיחים, או כריות מגובות פשתן דורשים אימות סיבים יסודי."
    },
    commonFindings: {
      en: "Linen canvas reinforcement lining inside wool upholstery fabric of a sofa.",
      he: "בטנת חיזוק מקנבס פשתן בתוך בד ריפוד מצמר של ספה."
    },
    svg: (colorClass) => (
      <svg viewBox="0 0 100 100" className={`w-full h-full ${colorClass}`}>
        <path d="M20 30 L50 15 L80 30 L50 45 Z" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="2" />
        <path d="M20 30 L20 50 L50 65 L50 45 Z" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="2" />
        <path d="M50 45 L50 65 L80 50 L80 30 Z" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="2" />
        <path d="M45 42 L55 42 M50 37 L50 47" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="42" r="12" fill="none" stroke="#d4af37" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    )
  }
];

export default function StatsPage() {
  const { t, isRtl } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"stats" | "explorer" | "brands" | "journey" | "quiz" | "myths">("stats");

  // Stats calculation state
  const [statsData, setStatsData] = useState({
    totalInspected: 1420,
    shatnezCount: 18,
    activeTesting: 4,
  });

  // Quiz State
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Garments Explorer Search & Modal State
  const [exploreSearch, setExploreSearch] = useState("");
  const [selectedExploreItem, setSelectedExploreItem] = useState<string | null>(null);

  const filteredGarments = GARMENT_ITEMS.filter((item) => {
    const query = exploreSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      item.name.en.toLowerCase().includes(query) ||
      item.name.he.toLowerCase().includes(query) ||
      item.risk.toLowerCase().includes(query) ||
      item.checkedAreas.en.some((area) => area.toLowerCase().includes(query)) ||
      item.checkedAreas.he.some((area) => area.includes(query)) ||
      item.labNotes.en.toLowerCase().includes(query) ||
      item.labNotes.he.includes(query) ||
      item.commonFindings.en.toLowerCase().includes(query) ||
      item.commonFindings.he.includes(query)
    );
  });

  const selectedItem = selectedExploreItem
    ? GARMENT_ITEMS.find((g) => g.id === selectedExploreItem)
    : null;

  // Brand Search State
  const [brandSearch, setBrandSearch] = useState("");

  // Journey active step
  const [activeStep, setActiveStep] = useState(0);

  // Recent Alerts Carousel State
  const [currentAlertIdx, setCurrentAlertIdx] = useState(0);

  const quizQuestions = [
    {
      questionKey: "stats_quiz_question_1",
      options: [
        { textKey: "stats_quiz_q1_op_yes", isCorrect: false },
        { textKey: "stats_quiz_q1_op_no", isCorrect: true },
      ],
      explainKey: "stats_quiz_q1_explain",
    },
    {
      questionKey: "stats_quiz_question_2",
      options: [
        { textKey: "stats_quiz_q2_op_correct", isCorrect: true },
        { textKey: "stats_quiz_q2_op_incorrect", isCorrect: false },
      ],
      explainKey: "stats_quiz_q2_explain",
    },
    {
      questionKey: "stats_quiz_question_3",
      options: [
        { textKey: "stats_quiz_q3_op_yes", isCorrect: true },
        { textKey: "stats_quiz_q3_op_always", isCorrect: false },
      ],
      explainKey: "stats_quiz_q3_explain",
    },
  ];

  const brandData = [
    { name: "Zara", risk: "high", notesEn: "Frequent use of hidden linen canvas undercollars or linen fabrics in collar supports.", notesHe: "שימוש שכיח בקנבס פשתן נסתר מתחת לצווארונים או בדי פשתן לחיזוק צווארונים." },
    { name: "Hugo Boss", risk: "high", notesEn: "High-quality suits often contain genuine wool/linen chest canvas interlinings.", notesHe: "חליפות איכותיות מכילות לעיתים קרובות בד קנבס פנימי משולב צמר ופשתן בבית החזה." },
    { name: "Brooks Brothers", risk: "high", notesEn: "Shoulder reinforcements and collar linings frequently contain linen threads.", notesHe: "חיזוקי כתפיים ובטנות צווארון מכילים לעיתים קרובות חוטי פשתן." },
    { name: "Ralph Lauren", risk: "medium", notesEn: "Blazer pocket reinforcements or label backing threads occasionally contain linen.", notesHe: "חיזוקי כיסים או חוטי תפירה מאחורי התוויות מכילים לעיתים פשתן." },
    { name: "Armani", risk: "medium", notesEn: "Decorative stitches and pocket stays in wool garments sometimes use linen fibers.", notesHe: "תפרים קישוטיים ותומכי כיסים בבגדי צמר משתמשים לעיתים בסיבי פשתן." },
    { name: "H&M", risk: "low", notesEn: "Mainly synthetic materials used, but wool coats should still be checked due to label basting threads.", notesHe: "שימוש בעיקר בחומרים סינתטיים, אך מעילי צמר עדיין דורשים בדיקה בשל חוטים זמניים בתוויות." },
  ];

  const recentAlerts = [
    {
      id: 1,
      brand: "Zara",
      garmentEn: "Wool Blazer",
      garmentHe: "בלייזר צמר",
      findingEn: "Linen canvas support under collar",
      findingHe: "תומך קנבס פשתן מתחת לצווארון",
      actionEn: "Replaced with cotton undercollar felt, certified clean",
      actionHe: "הוחלף בלבד צווארון כותנה, הבגד אושר כנקי"
    },
    {
      id: 2,
      brand: "Brooks Brothers",
      garmentEn: "Men's Winter Suit",
      garmentHe: "חליפת חורף לגברים",
      findingEn: "Linen threads used in shoulder padding",
      findingHe: "חוטי פשתן בכריות הכתפיים",
      actionEn: "Removed linen threads, resewed, certified clean",
      actionHe: "הסרת חוטי הפשתן, תפירה מחדש ואישור הבגד"
    },
    {
      id: 3,
      brand: "Hugo Boss",
      garmentEn: "Premium Trench Coat",
      garmentHe: "מעיל טרנץ' יוקרתי",
      findingEn: "Linen/wool blend collar lining",
      findingHe: "בטנת צווארון מעורבת צמר ופשתן",
      actionEn: "Lining replaced with pure synthetic fabric, certified clean",
      actionHe: "הבטנה הוחלפה בבד סינתטי טהור, הבגד אושר"
    }
  ];


  // Fetch actual orders to merge/dynamize statistics
  useEffect(() => {
    async function loadData() {
      try {
        const all = await getAllOrders();
        setOrders(all);
        
        const baseTested = 1420;
        const baseFound = 18;
        const total = all.length ? baseTested + all.length : baseTested;
        
        const found = all.filter(o => {
          const notesText = (o.notes || "").toLowerCase();
          const resultText = (o.result || "").toLowerCase();
          return notesText.includes("shatnez") || resultText.includes("shatnez") || o.status === "issue";
        }).length + (all.length ? 0 : baseFound);

        const active = all.filter(o => o.status === "testing" || o.status === "received" || o.status === "review").length || 3;
        
        setStatsData({
          totalInspected: total,
          shatnezCount: found,
          activeTesting: active
        });
      } catch (err) {
        console.error("Error loading orders for stats page:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleAnswerClick = (idx: number, isCorrect: boolean) => {
    if (selectedOptionIdx !== null) return; // Prevent multiple clicks
    setSelectedOptionIdx(idx);
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    setSelectedOptionIdx(null);
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedOptionIdx(null);
    setQuizScore(0);
    setQuizFinished(false);
  };

  return (
    <div className="min-h-screen bg-primary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Page Header */}
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gold-400/10 rounded-full border border-gold-400/20 text-gold-600 text-sm font-semibold"
          >
            <TrendingUp className="w-4 h-4" />
            {t("shatnez_info")}
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-bold text-navy-900 tracking-tight"
          >
            {t("stats_title")}
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-primary-600 max-w-3xl mx-auto leading-relaxed"
          >
            {t("stats_subtitle")}
          </motion.p>
        </div>

        {/* Halachic Disclaimer Warning Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto p-4 bg-amber-50 border border-amber-250 rounded-2xl text-amber-900 text-sm flex items-start gap-3 shadow-sm"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-semibold">
            {t("halachic_disclaimer")}
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 border-b border-primary-200 pb-4 max-w-4xl mx-auto">
          {[
            { id: "stats", label: t("stats") },
            { id: "explorer", label: t("stats_interactive_title") },
            { id: "brands", label: t("brand_title") },
            { id: "journey", label: t("journey_title") },
            { id: "quiz", label: t("stats_quiz_title") },
            { id: "myths", label: t("stats_myths_title") }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === tab.id 
                  ? "bg-navy-900 text-white shadow-lg shadow-navy-900/20 scale-105" 
                  : "bg-white text-navy-700 hover:bg-primary-100 hover:text-navy-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            
            {/* 1. Live Statistics Tab */}
            {activeTab === "stats" && (
              <motion.div
                key="stats-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >
                {/* Stats Counters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* Garments Inspected Card */}
                  <div className="card bg-white p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-navy-900">
                      <Microscope className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-navy-100 flex items-center justify-center text-navy-600">
                        <Microscope className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary-500">{t("stats_garments_tested")}</p>
                        <h3 className="text-3xl font-extrabold text-navy-900 mt-1">
                          {loading ? "..." : statsData.totalInspected.toLocaleString()}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Shatnez Detected Card */}
                  <div className="card bg-white p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-red-500">
                      <ShieldAlert className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary-500">{t("stats_shatnez_found")}</p>
                        <h3 className="text-3xl font-extrabold text-red-600 mt-1">
                          {loading ? "..." : statsData.shatnezCount}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Active Cases Card */}
                  <div className="card bg-white p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-gold-500">
                      <Activity className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gold-100 flex items-center justify-center text-gold-600">
                        <Activity className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary-500">{t("stats_active_cases")}</p>
                        <h3 className="text-3xl font-extrabold text-gold-600 mt-1">
                          {loading ? "..." : statsData.activeTesting}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Turnaround Time Card */}
                  <div className="card bg-white p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-navy-900">
                      <Clock className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-navy-100 flex items-center justify-center text-navy-600">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary-500">{t("stats_turnaround")}</p>
                        <h3 className="text-xl font-bold text-navy-900 mt-2">
                          {t("stats_days_val")}
                        </h3>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Additional Insight Banner */}
                <div className="card bg-navy-900 text-white p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/10 via-transparent to-transparent" />
                  <div className="space-y-2 relative z-10">
                    <h4 className="text-2xl font-bold text-gold-400 flex items-center gap-2">
                      <Award className="w-6 h-6" />
                      {isRtl ? "מדוע בדיקה היא קריטית?" : "Why checking is critical?"}
                    </h4>
                    <p className="text-primary-300 max-w-3xl text-sm leading-relaxed">
                      {isRtl 
                        ? "בדיקת שעטנז מקצועית במעבדה מבטיחה שהבגדים שלכם תואמים להלכה בצורה מלאה. סיבי שעטנז רבים נסתרים מתחת לצווארונים או כריות הכתפיים ואינם ניתנים לגילוי באמצעות העין בלבד."
                        : "Professional laboratory testing ensures that your garments comply fully with Halacha. Many shatnez fibers are concealed beneath collars or shoulder pads and cannot be detected with the naked eye."}
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab("explorer")}
                    className="btn-primary shrink-0 relative z-10"
                  >
                    {isRtl ? "לחצו לחקירת חלקי הבגד ←" : "Explore Garment Parts ←"}
                  </button>
                </div>

                {/* Recent Lab Alerts Gallery */}
                <div className="card bg-white p-8 rounded-2xl border border-primary-200 space-y-6 relative">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="text-xl font-bold text-navy-900 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        {t("alerts_title")}
                      </h4>
                      <p className="text-sm text-primary-500 mt-1">
                        {t("alerts_desc")}
                      </p>
                    </div>
                    {/* Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => setCurrentAlertIdx(prev => (prev === 0 ? recentAlerts.length - 1 : prev - 1))}
                        className="w-10 h-10 rounded-xl bg-primary-100 hover:bg-primary-200 text-navy-900 flex items-center justify-center transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm font-semibold text-navy-900 px-2">
                        {currentAlertIdx + 1} / {recentAlerts.length}
                      </span>
                      <button
                        onClick={() => setCurrentAlertIdx(prev => (prev === recentAlerts.length - 1 ? 0 : prev + 1))}
                        className="w-10 h-10 rounded-xl bg-primary-100 hover:bg-primary-200 text-navy-900 flex items-center justify-center transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Active Alert Card */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentAlertIdx}
                      initial={{ opacity: 0, x: isRtl ? 30 : -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isRtl ? -30 : 30 }}
                      transition={{ duration: 0.25 }}
                      className="p-6 bg-red-50/55 rounded-xl border border-red-100/70 grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-red-600 tracking-wider uppercase block">
                          {isRtl ? "מותג" : "Brand"}
                        </span>
                        <h5 className="text-xl font-extrabold text-navy-900">
                          {recentAlerts[currentAlertIdx].brand}
                        </h5>
                        <p className="text-sm text-primary-600 font-semibold mt-1">
                          <span className="text-primary-400 font-normal">{t("alerts_garment")} </span>
                          {isRtl ? recentAlerts[currentAlertIdx].garmentHe : recentAlerts[currentAlertIdx].garmentEn}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs font-bold text-red-600 tracking-wider uppercase block">
                          {t("alerts_finding")}
                        </span>
                        <p className="text-navy-900 font-medium text-base">
                          {isRtl ? recentAlerts[currentAlertIdx].findingHe : recentAlerts[currentAlertIdx].findingEn}
                        </p>
                      </div>

                      <div className="space-y-1 md:border-l md:border-red-150/40 md:pl-6 md:rtl:border-l-0 md:rtl:border-r md:rtl:pl-0 md:rtl:pr-6">
                        <span className="text-xs font-bold text-green-600 tracking-wider uppercase block">
                          {t("alerts_action")}
                        </span>
                        <p className="text-green-900 font-medium text-base flex items-start gap-1.5">
                          <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                          <span>
                            {isRtl ? recentAlerts[currentAlertIdx].actionHe : recentAlerts[currentAlertIdx].actionEn}
                          </span>
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

              </motion.div>
            )}

            {/* 2. Interactive Explorer Tab */}
            {activeTab === "explorer" && (
              <motion.div
                key="explorer-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >
                {/* Search Bar */}
                <div className="relative max-w-md mx-auto">
                  <input
                    type="text"
                    value={exploreSearch}
                    onChange={(e) => setExploreSearch(e.target.value)}
                    placeholder={isRtl ? "חפש פריט לבוש, חומר או הערה..." : "Search garment, material, or note..."}
                    className={`w-full py-3 px-11 bg-white border border-primary-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 transition-all ${
                      isRtl ? "text-right" : "text-left"
                    }`}
                  />
                  <span className={`absolute inset-y-0 flex items-center pointer-events-none text-primary-400 ${
                    isRtl ? "right-3.5" : "left-3.5"
                  }`}>
                    <Search className="w-5 h-5" />
                  </span>
                  {exploreSearch && (
                    <button
                      onClick={() => setExploreSearch("")}
                      className={`absolute inset-y-0 flex items-center px-3 text-primary-400 hover:text-navy-900 ${
                        isRtl ? "left-0.5" : "right-0.5"
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Garments Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                  {filteredGarments.map((item) => {
                    let badgeColor = "bg-green-50 text-green-700 border-green-200";
                    let badgeLabel = isRtl ? "סיכון נמוך" : "Low Risk";
                    if (item.risk === "high") {
                      badgeColor = "bg-red-50 text-red-700 border-red-200";
                      badgeLabel = isRtl ? "סיכון גבוה" : "High Risk";
                    } else if (item.risk === "medium") {
                      badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                      badgeLabel = isRtl ? "סיכון בינוני" : "Medium Risk";
                    } else if (item.risk === "custom") {
                      badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                      badgeLabel = isRtl ? "בדיקה מיוחדת" : "Special Check";
                    }

                    return (
                      <motion.div
                        key={item.id}
                        layoutId={`garment-card-${item.id}`}
                        onClick={() => setSelectedExploreItem(item.id)}
                        className="card bg-white p-6 border border-primary-100 hover:border-gold-300 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col items-center justify-between text-center relative group min-h-[220px]"
                      >
                        {/* SVG Icon Container */}
                        <div className="w-20 h-20 mb-4 text-navy-800 group-hover:text-gold-500 transition-colors duration-300">
                          {item.svg("")}
                        </div>

                        {/* Text Details */}
                        <div className="space-y-2">
                          <h4 className="font-bold text-navy-900 text-sm sm:text-base leading-snug">
                            {isRtl ? item.name.he : item.name.en}
                          </h4>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Empty State */}
                {filteredGarments.length === 0 && (
                  <div className="text-center py-12 space-y-3 bg-white rounded-2xl border border-primary-100 max-w-md mx-auto">
                    <AlertCircle className="w-12 h-12 text-primary-300 mx-auto" />
                    <p className="text-primary-600 font-medium">
                      {isRtl ? "לא נמצאו פריטי לבוש תואמים." : "No matching garments found."}
                    </p>
                  </div>
                )}

                {/* Detail Modal */}
                <AnimatePresence>
                  {selectedItem && (
                    <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-primary-100 shadow-2xl relative"
                      >
                        {/* Header Banner */}
                        <div className="p-6 bg-gradient-to-r from-navy-900 to-navy-800 text-white flex items-center justify-between border-b border-navy-950/20">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 text-gold-400 shrink-0 bg-white/10 rounded-xl p-1.5">
                              {selectedItem.svg("w-full h-full text-gold-400")}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-white">
                                {isRtl ? selectedItem.name.he : selectedItem.name.en}
                              </h3>
                              <div className="mt-1 flex gap-2">
                                {selectedItem.risk === "high" && (
                                  <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold uppercase">
                                    {isRtl ? "סיכון גבוה" : "High Risk"}
                                  </span>
                                )}
                                {selectedItem.risk === "medium" && (
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase">
                                    {isRtl ? "סיכון בינוני" : "Medium Risk"}
                                  </span>
                                )}
                                {selectedItem.risk === "low" && (
                                  <span className="px-2 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-semibold uppercase">
                                    {isRtl ? "סיכון נמוך" : "Low Risk"}
                                  </span>
                                )}
                                {selectedItem.risk === "custom" && (
                                  <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase">
                                    {isRtl ? "בדיקה מיוחדת" : "Special Check"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedExploreItem(null)}
                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                          {/* Checked Areas */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2 border-b border-primary-100 pb-2">
                              <CheckCircle className="w-4 h-4 text-gold-500" />
                              {isRtl ? "אזורים טעוני בדיקה:" : "Checked Areas / Components:"}
                            </h4>
                            <ul className={`grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-primary-600 ${isRtl ? "text-right" : "text-left"}`}>
                              {(isRtl ? selectedItem.checkedAreas.he : selectedItem.checkedAreas.en).map((area, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                                  <span>{area}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Lab Notes */}
                          <div className="space-y-2">
                            <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2 border-b border-primary-100 pb-2">
                              <Microscope className="w-4 h-4 text-gold-500" />
                              {isRtl ? "הנחיות מעבדה לבדיקה:" : "Lab Inspection Notes:"}
                            </h4>
                            <p className="text-sm text-primary-600 leading-relaxed">
                              {isRtl ? selectedItem.labNotes.he : selectedItem.labNotes.en}
                            </p>
                          </div>

                          {/* Common Findings */}
                          <div className="space-y-2">
                            <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2 border-b border-primary-100 pb-2">
                              <ShieldAlert className="w-4 h-4 text-red-500" />
                              {isRtl ? "ממצאי שעטנז שכיחים:" : "Common Shatnez Findings:"}
                            </h4>
                            <p className="text-sm text-primary-600 leading-relaxed bg-red-50/50 p-4 rounded-xl border border-red-100 text-red-950">
                              {isRtl ? selectedItem.commonFindings.he : selectedItem.commonFindings.en}
                            </p>
                          </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-primary-50 border-t border-primary-100 flex justify-end">
                          <button
                            onClick={() => setSelectedExploreItem(null)}
                            className="px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-navy-900/10"
                          >
                            {isRtl ? "סגור" : "Close"}
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* 2c. Brand Risk Level Lookup Tab */}
            {activeTab === "brands" && (
              <motion.div
                key="brands-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="card bg-white p-8 space-y-6">
                  <div className="text-center max-w-2xl mx-auto space-y-2">
                    <h3 className="text-2xl font-bold text-navy-900">{t("brand_title")}</h3>
                    <p className="text-sm text-primary-500">{t("brand_desc")}</p>
                  </div>

                  {/* Search bar */}
                  <div className="relative max-w-md mx-auto">
                    <input
                      type="text"
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      placeholder={t("brand_search_placeholder")}
                      className={`w-full py-3 px-11 bg-primary-50 border border-primary-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-900 transition-all ${
                        isRtl ? "text-right" : "text-left"
                      }`}
                    />
                    <span className={`absolute inset-y-0 flex items-center pointer-events-none text-primary-400 ${
                      isRtl ? "right-3.5" : "left-3.5"
                    }`}>
                      <Search className="w-5 h-5" />
                    </span>
                  </div>

                  {/* Brands Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    {brandData
                      .filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
                      .map((brand, idx) => {
                        let badgeColor = "bg-green-100 text-green-800 border-green-150";
                        if (brand.risk === "high") {
                          badgeColor = "bg-red-100 text-red-800 border-red-150";
                        } else if (brand.risk === "medium") {
                          badgeColor = "bg-gold-100 text-gold-800 border-gold-150";
                        }

                        return (
                          <motion.div
                            key={brand.name}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-6 bg-primary-50/40 border border-primary-150 rounded-2xl flex flex-col justify-between gap-4"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="text-xl font-bold text-navy-900">{brand.name}</h4>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border uppercase tracking-wider ${badgeColor}`}>
                                {brand.risk === "high" && t("brand_risk_high")}
                                {brand.risk === "medium" && t("brand_risk_medium")}
                                {brand.risk === "low" && t("brand_risk_low")}
                              </span>
                            </div>
                            <p className="text-sm text-primary-600 leading-relaxed">
                              {isRtl ? brand.notesHe : brand.notesEn}
                            </p>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2d. Garment Journey Tab */}
            {activeTab === "journey" && (
              <motion.div
                key="journey-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="card bg-white p-8 space-y-8">
                  <div className="text-center max-w-2xl mx-auto space-y-2">
                    <h3 className="text-2xl font-bold text-navy-900">{t("journey_title")}</h3>
                    <p className="text-sm text-primary-500">{t("journey_desc")}</p>
                  </div>

                  {/* Horizontal progress steps indicators */}
                  <div className="flex flex-wrap md:flex-nowrap justify-between items-center gap-4 relative">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary-100 -translate-y-1/2 hidden md:block z-0" />
                    
                    {[
                      { step: 0, label: "journey_step_1_title" },
                      { step: 1, label: "journey_step_2_title" },
                      { step: 2, label: "journey_step_3_title" },
                      { step: 3, label: "journey_step_4_title" },
                      { step: 4, label: "journey_step_5_title" }
                    ].map(s => {
                      const isActive = activeStep === s.step;
                      const isPassed = activeStep > s.step;
                      return (
                        <button
                          key={s.step}
                          onClick={() => setActiveStep(s.step)}
                          className="relative z-10 flex flex-col items-center gap-2 group focus:outline-none"
                        >
                          <span className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300 shadow-md ${
                            isActive
                              ? "bg-navy-900 border-navy-900 text-white scale-110"
                              : isPassed
                                ? "bg-gold-500 border-gold-500 text-white"
                                : "bg-white border-primary-250 text-primary-500 hover:border-navy-700 hover:text-navy-900"
                          }`}>
                            {isPassed ? <CheckCircle className="w-5 h-5" /> : s.step + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Step Description Card */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                      className={`p-8 bg-primary-50/40 border border-primary-150 rounded-2xl flex flex-col md:flex-row items-center gap-6 ${
                        isRtl ? "md:flex-row-reverse" : "md:flex-row"
                      }`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-navy-100 flex items-center justify-center text-navy-800 shrink-0">
                        {activeStep === 0 && <Clock className="w-8 h-8" />}
                        {activeStep === 1 && <Info className="w-8 h-8" />}
                        {activeStep === 2 && <Microscope className="w-8 h-8" />}
                        {activeStep === 3 && <Activity className="w-8 h-8" />}
                        {activeStep === 4 && <CheckCircle className="w-8 h-8" />}
                      </div>
                      <div className={`space-y-2 text-center ${isRtl ? "md:text-right" : "md:text-left"}`}>
                        <h4 className="text-xl font-bold text-navy-900">
                          {t(`journey_step_${activeStep + 1}_title`)}
                        </h4>
                        <p className="text-sm text-primary-600 leading-relaxed max-w-2xl">
                          {t(`journey_step_${activeStep + 1}_desc`)}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* 3. Interactive Quiz Tab */}
            {activeTab === "quiz" && (
              <motion.div
                key="quiz-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="max-w-2xl mx-auto card bg-white p-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 text-gold-500">
                  <HelpCircle className="w-24 h-24" />
                </div>

                {!quizFinished ? (
                  <div className="space-y-6">
                    {/* Progress Bar */}
                    <div className="flex items-center justify-between text-sm text-primary-500">
                      <span>{isRtl ? `שאלה ${currentQuestion + 1} מתוך ${quizQuestions.length}` : `Question ${currentQuestion + 1} of ${quizQuestions.length}`}</span>
                      <span>{Math.round(((currentQuestion) / quizQuestions.length) * 100)}% {isRtl ? "הושלם" : "Complete"}</span>
                    </div>
                    <div className="w-full bg-primary-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gold-400 h-full transition-all duration-300"
                        style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
                      />
                    </div>

                    {/* Question Card */}
                    <div className="space-y-4 pt-4">
                      <h3 className="text-xl sm:text-2xl font-bold text-navy-900">
                        {t(quizQuestions[currentQuestion].questionKey)}
                      </h3>
                    </div>

                    {/* Options */}
                    <div className="space-y-3 pt-4">
                      {quizQuestions[currentQuestion].options.map((option, idx) => {
                        const isSelected = selectedOptionIdx !== null;
                        const isCorrectOption = option.isCorrect;
                        const isChosenOption = idx === selectedOptionIdx;
                        
                        let optionStyles = "bg-primary-50 border-primary-200 text-navy-900 hover:bg-primary-100 hover:border-primary-300";
                        if (isSelected) {
                          if (isCorrectOption) {
                            optionStyles = "bg-green-50 border-green-500 text-green-900 font-semibold";
                          } else if (isChosenOption) {
                            optionStyles = "bg-red-50 border-red-500 text-red-900 font-semibold";
                          } else {
                            optionStyles = "bg-primary-50 border-primary-200 text-primary-400 opacity-60";
                          }
                        }

                        return (
                          <button
                            key={idx}
                            disabled={isSelected}
                            onClick={() => handleAnswerClick(idx, option.isCorrect)}
                            className={`w-full text-right p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${
                              isRtl ? "text-right flex-row-reverse" : "text-left flex-row"
                            } ${optionStyles}`}
                          >
                            <span>{t(option.textKey)}</span>
                            {isSelected && isCorrectOption && <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />}
                            {isSelected && isChosenOption && !isCorrectOption && <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanation Box */}
                    {selectedOptionIdx !== null && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="p-5 bg-navy-50 rounded-xl border border-navy-150 space-y-2 mt-6"
                      >
                        <h4 className="text-sm font-bold text-navy-900 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-gold-500" />
                          {isRtl ? "הסבר:" : "Explanation:"}
                        </h4>
                        <p className="text-sm text-primary-600 leading-relaxed">
                          {t(quizQuestions[currentQuestion].explainKey)}
                        </p>

                        <div className="flex justify-end pt-3">
                          <button 
                            onClick={handleNextQuestion}
                            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            {currentQuestion === quizQuestions.length - 1 
                              ? (isRtl ? "סיים חידון" : "Finish Quiz") 
                              : (isRtl ? "שאלה הבאה ←" : "Next Question ←")}
                          </button>
                        </div>
                      </motion.div>
                    )}

                  </div>
                ) : (
                  // Quiz Finished Screen
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-8 space-y-6"
                  >
                    <div className="w-20 h-20 rounded-full bg-gold-100 flex items-center justify-center mx-auto text-gold-500">
                      <Award className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-navy-900">
                        {isRtl ? "כל הכבוד!" : "Great Job!"}
                      </h3>
                      <p className="text-lg text-primary-500">
                        {isRtl 
                          ? `ענית נכון על ${quizScore} מתוך ${quizQuestions.length} שאלות.`
                          : `You answered ${quizScore} out of ${quizQuestions.length} questions correctly.`}
                      </p>
                    </div>

                    <div className="max-w-md mx-auto p-4 bg-primary-100 rounded-xl text-sm text-primary-600 leading-relaxed">
                      {isRtl 
                        ? "עכשיו כשאתם מכירים את העובדות, תוכלו לשתף את הידע עם חברים ולהפיץ את המודעות לחשיבות של בדיקת בגדים מקצועית."
                        : "Now that you know the facts, feel free to share this knowledge and help spread awareness on the importance of professional shatnez testing."}
                    </div>

                    <button 
                      onClick={resetQuiz}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      {isRtl ? "נסה שוב" : "Retry Quiz"}
                    </button>
                  </motion.div>
                )}

              </motion.div>
            )}

            {/* 4. Myths & Facts Tab */}
            {activeTab === "myths" && (
              <motion.div
                key="myths-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
              >
                {[
                  { mythKey: "myth_1_title", factKey: "myth_1_desc" },
                  { mythKey: "myth_2_title", factKey: "myth_2_desc" },
                  { mythKey: "myth_3_title", factKey: "myth_3_desc" }
                ].map((item, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="card bg-white p-6 flex flex-col justify-between gap-6"
                  >
                    <div className="space-y-4">
                      {/* Myth Header */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                          <XCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-red-500 uppercase block mb-1">
                            {isRtl ? "מיתוס" : "Myth"}
                          </span>
                          <h4 className="font-bold text-navy-900 text-base leading-snug">
                            {t(item.mythKey).replace("Myth: ", "").replace("מיתוס: ", "")}
                          </h4>
                        </div>
                      </div>

                      {/* Fact Content */}
                      <div className="flex items-start gap-3 pt-4 border-t border-primary-100">
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-500 shrink-0">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-green-600 uppercase block mb-1">
                            {isRtl ? "עובדה" : "Fact"}
                          </span>
                          <p className="text-sm text-primary-600 leading-relaxed">
                            {t(item.factKey).replace("Fact: ", "").replace("עובדה: ", "")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
