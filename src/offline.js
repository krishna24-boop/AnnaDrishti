const DB_NAME = "annadrishti-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "diagnosisQueue";
const CACHE_STORE = "cache";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("इस ब्राउज़र में ऑफ़लाइन स्टोरेज उपलब्ध नहीं है।"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("ऑफ़लाइन स्टोरेज नहीं खुला।"));
  });
}

async function transact(storeName, mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("ऑफ़लाइन स्टोरेज में समस्या हुई।"));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("ऑफ़लाइन स्टोरेज में समस्या हुई।"));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("ऑफ़लाइन स्टोरेज में समस्या हुई।"));
    };
  });
}

export function enqueueDiagnosis(image, crop, farmer) {
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    image,
    crop,
    farmer,
    createdAt: new Date().toISOString(),
  };
  return transact(QUEUE_STORE, "readwrite", (store) => store.add(entry)).then(() => entry);
}

export async function getQueuedDiagnoses(farmerId) {
  const entries = await transact(QUEUE_STORE, "readonly", (store) => store.getAll());
  return entries
    .filter((entry) => entry.farmer?.phone === farmerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function removeQueuedDiagnosis(id) {
  return transact(QUEUE_STORE, "readwrite", (store) => store.delete(id));
}

export function saveOfflineCache(key, value) {
  return transact(CACHE_STORE, "readwrite", (store) => store.put({
    key,
    value,
    cachedAt: new Date().toISOString(),
  }));
}

export async function getOfflineCache(key) {
  return (await transact(CACHE_STORE, "readonly", (store) => store.get(key))) || null;
}
