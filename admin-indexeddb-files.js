// IndexedDB byte store for attachment payloads (net10.0-browser), used by
// IndexedDbFileStorage. Attachment bytes are far too big for the base64
// records the key-value store carries, so they live as Uint8Array values in
// their own object store of the shared "qingxu-admin" database.
const DB_NAME = "qingxu-admin";
const STORE = "files";

// Schema version shared with admin-indexeddb-store.js — version 2 added this
// store. Both modules register the whole schema in their upgrade handler so
// whichever one opens the database first leaves it complete; a module that
// only created its own store would leave the other one without its store.
const SCHEMA_VERSION = 2;

let dbPromise = null;

function openDb() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains("kv")) {
                    req.result.createObjectStore("kv");
                }
                if (!req.result.objectStoreNames.contains(STORE)) {
                    req.result.createObjectStore(STORE);
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

export async function put(key, bytes) {
    // The interop layer hands a .NET byte[] over as a Uint8Array; coerce
    // anything else so a plain array can never reach storage — the read path
    // (GetPropertyAsByteArray) only accepts a typed array.
    const record = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(record, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

export async function get(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        // null (not an empty record) when the key is gone: the interop
        // marshaler cannot return an array of bytes, so the payload travels
        // as a typed-array property of the returned object.
        req.onsuccess = () => resolve(req.result ? { bytes: req.result } : null);
        req.onerror = () => reject(req.error);
    });
}

export async function remove(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        // Whether anything was deleted is only knowable from the same
        // transaction that deletes it.
        const lookup = store.getKey(key);
        let existed = false;
        lookup.onsuccess = () => {
            existed = lookup.result !== undefined;
            store.delete(key);
        };
        lookup.onerror = () => reject(lookup.error);
        tx.oncomplete = () => resolve(existed);
        tx.onerror = () => reject(tx.error);
    });
}
