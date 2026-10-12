import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  setDoc,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";

/** One tiny data layer for the whole management system.
 *  - Firebase configured → Firestore (shared between all staff, behind login).
 *  - Not configured yet → the browser's localStorage ("demo mode"), so the
 *    full system can be tried before Firebase is wired up. Demo data lives
 *    on that one device only. */
export const demoMode = !firebaseEnabled;

const LS_PREFIX = "masterdigital:";

function lsRead<T>(col: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LS_PREFIX + col) || "{}");
  } catch {
    return {};
  }
}
function lsWrite<T>(col: string, data: Record<string, T>) {
  window.localStorage.setItem(LS_PREFIX + col, JSON.stringify(data));
}

/* ---------- Reading: from the device's copy first, then the server ---------- */

let cacheOnly = false;

/** Runs `fn` with every read answered from the copy saved on this device —
 *  instant, no network. Used to show the admin straight away; a normal
 *  (server) load follows and replaces it. */
export async function fromDeviceCache<T>(fn: () => Promise<T>): Promise<T> {
  cacheOnly = true;
  try {
    return await fn();
  } finally {
    cacheOnly = false;
  }
}

export function fetchDocs<T>(q: Query<T>): Promise<QuerySnapshot<T>> {
  return cacheOnly ? getDocsFromCache(q) : getDocs(q);
}

export function fetchDoc<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  return cacheOnly ? getDocFromCache(ref) : getDoc(ref);
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function listDocs<T extends { id: string }>(col: string): Promise<T[]> {
  if (demoMode || !db) {
    return Object.entries(lsRead<Omit<T, "id">>(col)).map(([id, d]) => ({ ...(d as object), id } as T));
  }
  const snap = await fetchDocs(collection(db, col));
  return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as T));
}

export async function readDoc<T>(col: string, id: string): Promise<T | null> {
  if (demoMode || !db) return (lsRead<T>(col)[id] as T) ?? null;
  try {
    const snap = await fetchDoc(doc(db, col, id));
    return snap.exists() ? (snap.data() as T) : null;
  } catch (e) {
    if (cacheOnly) return null; // not on this device yet
    throw e;
  }
}

/** Creates or fully replaces a document. Returns the saved record with its id. */
export async function saveDoc<T extends { id: string }>(col: string, record: T): Promise<T> {
  const { id, ...data } = record;
  // Firestore rejects `undefined` values — drop them.
  const clean = JSON.parse(JSON.stringify(data));
  if (demoMode || !db) {
    const all = lsRead<object>(col);
    all[id] = clean;
    lsWrite(col, all);
  } else {
    await setDoc(doc(db, col, id), clean);
  }
  return record;
}

export async function removeDoc(col: string, id: string): Promise<void> {
  if (demoMode || !db) {
    const all = lsRead<object>(col);
    delete all[id];
    lsWrite(col, all);
    return;
  }
  await deleteDoc(doc(db, col, id));
}
