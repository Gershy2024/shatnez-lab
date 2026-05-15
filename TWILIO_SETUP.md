# Twilio Phone IVR Setup Guide

## Overview
Your Shatnez Lab app now has a phone IVR system. Customers can call your Twilio number to check order status, and you (admin) can manage orders by phone.

## Step 1: Create Firebase Project (Free Database)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" → name it `shatnez-lab`
3. Disable Google Analytics (or enable if you want)
4. Wait for project creation to finish
5. Click the **</>** icon to create a "Web App"
6. Name it `shatnez-web` → Register app
7. **Copy the config values** — you will need these 3:
   - `apiKey`
   - `projectId`
   - `authDomain`

### Enable Firestore
8. In the left sidebar, click **Build → Firestore Database**
9. Click **Create database**
10. Choose **Start in test mode** (for now)
11. Select location: `us-central` (or closest to you)
12. Click **Enable**

## Step 2: Add Firebase Config to Your Project

In `lib/firebase.ts`, replace the placeholder values with your actual Firebase config:

```ts
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};
```

## Step 3: Deploy to Netlify (so Twilio can reach your API)

### Set Environment Variables in Netlify
1. Go to your Netlify site dashboard
2. Go to **Site settings → Environment variables**
3. Add these variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY` = your Firebase apiKey
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = your Firebase authDomain
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` = your Firebase projectId
   - `NEXT_PUBLIC_BASE_URL` = `https://YOUR_NETLIFY_SITE.netlify.app`
     (replace with your actual Netlify URL)

### Deploy
```bash
npm install
npm run build
# Or push to GitHub and let Netlify auto-deploy
```

## Step 4: Configure Twilio Console

### A. Set Webhook for Incoming Calls
1. Go to [Twilio Console](https://console.twilio.com/)
2. Go to **Phone Numbers → Manage → Active Numbers**
3. Click your phone number
4. Under **Voice & Fax** → **A CALL COMES IN**
5. Set:
   - Webhook: `https://YOUR_NETLIFY_SITE.netlify.app/api/twilio/voice`
   - HTTP Method: `POST`
6. Click **Save**

### B. (Optional) Set Status Callback
- Under **A CALL COMES IN** → **STATUS CALLBACK**
- This is optional for basic functionality

## Step 5: Test the Phone System

1. Call your Twilio number
2. You should hear: "Welcome to The Shatnez Lab..."
3. **Customer test**: Press 1, then enter an order number + #
4. **Admin test**: Press 2, enter PIN `1234`, then:
   - Press 1: Hear recent orders
   - Press 2: Update order status
   - Press 3: Lookup by phone number
   - Press *: Return to main menu

## Phone Menu Tree

```
Incoming Call
├── Press 1 → Enter Order Number + # → Status read aloud
├── Press 2 → Admin PIN (1234)
│   ├── Press 1 → Hear last 5 orders
│   ├── Press 2 → Enter Order # + # → Press 1-6 for new status
│   ├── Press 3 → Enter phone # + # → Hear all orders for that phone
│   └── Press * → Back to main menu
└── Enter Order # directly + # → Status read aloud
```

## Status Codes (for phone updates)
1 = Received
2 = In Testing
3 = Under Review
4 = Ready for Pickup
5 = Delivered
6 = Attention Needed
* = Cancel

## Firebase Security Rules (IMPORTANT!)

After testing, secure your database. In Firebase Console → Firestore Database → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orders/{orderId} {
      allow read: if true;
      allow write: if true;  // CHANGE THIS LATER for production
    }
  }
}
```

For production, consider adding authentication.

## Troubleshooting

- **No voice response?** Check that your Netlify deployment is live and the BASE_URL env var matches.
- **Order not found?** Make sure orders are saved via the web admin page (which now uses Firebase).
- **Webhook errors?** Check Netlify function logs in your Netlify dashboard.

## Costs
- Firebase: Free tier (50K reads/day, 20K writes/day)
- Twilio: $1/month for the number + $0.0085/minute for calls
- Netlify: Free tier includes 125K function invocations/month
