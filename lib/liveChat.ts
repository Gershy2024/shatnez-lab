import { db, isConfigured } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
} from "firebase/firestore";

export interface ChatMessage {
  id: string;
  sender: "user" | "admin";
  text: string;
  timestamp: number;
}

export interface ChatSession {
  sessionId: string;
  shortId: string;
  createdAt: number;
  lastUpdated: number;
  messages: ChatMessage[];
  status: "active" | "closed";
  visitorEmail?: string;
  visitorPhone?: string;
  currentPage?: string;
  deviceInfo?: string;
  referrer?: string;
  location?: string;
}

const CHATS_COLLECTION = "live_chats";
const COUNTER_DOC = "counter";
const PRESENCE_DOC = "admin_presence";

// In-memory fallback for local testing / offline / serverless RAM
const memoryStore = new Map<string, ChatSession>();
let inMemoryAdminPresence = {
  isOnline: false,
  lastActive: 0,
};

async function getNextShortId(): Promise<string> {
  if (isConfigured && db) {
    try {
      const counterRef = doc(db, CHATS_COLLECTION, COUNTER_DOC);
      const snap = await getDoc(counterRef);
      let currentVal = 100;
      if (snap.exists()) {
        currentVal = snap.data().val || 100;
      }
      const nextVal = currentVal + 1;
      await setDoc(counterRef, { val: nextVal });
      return String(nextVal);
    } catch (e) {
      console.error("[LiveChat] Failed to generate shortId from Firestore:", e);
    }
  }
  return String(Math.floor(100 + Math.random() * 900));
}

export async function getOrCreateChatSession(
  sessionIdInput?: string,
  metadata?: { currentPage?: string; deviceInfo?: string; referrer?: string; location?: string }
): Promise<ChatSession> {
  let targetId = sessionIdInput;
  if (!targetId) {
    targetId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  if (isConfigured && db) {
    try {
      const ref = doc(db, CHATS_COLLECTION, targetId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as ChatSession;
        if (metadata?.currentPage) data.currentPage = metadata.currentPage;
        if (metadata?.deviceInfo) data.deviceInfo = metadata.deviceInfo;
        if (metadata?.referrer) data.referrer = metadata.referrer;
        if (metadata?.location) data.location = metadata.location;
        memoryStore.set(targetId, data);
        return data;
      }

      const shortId = await getNextShortId();
      const newSession: ChatSession = {
        sessionId: targetId,
        shortId,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        messages: [],
        status: "active",
        currentPage: metadata?.currentPage || "/",
        deviceInfo: metadata?.deviceInfo,
        referrer: metadata?.referrer,
        location: metadata?.location,
      };

      await setDoc(ref, newSession);
      memoryStore.set(targetId, newSession);
      return newSession;
    } catch (e) {
      console.error("[LiveChat] Firestore getOrCreateChatSession failed:", e);
    }
  }

  // Fallback to memory
  if (memoryStore.has(targetId)) {
    const data = memoryStore.get(targetId)!;
    if (metadata?.currentPage) data.currentPage = metadata.currentPage;
    if (metadata?.deviceInfo) data.deviceInfo = metadata.deviceInfo;
    if (metadata?.referrer) data.referrer = metadata.referrer;
    if (metadata?.location) data.location = metadata.location;
    return data;
  }
  const fallbackSession: ChatSession = {
    sessionId: targetId,
    shortId: String(Math.floor(100 + Math.random() * 900)),
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    messages: [],
    status: "active",
    currentPage: metadata?.currentPage || "/",
    deviceInfo: metadata?.deviceInfo,
    referrer: metadata?.referrer,
    location: metadata?.location,
  };
  memoryStore.set(targetId, fallbackSession);
  return fallbackSession;
}

export async function updateSessionMetadata(
  sessionId: string,
  metadata: { currentPage?: string; deviceInfo?: string; referrer?: string; location?: string }
): Promise<ChatSession | null> {
  if (isConfigured && db) {
    try {
      const ref = doc(db, CHATS_COLLECTION, sessionId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const session = snap.data() as ChatSession;
        if (metadata.currentPage) session.currentPage = metadata.currentPage;
        if (metadata.deviceInfo) session.deviceInfo = metadata.deviceInfo;
        if (metadata.referrer) session.referrer = metadata.referrer;
        if (metadata.location) session.location = metadata.location;
        session.lastUpdated = Date.now();

        await setDoc(ref, session);
        memoryStore.set(sessionId, session);
        return session;
      }
    } catch (e) {
      console.error("[LiveChat] Firestore updateSessionMetadata failed:", e);
    }
  }

  const session = memoryStore.get(sessionId);
  if (session) {
    if (metadata.currentPage) session.currentPage = metadata.currentPage;
    if (metadata.deviceInfo) session.deviceInfo = metadata.deviceInfo;
    if (metadata.referrer) session.referrer = metadata.referrer;
    if (metadata.location) session.location = metadata.location;
    session.lastUpdated = Date.now();
    memoryStore.set(sessionId, session);
    return session;
  }
  return null;
}

export async function addChatMessage(
  sessionId: string,
  sender: "user" | "admin",
  text: string
): Promise<ChatSession | null> {
  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sender,
    text: text.trim(),
    timestamp: Date.now(),
  };

  // Detect email / phone in visitor text
  let extractedEmail: string | undefined;
  let extractedPhone: string | undefined;
  if (sender === "user") {
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    if (emailMatch) extractedEmail = emailMatch[0];

    const clean = text.replace(/\D/g, "");
    if (clean.length >= 7 && clean.length <= 15) {
      extractedPhone = text.trim();
    } else {
      const phoneMatch = text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
      if (phoneMatch) extractedPhone = phoneMatch[0];
    }
  }

  if (isConfigured && db) {
    try {
      const ref = doc(db, CHATS_COLLECTION, sessionId);
      const snap = await getDoc(ref);
      let session: ChatSession;

      if (snap.exists()) {
        session = snap.data() as ChatSession;
        session.messages.push(newMsg);
        session.lastUpdated = Date.now();
        if (extractedEmail) session.visitorEmail = extractedEmail;
        if (extractedPhone) session.visitorPhone = extractedPhone;
      } else {
        const shortId = await getNextShortId();
        session = {
          sessionId,
          shortId,
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          messages: [newMsg],
          status: "active",
          visitorEmail: extractedEmail,
          visitorPhone: extractedPhone,
        };
      }

      await setDoc(ref, session);
      memoryStore.set(sessionId, session);
      return session;
    } catch (e) {
      console.error("[LiveChat] Firestore addChatMessage failed:", e);
    }
  }

  // Memory fallback
  const session = memoryStore.get(sessionId) || {
    sessionId,
    shortId: "101",
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    messages: [],
    status: "active",
  };
  session.messages.push(newMsg);
  session.lastUpdated = Date.now();
  if (extractedEmail) session.visitorEmail = extractedEmail;
  if (extractedPhone) session.visitorPhone = extractedPhone;
  memoryStore.set(sessionId, session);
  return session;
}

export async function findChatSessionByShortId(shortId: string): Promise<ChatSession | null> {
  const cleanShortId = shortId ? shortId.replace(/\D/g, "") : "";

  if (isConfigured && db) {
    try {
      const snapshotAll = await getDocs(collection(db, CHATS_COLLECTION));
      const docs = snapshotAll.docs
        .map((d) => d.data() as ChatSession)
        .filter((s) => s && s.sessionId && s.shortId);

      if (cleanShortId) {
        const found = docs.find((s) => s.shortId === cleanShortId || s.sessionId.includes(cleanShortId));
        if (found) return found;
      }

      if (docs.length > 0) {
        docs.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
        return docs[0];
      }
    } catch (e) {
      console.error("[LiveChat] Firestore findChatSessionByShortId query failed:", e);
    }
  }

  // Memory fallback
  const allSessions = Array.from(memoryStore.values());
  if (cleanShortId) {
    for (let i = 0; i < allSessions.length; i++) {
      if (allSessions[i].shortId === cleanShortId) return allSessions[i];
    }
  }
  if (allSessions.length > 0) {
    allSessions.sort((a, b) => b.lastUpdated - a.lastUpdated);
    return allSessions[0];
  }
  return null;
}

export async function getAllChatSessions(): Promise<ChatSession[]> {
  const sessionsMap = new Map<string, ChatSession>();

  // Memory store sessions
  memoryStore.forEach((sess, id) => sessionsMap.set(id, sess));

  if (isConfigured && db) {
    try {
      const snapshot = await getDocs(collection(db, CHATS_COLLECTION));
      snapshot.forEach((docSnap) => {
        if (docSnap.id !== COUNTER_DOC) {
          const data = docSnap.data() as ChatSession;
          if (data && data.sessionId) {
            sessionsMap.set(data.sessionId, data);
            memoryStore.set(data.sessionId, data);
          }
        }
      });
    } catch (e) {
      console.error("[LiveChat] getAllChatSessions Firestore error:", e);
    }
  }

  const now = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;
  const sessions = Array.from(sessionsMap.values()).filter((s) => {
    const hasMsgs = s.messages && s.messages.length > 0;
    const isRecent = (now - (s.lastUpdated || s.createdAt || 0)) < TEN_MINUTES;
    return hasMsgs || isRecent;
  });

  sessions.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  return sessions;
}

export function subscribeToChatSession(
  sessionId: string,
  callback: (session: ChatSession | null) => void
) {
  if (isConfigured && db) {
    const ref = doc(db, CHATS_COLLECTION, sessionId);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ChatSession;
          memoryStore.set(sessionId, data);
          callback(data);
        } else {
          callback(memoryStore.get(sessionId) || null);
        }
      },
      (err) => {
        console.error("[LiveChat] Firestore subscription error:", err);
        callback(memoryStore.get(sessionId) || null);
      }
    );
  }

  // Local memory polling fallback
  const interval = setInterval(() => {
    const session = memoryStore.get(sessionId) || null;
    callback(session);
  }, 1000);

  return () => clearInterval(interval);
}

export function subscribeToAllChatSessions(callback: (sessions: ChatSession[]) => void) {
  if (isConfigured && db) {
    return onSnapshot(
      collection(db, CHATS_COLLECTION),
      (snap) => {
        const sessionsMap = new Map<string, ChatSession>();

        // Include memory sessions first
        memoryStore.forEach((sess, id) => sessionsMap.set(id, sess));

        // Override with Firestore live docs
        snap.forEach((docSnap) => {
          if (docSnap.id !== COUNTER_DOC) {
            const data = docSnap.data() as ChatSession;
            if (data && data.sessionId) {
              sessionsMap.set(data.sessionId, data);
              memoryStore.set(data.sessionId, data);
            }
          }
        });

        const now = Date.now();
        const TEN_MINUTES = 10 * 60 * 1000;
        const sessions = Array.from(sessionsMap.values()).filter((s) => {
          const hasMsgs = s.messages && s.messages.length > 0;
          const isRecent = (now - (s.lastUpdated || s.createdAt || 0)) < TEN_MINUTES;
          return hasMsgs || isRecent;
        });

        sessions.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
        callback(sessions);
      },
      (err) => {
        console.error("[LiveChat] Firestore subscribeToAllChatSessions error:", err);
        const sessions = Array.from(memoryStore.values());
        sessions.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
        callback(sessions);
      }
    );
  }

  // Memory fallback polling
  const interval = setInterval(() => {
    const sessions = Array.from(memoryStore.values());
    sessions.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    callback(sessions);
  }, 1000);

  return () => clearInterval(interval);
}

export async function updateAdminPresence(isOnline: boolean = true): Promise<void> {
  const payload = {
    isOnline,
    lastActive: Date.now(),
  };
  inMemoryAdminPresence = payload;

  if (isConfigured && db) {
    try {
      const ref = doc(db, CHATS_COLLECTION, PRESENCE_DOC);
      await setDoc(ref, payload);
    } catch (e) {
      console.error("[LiveChat] Failed to update admin presence:", e);
    }
  }
}

export async function getAdminPresence(): Promise<{ isOnline: boolean; lastActive: number }> {
  if (isConfigured && db) {
    try {
      const ref = doc(db, CHATS_COLLECTION, PRESENCE_DOC);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as { isOnline: boolean; lastActive: number };
        const isFresh = Date.now() - (data.lastActive || 0) < 60000; // active within last 60s
        return {
          isOnline: !!data.isOnline && isFresh,
          lastActive: data.lastActive || 0,
        };
      }
    } catch (e) {
      console.error("[LiveChat] Failed to get admin presence from Firestore:", e);
    }
  }

  const isFresh = Date.now() - (inMemoryAdminPresence.lastActive || 0) < 60000;
  return {
    isOnline: inMemoryAdminPresence.isOnline && isFresh,
    lastActive: inMemoryAdminPresence.lastActive,
  };
}

export async function updateSessionStatus(
  sessionId: string,
  status: "active" | "closed"
): Promise<ChatSession | null> {
  if (isConfigured && db) {
    try {
      const ref = doc(db, CHATS_COLLECTION, sessionId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const session = snap.data() as ChatSession;
        session.status = status;
        session.lastUpdated = Date.now();
        await setDoc(ref, session);
        memoryStore.set(sessionId, session);
        return session;
      }
    } catch (e) {
      console.error("[LiveChat] Failed to update session status:", e);
    }
  }

  const session = memoryStore.get(sessionId);
  if (session) {
    session.status = status;
    session.lastUpdated = Date.now();
    memoryStore.set(sessionId, session);
    return session;
  }
  return null;
}

export async function deleteChatSession(sessionId: string): Promise<boolean> {
  memoryStore.delete(sessionId);

  if (isConfigured && db) {
    try {
      const ref = doc(db, CHATS_COLLECTION, sessionId);
      await deleteDoc(ref);
      return true;
    } catch (e) {
      console.error("[LiveChat] Failed to delete session from Firestore:", e);
      return false;
    }
  }
  return true;
}

