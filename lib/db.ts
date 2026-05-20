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

export interface Order {
  id: string;
  customerName: string;
  phone?: string;
  status: OrderStatus;
  dateReceived: string;
  estimatedCompletion: string;
  notes: string;
  result: string;
}

export interface AdminSettings {
  pin: string;
  forwardingNumber: string;
  ivrGeneralEn?: string;
  ivrGeneralHe?: string;
  ivrSpecialEn?: string;
  ivrSpecialHe?: string;
  adminNotes?: string;
  voicemailEmail?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
}

const ORDERS_COLLECTION = "orders";
const SETTINGS_COLLECTION = "settings";
const LS_KEY = "shatnez_orders";

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
    return all.filter((o) => {
      if (!o.phone) return false;
      return o.phone.replace(/\D/g, "").includes(normalized);
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
    forwardingNumber: "8457092022",
    ivrGeneralEn: "",
    ivrGeneralHe: "",
    ivrSpecialEn: "",
    ivrSpecialHe: "",
    adminNotes: "",
    voicemailEmail: "",
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPass: ""
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

