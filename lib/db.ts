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
}

const ORDERS_COLLECTION = "orders";
const SETTINGS_COLLECTION = "settings";
const VOICEMAILS_COLLECTION = "voicemails";
const CALLS_COLLECTION = "calls";
const LS_KEY = "shatnez_orders";
const LS_VM_KEY = "shatnez_voicemails";
const CALLS_LS_KEY = "shatnez_calls";

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
      return snapshot.docs.map((d) => d.data() as Order);
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

    if (matches.length === 0) return [];

    // Sort descending by date
    matches.sort((a, b) => new Date(b.dateReceived || 0).getTime() - new Date(a.dateReceived || 0).getTime());

    const newestDateStr = matches[0].dateReceived;
    if (!newestDateStr) return matches;

    const newestTime = new Date(newestDateStr).getTime();
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

    // Only return orders that are within 14 days of the newest order
    return matches.filter(o => {
      if (!o.dateReceived) return true;
      const oTime = new Date(o.dateReceived).getTime();
      return (newestTime - oTime) <= TWO_WEEKS_MS;
    });
  } catch (e) {
    console.error("getOrdersByPhone failed:", e);
    return [];
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
        callback(snapshot.docs.map((d) => d.data() as Order));
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
  orderId?: string
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
          orderId: mergedOrderId
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
      orderId: mergedOrderId
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
}

const SMS_COLLECTION = "sms_messages";
const SMS_LS_KEY = "shatnez_sms";

export function subscribeToSmsMessages(callback: (messages: SmsMessage[]) => void) {
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
    orderId: orderId || ""
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


