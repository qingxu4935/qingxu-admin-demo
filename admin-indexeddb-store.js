// IndexedDB key-value store used by IndexedDbBlobCache (net10.0-browser).
const DB_NAME = "qingxu-admin";
const STORE = "kv";

// Schema version shared with admin-indexeddb-files.js — version 2 added the
// attachment byte store. Both modules register the whole schema in their
// upgrade handler so whichever one opens the database first leaves it
// complete; a module that only created its own store would leave the other
// one without its store.
const SCHEMA_VERSION = 2;

let dbPromise = null;

function openDb() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(STORE)) {
                    req.result.createObjectStore(STORE);
                }
                if (!req.result.objectStoreNames.contains("files")) {
                    req.result.createObjectStore("files");
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => {
                // Do not cache a rejected promise forever — a transient failure
                // (quota, private mode) should be retried on the next call.
                dbPromise = null;
                reject(req.error);
            };
        });
    }
    return dbPromise;
}

export async function get(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? "");
        req.onerror = () => reject(req.error);
    });
}

export async function put(key, record) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(record, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

export async function deleteKey(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

export async function getKeys() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAllKeys();
        // JSON string: the JS interop marshaler supports string returns, not raw arrays.
        req.onsuccess = () => resolve(JSON.stringify(req.result));
        req.onerror = () => reject(req.error);
    });
}

export async function clear() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}
