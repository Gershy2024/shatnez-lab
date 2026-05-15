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
    const snapshot = await getDocs(
      query(collection(db, ORDERS_COLLECTION), orderBy("id", "asc"))
    );
    return snapshot.docs.map((d) => d.data() as Order);
  }
  return lsGet();
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (isConfigured && db) {
    const ref = doc(db, ORDERS_COLLECTION, id);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as Order) : null;
  }
  return lsGet().find((o) => o.id.toUpperCase() === id.toUpperCase()) || null;
}

export async function getOrdersByPhone(phone: string): Promise<Order[]> {
  const all = await getAllOrders();
  const normalized = phone.replace(/\D/g, "");
  return all.filter((o) => {
    if (!o.phone) return false;
    return o.phone.replace(/\D/g, "").includes(normalized);
  });
}

export async function saveOrder(order: Order): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, ORDERS_COLLECTION, order.id), order);
    return;
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
    await deleteDoc(doc(db, ORDERS_COLLECTION, id));
    return;
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
export async function getAdminSettings(): Promise<AdminSettings> {
  const defaultSettings: AdminSettings = { pin: "1234", forwardingNumber: "8457092022" };
  if (isConfigured && db) {
    const ref = doc(db, SETTINGS_COLLECTION, "admin");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as AdminSettings;
    }
  }
  return defaultSettings;
}

export async function saveAdminSettings(settings: AdminSettings): Promise<void> {
  console.log("Saving admin settings:", settings);
  if (isConfigured && db) {
    try {
      await setDoc(doc(db, SETTINGS_COLLECTION, "admin"), settings);
      console.log("Admin settings saved successfully");
    } catch (error) {
      console.error("Error saving admin settings:", error);
      throw error;
    }
  } else {
    console.warn("Firebase not configured, settings not saved to DB");
  }
}
