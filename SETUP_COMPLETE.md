# השלמת Setup — Shatnez Lab Phone System

## ✅ שלב 1: Firebase Config (מחכה לערכים שלך)

הזן את הערכים האלו ב-`lib/firebase.ts` או כמשתני סביבה ב-Netlify:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=shatnez-lab-xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=shatnez-lab-xxx
NEXT_PUBLIC_BASE_URL=https://YOUR_NETLIFY_SITE.netlify.app
```

## ✅ שלב 2: Firebase Firestore Rules

ב-Firebase Console → Firestore Database → Rules, החלף ל:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orders/{orderId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

לחץ **Publish**.

## ✅ שלב 3: Deploy ל-Netlify

### אפשרות A — דרך Terminal:
```bash
# ודא שאתה בתיקייה הנכונה
cd C:\Users\Gersh\CascadeProjects\shatnez-lab

# התקן תלויות
npm install

# בנה
npm run build

# אם יש שגיאות — צריך לתקן לפני deploy
```

### אפשרות B — דרך Git + Netlify (מומלץ):
1. העלה ל-GitHub
2. חבר ל-Netlify
3. Netlify יבנה אוטומטית

## ✅ שלב 4: הגדרת Twilio Webhook

ב-[Twilio Console](https://console.twilio.com/console/phone-numbers/incoming):

| שדה | ערך |
|-----|-----|
| **A CALL COMES IN** | Webhook |
| **URL** | `https://YOUR_SITE.netlify.app/api/twilio/voice` |
| **HTTP Method** | POST |

לחץ **Save**.

## ✅ שלב 5: בדיקה

1. התקשר למספר Twilio שלך
2. לקוח: לחץ 1 והקש מספר הזמנה
3. מנהל: לחץ 2, הקש 1234, ונהל הזמנות

## 🔧 לפני Deploy — ודא שיש:

- [ ] Firebase Config מעודכן בקוד או במשתני סביבה
- [ ] Firestore Rules מוגדרות
- [ ] `npm run build` עובד ללא שגיאות
- [ ] Twilio webhook URL מוגדר נכון

## 📞 מבנה התפריט הטלפוני

```
שיחה נכנסת
├── 1 → בדיקת סטטוס (הזן מספר הזמנה)
├── 2 → כניסת מנהל (PIN: 1234)
│   ├── 1 → האזנה ל-5 הזמנות אחרונות
│   ├── 2 → עדכון סטטוס הזמנה
│   ├── 3 → חיפוש לפי טלפון
│   └── * → חזרה לתפריט ראשי
└── הזנה ישירה של מספר הזמנה
```

## 📲 עדכון סטטוס בטלפון

אחרי בחירת הזמנה, הקש:
- 1 = Received
- 2 = In Testing  
- 3 = Under Review
- 4 = Ready for Pickup
- 5 = Delivered
- 6 = Attention Needed
- * = ביטול

---

**מוכן!** ברגע שתשלח את ה-Firebase config, אני מעדכן את הקבצים ואתה יכול לעלות לאוויר 🚀
