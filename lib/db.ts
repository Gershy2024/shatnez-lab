import { db, isConfigured } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";

export type OrderStatus = "received" | "testing" | "review" | "ready" | "delivered" | "issue";

export interface CallLog {
  status: string; // e.g. "completed", "failed", "busy", "no-answer"
  timestamp: string;
  duration?: string;
}

export interface Order {
  id: string;
  customerName: string;
  phone?: string;
  status: OrderStatus;
  dateReceived: string;
  estimatedCompletion: string;
  notes: string;
  result: string;
  callLogs?: CallLog[];
  createdAt?: number;
  archived?: boolean;
  location?: string;
}

export interface DeliveryRequest {
  id: string;
  phone: string;
  customerName: string;
  timestamp: number;
  status: "pending" | "called" | "completed" | "cancelled";
  createdAt: string;
  notes?: string;
}

export interface AdminSettings {
  pin: string;
  adminUser?: string;
  adminEmail?: string;
  forwardingNumber: string;
  forwardingHoursStart?: string; // "09:00"
  forwardingHoursEnd?: string;   // "21:00"
  ivrGeneralEn?: string;
  ivrGeneralHe?: string;
  ivrSpecialEn?: string;
  ivrSpecialHe?: string;
  outboundMsgEn?: string;
  outboundMsgHe?: string;
  adminNotes?: string;
  voicemailEmail?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  callerIdType?: "caller" | "twilio";
  holidayModeActive?: boolean;
  ivrHolidayMsgEn?: string;
  ivrHolidayMsgHe?: string;
  dndActive?: boolean;
  twilioApiKey?: string;
  twilioApiSecret?: string;
  twilioTwimlAppSid?: string;
  geminiApiKey?: string;
}

const ORDERS_COLLECTION = "orders";
const SETTINGS_COLLECTION = "settings";
const VOICEMAILS_COLLECTION = "voicemails";
const CALLS_COLLECTION = "calls";
const DELIVERIES_COLLECTION = "deliveries";
const LS_KEY = "shatnez_orders";
const LS_VM_KEY = "shatnez_voicemails";
const CALLS_LS_KEY = "shatnez_calls";
const DELIVERIES_LS_KEY = "shatnez_deliveries";

export interface Voicemail {
  id: string;
  phone: string;
  duration: string;
  url: string;
  timestamp: number;
  read: boolean;
}

/* ── localStorage helpers (fallback) ── */
function lsGet(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(LS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function lsSet(orders: Order[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(orders));
}

/* ── Firestore helpers ── */
export async function getAllOrders(): Promise<Order[]> {
  if (isConfigured && db) {
    try {
      const snapshot = await getDocs(
        query(collection(db, ORDERS_COLLECTION), orderBy("id", "asc"))
      );
      return snapshot.docs
        .map((d) => d.data() as Order)
        .filter((o) => !(o as any).isDelivery && !o.id.startsWith("DELIVERY_"));
    } catch (e) {
      console.error("Firestore getAllOrders failed:", e);
    }
  }
  return lsGet();
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (isConfigured && db) {
    try {
      const ref = doc(db, ORDERS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data() as Order;
      }
    } catch (e) {
      console.error(`Firestore getDoc for ID ${id} failed:`, e);
    }
    
    // Backup scanning method to ensure lookup always works under strict permissions
    try {
      const all = await getAllOrders();
      const found = all.find((o) => String(o.id).toUpperCase() === String(id).toUpperCase());
      if (found) return found;
    } catch (e) {
      console.error("Firestore backup getAllOrders scan failed:", e);
    }
  }
  return lsGet().find((o) => String(o.id).toUpperCase() === String(id).toUpperCase()) || null;
}

export async function getOrdersByPhone(phone: string): Promise<Order[]> {
  try {
    const all = await getAllOrders();
    const normalized = phone.replace(/\D/g, "");
    if (!normalized) return [];
    
    const matches = all.filter((o) => {
      const orderPhoneNormalized = o.phone ? o.phone.replace(/\D/g, "") : "";
      const orderIdNormalized = o.id ? o.id.replace(/\D/g, "") : "";
      return orderPhoneNormalized.includes(normalized) || orderIdNormalized.includes(normalized);
    });

    // Sort descending by creation date/timestamp
    matches.sort((a, b) => {
      if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;
      if (a.createdAt) return -1;
      if (b.createdAt) return 1;
      return new Date(b.dateReceived || 0).getTime() - new Date(a.dateReceived || 0).getTime();
    });

    return matches;
  } catch (e) {
    console.error("getOrdersByPhone failed:", e);
    return [];
  }
}

export async function getNextOrderId(): Promise<string> {
  try {
    const all = await getAllOrders();
    const existing = all.map((o) => {
      const match = o.id.match(/^(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        return val < 1000000 ? val : 0;
      }
      return 0;
    });
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    const next = max < 1000 ? 1000 : max + 1;
    return String(next);
  } catch (e) {
    console.error("getNextOrderId failed:", e);
    return String(Date.now());
  }
}


export async function saveOrder(order: Order): Promise<void> {
  if (isConfigured && db) {
    try {
      await setDoc(doc(db, ORDERS_COLLECTION, order.id), order);
      return;
    } catch (e) {
      console.error("Firestore saveOrder failed:", e);
    }
  }
  const orders = lsGet();
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    orders[idx] = order;
  } else {
    orders.push(order);
  }
  lsSet(orders);
}

export async function deleteOrder(id: string): Promise<void> {
  if (isConfigured && db) {
    try {
      await deleteDoc(doc(db, ORDERS_COLLECTION, id));
      return;
    } catch (e) {
      console.error("Firestore deleteOrder failed:", e);
    }
  }
  const orders = lsGet().filter((o) => o.id !== id);
  lsSet(orders);
}

export function subscribeToOrders(callback: (orders: Order[]) => void) {
  if (isConfigured && db) {
    return onSnapshot(
      query(collection(db, ORDERS_COLLECTION), orderBy("id", "asc")),
      (snapshot) => {
        callback(
          snapshot.docs
            .map((d) => d.data() as Order)
            .filter((o) => !(o as any).isDelivery && !o.id.startsWith("DELIVERY_"))
        );
      }
    );
  }
  // Fallback: poll localStorage every 2 seconds
  let last = JSON.stringify(lsGet());
  const interval = setInterval(() => {
    const current = JSON.stringify(lsGet());
    if (current !== last) {
      last = current;
      callback(lsGet());
    }
  }, 2000);
  callback(lsGet());
  return () => clearInterval(interval);
}

/* ── Admin Settings ── */
const SETTINGS_LS_KEY = "shatnez_settings";

let cachedSettings: AdminSettings | null = null;
let settingsCacheTimestamp = 0;
const CACHE_TTL = 60000; // Cache settings for 60 seconds to make sequential IVR calls instantaneous

export async function getAdminSettings(): Promise<AdminSettings> {
  const defaultSettings: AdminSettings = { 
    pin: "1234", 
    adminUser: "Gershy",
    adminEmail: "gershybraun@gmail.com",
    forwardingNumber: "8455524744",
    forwardingHoursStart: "09:00",
    forwardingHoursEnd: "21:00",
    ivrGeneralEn: "",
    ivrGeneralHe: "",
    ivrSpecialEn: "",
    ivrSpecialHe: "",
    outboundMsgEn: "Hello. This is The Shatnez Lab. We are calling to inform you that your order is now ready for pickup. Pick up at 14 Buchanan Rd. Thank you.",
    outboundMsgHe: "שלום. מדברים ממעבדת שעטנז. ההזמנה שלך מוכנה לאיסוף. נא לאסוף מביוקנן 14. תודה רבה.",
    adminNotes: "",
    voicemailEmail: "",
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPass: "",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    callerIdType: "caller",
    holidayModeActive: false,
    ivrHolidayMsgEn: "Our office is currently closed for the holidays. Please leave a message after the beep.",
    ivrHolidayMsgHe: "המשרד סגור כעת לרגל החג. אנא השאירו הודעה לאחר הצפצוף.",
    dndActive: false
  };
  
  const now = Date.now();
  if (cachedSettings && (now - settingsCacheTimestamp < CACHE_TTL)) {
    return cachedSettings;
  }

  // Try localStorage first for quick access/fallback
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(SETTINGS_LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        cachedSettings = parsed;
        settingsCacheTimestamp = now;
        return parsed;
      }
    } catch {}
  }

  if (isConfigured && db) {
    try {
      const ref = doc(db, SETTINGS_COLLECTION, "admin");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as AdminSettings;
        cachedSettings = data;
        settingsCacheTimestamp = now;
        // Sync to LS
        if (typeof window !== "undefined") {
          localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(data));
        }
        return data;
      }
    } catch (e) {
      console.error("Error fetching admin settings from Firebase:", e);
    }
  }
  return defaultSettings;
}

export async function saveAdminSettings(settings: AdminSettings): Promise<void> {
  console.log("Saving admin settings:", settings);
  
  // Update in-memory cache immediately
  cachedSettings = settings;
  settingsCacheTimestamp = Date.now();
  
  // Always save to localStorage
  if (typeof window !== "undefined") {
    localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(settings));
  }

  if (isConfigured && db) {
    try {
      await setDoc(doc(db, SETTINGS_COLLECTION, "admin"), settings);
      console.log("Admin settings saved successfully to Firebase");
    } catch (error) {
      console.error("Error saving admin settings to Firebase:", error);
    }
  } else {
    console.warn("Firebase not configured, settings saved to localStorage only");
  }
}

/* ── IVR Audio Files ── */
export interface AudioFileInfo {
  name: string;
  uploadedAt: string;
}

export async function getAudioFiles(): Promise<AudioFileInfo[]> {
  if (isConfigured && db) {
    try {
      const snapshot = await getDocs(collection(db, "settings"));
      return snapshot.docs
        .filter((d) => d.id.startsWith("audio_"))
        .map((d) => {
          const data = d.data();
          return {
            name: d.id.substring("audio_".length),
            uploadedAt: data.uploadedAt || ""
          };
        });
    } catch (e) {
      console.error("Firestore getAudioFiles failed:", e);
    }
  }
  return [];
}

export async function uploadAudioFile(name: string, base64: string): Promise<void> {
  if (isConfigured && db) {
    try {
      await setDoc(doc(db, "settings", "audio_" + name.toLowerCase().trim()), {
        base64,
        uploadedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Firestore uploadAudioFile failed:", e);
      throw e;
    }
  }
}

export interface CallRecord {
  id: string; // Twilio CallSid
  phone: string;
  timestamp: number;
  actions: string[];
  status: "active" | "completed" | "voicemail";
  duration?: string;
  direction?: "inbound" | "outbound";
  orderId?: string;
  price?: string;
  priceUnit?: string;
}

function lsGetCalls(): CallRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(CALLS_LS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function lsSetCalls(calls: CallRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CALLS_LS_KEY, JSON.stringify(calls));
}

export async function logCallEvent(
  callSid: string | undefined | null,
  phone: string,
  action: string,
  status?: "active" | "completed" | "voicemail",
  duration?: string,
  direction?: "inbound" | "outbound",
  orderId?: string,
  price?: string,
  priceUnit?: string
): Promise<void> {
  const cleanPhone = phone ? phone.trim() : "Unknown";
  let targetSid = callSid || "";
  
  if (!targetSid && cleanPhone !== "Unknown") {
    try {
      const all = await getAllCalls();
      const isSmsAction = action && action.toLowerCase().includes("sms");

      if (isSmsAction) {
        // Group SMS messages from the same phone number within the last 24 hours into a single journal record
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentSmsCall = all.find(
          (c) => c.phone === cleanPhone && 
                 c.timestamp > twentyFourHoursAgo && 
                 (c.actions.some(act => act.toLowerCase().includes("sms")) || c.id.includes("_sms_"))
        );
        if (recentSmsCall) {
          targetSid = recentSmsCall.id;
        } else {
          targetSid = `${cleanPhone}_sms_${Date.now()}`;
        }
      } else {
        // Normal voice call grouping logic (only group into active calls within 15 minutes)
        const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
        const activeCall = all.find(
          (c) => c.phone === cleanPhone && c.timestamp > fifteenMinsAgo && c.status === "active"
        );
        if (activeCall) {
          targetSid = activeCall.id;
        } else {
          targetSid = `${cleanPhone}_${Date.now()}`;
        }
      }
    } catch (e) {
      targetSid = `${cleanPhone}_${Date.now()}`;
    }
  }
  
  if (!targetSid) return;

  if (isConfigured && db) {
    try {
      const docRef = doc(db, CALLS_COLLECTION, targetSid);
      const snap = await getDoc(docRef);
      let record: CallRecord;
      
      if (snap.exists()) {
        record = snap.data() as CallRecord;
        if (action && !record.actions.includes(action)) {
          record.actions.push(action);
        }
        if (status) record.status = status;
        if (orderId) record.orderId = orderId;
        if (price) record.price = price;
        if (priceUnit) record.priceUnit = priceUnit;
        if (duration) {
          record.duration = duration;
        } else if (status === "completed" && !record.duration && record.timestamp) {
          // Dynamic duration fallback (capped at 2 hours)
          const diffSeconds = Math.round((Date.now() - record.timestamp) / 1000);
          if (diffSeconds > 0 && diffSeconds < 7200) {
            record.duration = `${diffSeconds}s`;
          }
        }
      } else {
        // New CallSid: check if there's a temporary ID call log in the last 15 minutes to merge with
        let mergedActions: string[] = action ? [action] : ["Call started"];
        let originalTimestamp = Date.now();
        let mergedOrderId = orderId || "";
        let mergedDirection = direction || "inbound";
        let oldTempIdToDelete = "";

        if (targetSid.startsWith("CA") && cleanPhone !== "Unknown") {
          try {
            const all = await getAllCalls();
            const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
            const tempActiveCall = all.find(
              (c) => c.phone === cleanPhone &&
                     c.timestamp > fifteenMinsAgo &&
                     !c.id.startsWith("CA") &&
                     !c.id.includes("_sms_")
            );
            if (tempActiveCall) {
              oldTempIdToDelete = tempActiveCall.id;
              originalTimestamp = tempActiveCall.timestamp;
              if (tempActiveCall.orderId && !mergedOrderId) {
                mergedOrderId = tempActiveCall.orderId;
              }
              if (tempActiveCall.direction) {
                mergedDirection = tempActiveCall.direction;
              }
              const actionsSet = new Set([...tempActiveCall.actions]);
              if (action) {
                actionsSet.add(action);
              }
              mergedActions = Array.from(actionsSet);
            }
          } catch (mergeErr) {
            console.error("Error finding temporary call to merge in Firestore:", mergeErr);
          }
        }

        record = {
          id: targetSid,
          phone: cleanPhone,
          timestamp: originalTimestamp,
          actions: mergedActions,
          status: status || "active",
          duration: duration || "",
          direction: mergedDirection,
          orderId: mergedOrderId,
          price: price || "",
          priceUnit: priceUnit || ""
        };

        if (oldTempIdToDelete) {
          try {
            const tempDocRef = doc(db, CALLS_COLLECTION, oldTempIdToDelete);
            await deleteDoc(tempDocRef);
            console.log(`[logCallEvent] Merged and deleted temporary call log: ${oldTempIdToDelete}`);
          } catch (delErr) {
            console.error(`Failed to delete temporary call log ${oldTempIdToDelete}:`, delErr);
          }
        }
      }
      
      await setDoc(docRef, record);
      return;
    } catch (e) {
      console.error("Firestore logCallEvent failed:", e);
    }
  }
  
  // LocalStorage fallback
  const calls = lsGetCalls();
  const idx = calls.findIndex((c) => c.id === targetSid);
  if (idx >= 0) {
    const record = calls[idx];
    if (action && !record.actions.includes(action)) {
      record.actions.push(action);
    }
    if (status) record.status = status;
    if (orderId) record.orderId = orderId;
    if (price) record.price = price;
    if (priceUnit) record.priceUnit = priceUnit;
    if (duration) {
      record.duration = duration;
    } else if (status === "completed" && !record.duration && record.timestamp) {
      const diffSeconds = Math.round((Date.now() - record.timestamp) / 1000);
      if (diffSeconds > 0 && diffSeconds < 7200) {
        record.duration = `${diffSeconds}s`;
      }
    }
    calls[idx] = record;
  } else {
    let mergedActions: string[] = action ? [action] : ["Call started"];
    let originalTimestamp = Date.now();
    let mergedOrderId = orderId || "";
    let mergedDirection = direction || "inbound";
    let oldTempIdToDelete = "";

    if (targetSid.startsWith("CA") && cleanPhone !== "Unknown") {
      const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
      const tempIdx = calls.findIndex(
        (c) => c.phone === cleanPhone &&
               c.timestamp > fifteenMinsAgo &&
               !c.id.startsWith("CA") &&
               !c.id.includes("_sms_")
      );
      if (tempIdx >= 0) {
        const tempActiveCall = calls[tempIdx];
        oldTempIdToDelete = tempActiveCall.id;
        originalTimestamp = tempActiveCall.timestamp;
        if (tempActiveCall.orderId && !mergedOrderId) {
          mergedOrderId = tempActiveCall.orderId;
        }
        if (tempActiveCall.direction) {
          mergedDirection = tempActiveCall.direction;
        }
        const actionsSet = new Set([...tempActiveCall.actions]);
        if (action) {
          actionsSet.add(action);
        }
        mergedActions = Array.from(actionsSet);
        calls.splice(tempIdx, 1); // Delete temp call from localStorage
      }
    }

    calls.push({
      id: targetSid,
      phone: cleanPhone,
      timestamp: originalTimestamp,
      actions: mergedActions,
      status: status || "active",
      duration: duration || "",
      direction: mergedDirection,
      orderId: mergedOrderId,
      price: price || "",
      priceUnit: priceUnit || ""
    });
  }
  lsSetCalls(calls);
}

export async function getAllCalls(): Promise<CallRecord[]> {
  if (isConfigured && db) {
    try {
      const snapshot = await getDocs(
        query(collection(db, CALLS_COLLECTION), orderBy("timestamp", "desc"))
      );
      return snapshot.docs.map((d) => d.data() as CallRecord);
    } catch (e) {
      console.error("Firestore getAllCalls failed:", e);
    }
  }
  return lsGetCalls().sort((a, b) => b.timestamp - a.timestamp);
}

export async function getRecentCalls(limitNum: number): Promise<CallRecord[]> {
  if (isConfigured && db) {
    try {
      const snapshot = await getDocs(
        query(collection(db, CALLS_COLLECTION), orderBy("timestamp", "desc"), limit(limitNum))
      );
      return snapshot.docs.map((d) => d.data() as CallRecord);
    } catch (e) {
      console.error("Firestore getRecentCalls failed:", e);
    }
  }
  return lsGetCalls().sort((a, b) => b.timestamp - a.timestamp).slice(0, limitNum);
}

export function subscribeToCalls(callback: (calls: CallRecord[]) => void) {
  if (isConfigured && db) {
    return onSnapshot(
      query(collection(db, CALLS_COLLECTION), orderBy("timestamp", "desc")),
      (snapshot) => {
        callback(snapshot.docs.map((d) => d.data() as CallRecord));
      },
      (error) => {
        console.error("Firestore calls subscription error:", error);
      }
    );
  }
  // Fallback: poll localStorage every 2 seconds
  let last = JSON.stringify(lsGetCalls());
  const interval = setInterval(() => {
    const current = JSON.stringify(lsGetCalls());
    if (current !== last) {
      last = current;
      callback(lsGetCalls().sort((a, b) => b.timestamp - a.timestamp));
    }
  }, 2000);
  callback(lsGetCalls().sort((a, b) => b.timestamp - a.timestamp));
  return () => clearInterval(interval);
}

export async function deleteAudioFile(name: string): Promise<void> {
  if (isConfigured && db) {
    try {
      await deleteDoc(doc(db, "settings", "audio_" + name.toLowerCase().trim()));
    } catch (e) {
      console.error("Firestore deleteAudioFile failed:", e);
      throw e;
    }
  }
}

/* ── Voicemails ── */
export async function saveVoicemail(voicemail: Voicemail): Promise<void> {
  if (isConfigured && db) {
    try {
      await setDoc(doc(db, VOICEMAILS_COLLECTION, voicemail.id), voicemail);
      return;
    } catch (e) {
      console.error("Firestore saveVoicemail failed:", e);
    }
  }
}

export async function deleteVoicemail(id: string): Promise<void> {
  if (isConfigured && db) {
    try {
      await deleteDoc(doc(db, VOICEMAILS_COLLECTION, id));
      return;
    } catch (e) {
      console.error("Firestore deleteVoicemail failed:", e);
    }
  }
}

export async function markVoicemailRead(id: string): Promise<void> {
  if (isConfigured && db) {
    try {
      const ref = doc(db, VOICEMAILS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const vm = snap.data() as Voicemail;
        vm.read = true;
        await setDoc(ref, vm);
      }
    } catch (e) {
      console.error("Firestore markVoicemailRead failed:", e);
    }
  }
}

export function subscribeToVoicemails(callback: (voicemails: Voicemail[]) => void) {
  if (isConfigured && db) {
    return onSnapshot(
      query(collection(db, VOICEMAILS_COLLECTION), orderBy("timestamp", "desc")),
      (snapshot) => {
        const voicemails = snapshot.docs.map((d) => d.data() as Voicemail);
        callback(voicemails);
      },
      (error) => {
        console.error("Firestore voicemails subscription error:", error);
      }
    );
  }
  return () => {};
}

/* ── Interactive SMS Admin State Management ── */
export interface AdminState {
  action: "add" | "update" | "idle";
  step: number;
  tempData: {
    orderId?: string;
    customerPhone?: string;
    customerName?: string;
    statusDigit?: string;
    resultDigit?: string;
    locationDigit?: string;
    notifyDigit?: string;
  };
  lastUpdated: number;
}

export async function getAdminState(phone: string): Promise<AdminState | null> {
  if (isConfigured && db) {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const ref = doc(db, SETTINGS_COLLECTION, `state_${cleanPhone}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as AdminState;
        // Expire state after 15 minutes of inactivity
        if (Date.now() - data.lastUpdated < 15 * 60 * 1000) {
          return data;
        }
      }
    } catch (e) {
      console.error("Error fetching admin state from Firebase:", e);
    }
  }
  return null;
}

export async function saveAdminState(phone: string, state: AdminState): Promise<void> {
  if (isConfigured && db) {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const ref = doc(db, SETTINGS_COLLECTION, `state_${cleanPhone}`);
      await setDoc(ref, state);
    } catch (e) {
      console.error("Error saving admin state to Firebase:", e);
    }
  }
}

export async function clearAdminState(phone: string): Promise<void> {
  if (isConfigured && db) {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const ref = doc(db, SETTINGS_COLLECTION, `state_${cleanPhone}`);
      await deleteDoc(ref);
    } catch (e) {
      console.error("Error clearing admin state from Firebase:", e);
    }
  }
}

/* ── SMS Conversations Logging ── */
export interface SmsMessage {
  id: string;
  phone: string;
  timestamp: number;
  body: string;
  direction: "inbound" | "outbound";
  orderId?: string;
  read?: boolean;
  price?: string;
  priceUnit?: string;
}

const SMS_COLLECTION = "sms_messages";
const SMS_LS_KEY = "shatnez_sms";

export function subscribeToSmsMessages(callback: (messages: SmsMessage[]) => void): () => void {
  if (isConfigured && db) {
    return onSnapshot(
      query(collection(db, SMS_COLLECTION), orderBy("timestamp", "asc")),
      (snapshot) => {
        callback(snapshot.docs.map((d) => d.data() as SmsMessage));
      },
      (error) => {
        console.error("Firestore SMS subscription error:", error);
      }
    );
  }
  
  // LocalStorage fallback
  function getLsSms(): SmsMessage[] {
    try {
      const data = localStorage.getItem(SMS_LS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
  
  let last = JSON.stringify(getLsSms());
  const interval = setInterval(() => {
    const current = JSON.stringify(getLsSms());
    if (current !== last) {
      last = current;
      callback(getLsSms().sort((a, b) => a.timestamp - b.timestamp));
    }
  }, 2000);
  callback(getLsSms().sort((a, b) => a.timestamp - b.timestamp));
  return () => clearInterval(interval);
}

export async function getRecentSmsMessages(limitNum: number): Promise<SmsMessage[]> {
  if (isConfigured && db) {
    try {
      const snapshot = await getDocs(
        query(collection(db, SMS_COLLECTION), orderBy("timestamp", "desc"), limit(limitNum))
      );
      return snapshot.docs.map((d) => d.data() as SmsMessage);
    } catch (e) {
      console.error("Firestore getRecentSmsMessages failed:", e);
    }
  }
  try {
    const data = typeof window !== "undefined" ? localStorage.getItem(SMS_LS_KEY) : null;
    const list = data ? JSON.parse(data) as SmsMessage[] : [];
    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, limitNum);
  } catch {
    return [];
  }
}

export async function logSmsMessage(
  phone: string,
  body: string,
  direction: "inbound" | "outbound",
  msgSid?: string,
  orderId?: string
): Promise<void> {
  const cleanPhone = phone.replace(/\D/g, "");
  const id = msgSid || `${cleanPhone}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  const record: SmsMessage = {
    id,
    phone: cleanPhone,
    timestamp: Date.now(),
    body,
    direction,
    orderId: orderId || "",
    read: direction === "outbound"
  };

  if (isConfigured && db) {
    try {
      const docRef = doc(db, SMS_COLLECTION, id);
      await setDoc(docRef, record);
      return;
    } catch (e) {
      console.error("Firestore logSmsMessage failed:", e);
    }
  }

  // LocalStorage fallback
  try {
    const data = localStorage.getItem(SMS_LS_KEY) || "[]";
    const messages = JSON.parse(data) as SmsMessage[];
    messages.push(record);
    localStorage.setItem(SMS_LS_KEY, JSON.stringify(messages));
  } catch (e) {
    console.error("LocalStorage logSmsMessage failed:", e);
  }
}

export async function associateCallWithOrder(callId: string, orderId: string): Promise<void> {
  if (isConfigured && db) {
    try {
      const docRef = doc(db, CALLS_COLLECTION, callId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const record = snap.data() as CallRecord;
        record.orderId = orderId;
        await setDoc(docRef, record);
      }
    } catch (e) {
      console.error("Firestore associateCallWithOrder failed:", e);
    }
  } else {
    // LocalStorage fallback
    const calls = lsGetCalls();
    const idx = calls.findIndex(c => c.id === callId);
    if (idx >= 0) {
      calls[idx].orderId = orderId;
      lsSetCalls(calls);
    }
  }
}

export async function associateSmsWithOrder(smsId: string, orderId: string): Promise<void> {
  if (isConfigured && db) {
    try {
      const docRef = doc(db, SMS_COLLECTION, smsId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const record = snap.data() as SmsMessage;
        record.orderId = orderId;
        await setDoc(docRef, record);
      }
    } catch (e) {
      console.error("Firestore associateSmsWithOrder failed:", e);
    }
  } else {
    // LocalStorage fallback
    try {
      const data = localStorage.getItem(SMS_LS_KEY) || "[]";
      const messages = JSON.parse(data) as SmsMessage[];
      const idx = messages.findIndex(m => m.id === smsId);
      if (idx >= 0) {
        messages[idx].orderId = orderId;
        localStorage.setItem(SMS_LS_KEY, JSON.stringify(messages));
      }
    } catch (e) {
      console.error("LocalStorage associateSmsWithOrder failed:", e);
    }
  }
}

export async function markSmsThreadRead(phone: string): Promise<void> {
  const cleanPhone = phone.replace(/\D/g, "");
  if (isConfigured && db) {
    try {
      const snapshot = await getDocs(
        query(collection(db!, SMS_COLLECTION))
      );
      const batchPromises = snapshot.docs
        .filter(d => {
          const data = d.data() as SmsMessage;
          return data.phone.replace(/\D/g, "") === cleanPhone && data.direction === "inbound" && !data.read;
        })
        .map(d => {
          const ref = doc(db!, SMS_COLLECTION, d.id);
          return setDoc(ref, { read: true }, { merge: true });
        });
      await Promise.all(batchPromises);
    } catch (e) {
      console.error("Firestore markSmsThreadRead failed:", e);
    }
  } else {
    // LocalStorage fallback
    try {
      const data = localStorage.getItem(SMS_LS_KEY) || "[]";
      const messages = JSON.parse(data) as SmsMessage[];
      let updated = false;
      for (const m of messages) {
        if (m.phone.replace(/\D/g, "") === cleanPhone && m.direction === "inbound" && !m.read) {
          m.read = true;
          updated = true;
        }
      }
      if (updated) {
        localStorage.setItem(SMS_LS_KEY, JSON.stringify(messages));
      }
    } catch (e) {
      console.error("LocalStorage markSmsThreadRead failed:", e);
    }
  }
}

export async function updateCallPrice(
  callSid: string,
  price: string,
  priceUnit: string,
  duration?: string
): Promise<void> {
  if (isConfigured && db) {
    try {
      const docRef = doc(db, CALLS_COLLECTION, callSid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const record = snap.data() as CallRecord;
        record.price = price;
        record.priceUnit = priceUnit;
        if (duration) record.duration = duration;
        await setDoc(docRef, record);
      }
    } catch (e) {
      console.error("Firestore updateCallPrice failed:", e);
    }
  } else {
    // LocalStorage fallback
    try {
      const data = localStorage.getItem(CALLS_LS_KEY) || "[]";
      const calls = JSON.parse(data) as CallRecord[];
      const idx = calls.findIndex((c) => c.id === callSid);
      if (idx >= 0) {
        calls[idx].price = price;
        calls[idx].priceUnit = priceUnit;
        if (duration) calls[idx].duration = duration;
        localStorage.setItem(CALLS_LS_KEY, JSON.stringify(calls));
      }
    } catch (e) {
      console.error("LocalStorage updateCallPrice failed:", e);
    }
  }
}

export async function getTwilioBalance(): Promise<{ balance: string; currency: string } | null> {
  try {
    const settings = await getAdminSettings();
    if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
      return null;
    }
    const auth = Buffer.from(`${settings.twilioAccountSid}:${settings.twilioAuthToken}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioAccountSid}/Balance.json`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `Basic ${auth}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        balance: data.balance,
        currency: data.currency
      };
    }
  } catch (e) {
    console.error("Twilio getTwilioBalance failed:", e);
  }
  return null;
}

/* ── Pickup & Delivery Requests ── */
function lsGetDeliveries(): DeliveryRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(DELIVERIES_LS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function lsSetDeliveries(deliveries: DeliveryRequest[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DELIVERIES_LS_KEY, JSON.stringify(deliveries));
}

export async function saveDeliveryRequest(request: DeliveryRequest): Promise<void> {
  if (isConfigured && db) {
    try {
      const docId = request.id.startsWith("DELIVERY_") ? request.id : `DELIVERY_${request.id}`;
      const dataToSave = {
        ...request,
        id: docId,
        isDelivery: true
      };
      await setDoc(doc(db, ORDERS_COLLECTION, docId), dataToSave);
      return;
    } catch (e) {
      console.error("Firestore saveDeliveryRequest failed:", e);
    }
  }
  const list = lsGetDeliveries();
  const idx = list.findIndex((d) => d.id === request.id);
  if (idx >= 0) {
    list[idx] = request;
  } else {
    list.push(request);
  }
  lsSetDeliveries(list);
}

export async function deleteDeliveryRequest(id: string): Promise<void> {
  if (isConfigured && db) {
    try {
      const docId = id.startsWith("DELIVERY_") ? id : `DELIVERY_${id}`;
      await deleteDoc(doc(db, ORDERS_COLLECTION, docId));
      return;
    } catch (e) {
      console.error("Firestore deleteDeliveryRequest failed:", e);
    }
  }
  const list = lsGetDeliveries().filter((d) => d.id !== id);
  lsSetDeliveries(list);
}

export async function getAllDeliveryRequests(): Promise<DeliveryRequest[]> {
  if (isConfigured && db) {
    try {
      const snapshot = await getDocs(
        query(collection(db, ORDERS_COLLECTION))
      );
      return snapshot.docs
        .map((d) => d.data())
        .filter((data) => data.isDelivery === true || String(data.id).startsWith("DELIVERY_"))
        .map((data) => ({
          id: data.id,
          phone: data.phone || "",
          customerName: data.customerName || "",
          timestamp: data.timestamp || data.createdAt || Date.now(),
          status: data.status || "pending",
          createdAt: data.createdAt || new Date().toISOString(),
          notes: data.notes || ""
        } as DeliveryRequest))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
      console.error("Firestore getAllDeliveryRequests failed:", e);
    }
  }
  return lsGetDeliveries().sort((a, b) => b.timestamp - a.timestamp);
}

export function subscribeToDeliveryRequests(callback: (requests: DeliveryRequest[]) => void) {
  if (isConfigured && db) {
    return onSnapshot(
      query(collection(db, ORDERS_COLLECTION)),
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => d.data())
          .filter((data) => data.isDelivery === true || String(data.id).startsWith("DELIVERY_"))
          .map((data) => ({
            id: data.id,
            phone: data.phone || "",
            customerName: data.customerName || "",
            timestamp: data.timestamp || data.createdAt || Date.now(),
            status: data.status || "pending",
            createdAt: data.createdAt || new Date().toISOString(),
            notes: data.notes || ""
          } as DeliveryRequest))
          .sort((a, b) => b.timestamp - a.timestamp);
        callback(list);
      },
      (error) => {
        console.error("Firestore deliveries subscription error:", error);
      }
    );
  }
  // Fallback: poll localStorage every 2 seconds
  let last = JSON.stringify(lsGetDeliveries());
  const interval = setInterval(() => {
    const current = JSON.stringify(lsGetDeliveries());
    if (current !== last) {
      last = current;
      callback(lsGetDeliveries().sort((a, b) => b.timestamp - a.timestamp));
    }
  }, 2000);
  callback(lsGetDeliveries().sort((a, b) => b.timestamp - a.timestamp));
  return () => clearInterval(interval);
}

export async function getAllSmsMessages(): Promise<SmsMessage[]> {
  if (isConfigured && db) {
    try {
      const snapshot = await getDocs(
        query(collection(db, SMS_COLLECTION), orderBy("timestamp", "desc"))
      );
      return snapshot.docs.map((d) => d.data() as SmsMessage);
    } catch (e) {
      console.error("Firestore getAllSmsMessages failed:", e);
    }
  }
  const data = typeof window !== "undefined" ? localStorage.getItem(SMS_LS_KEY) : null;
  return data ? (JSON.parse(data) as SmsMessage[]).sort((a, b) => b.timestamp - a.timestamp) : [];
}

export async function updateSmsMessagePrice(
  id: string,
  price: string,
  priceUnit: string,
  msgSid?: string
): Promise<void> {
  if (isConfigured && db) {
    try {
      const docRef = doc(db, SMS_COLLECTION, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const record = snap.data() as SmsMessage;
        record.price = price;
        record.priceUnit = priceUnit;
        if (msgSid) record.id = msgSid;
        
        if (msgSid && msgSid !== id) {
          await deleteDoc(docRef);
          await setDoc(doc(db, SMS_COLLECTION, msgSid), record);
        } else {
          await setDoc(docRef, record);
        }
      }
    } catch (e) {
      console.error("Firestore updateSmsMessagePrice failed:", e);
    }
  } else {
    // LocalStorage fallback
    try {
      const data = localStorage.getItem(SMS_LS_KEY) || "[]";
      const messages = JSON.parse(data) as SmsMessage[];
      const idx = messages.findIndex((m) => m.id === id);
      if (idx >= 0) {
        messages[idx].price = price;
        messages[idx].priceUnit = priceUnit;
        if (msgSid) messages[idx].id = msgSid;
        localStorage.setItem(SMS_LS_KEY, JSON.stringify(messages));
      }
    } catch (e) {
      console.error("LocalStorage updateSmsMessagePrice failed:", e);
    }
  }
}






