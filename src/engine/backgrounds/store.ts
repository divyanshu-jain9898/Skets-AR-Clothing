/**
 * Tiny IndexedDB store for user pictures (custom backgrounds and the office
 * photo), so they survive reloads. Everything stays on the device.
 * Falls back to memory when IndexedDB is unavailable (private mode, sandbox).
 */
export interface StoredPicture {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
}

const DB = 'vastra-backgrounds';
const STORE = 'pictures';
const memory = new Map<string, StoredPicture>();
let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function listPictures(prefix: string): Promise<StoredPicture[]> {
  const all = (await tx<StoredPicture[]>('readonly', (s) => s.getAll())) ?? [...memory.values()];
  return all.filter((p) => p.id.startsWith(prefix)).sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPicture(id: string): Promise<StoredPicture | undefined> {
  return (await tx<StoredPicture>('readonly', (s) => s.get(id))) ?? memory.get(id);
}

export async function putPicture(p: StoredPicture) {
  memory.set(p.id, p);
  await tx('readwrite', (s) => s.put(p));
}

export async function deletePicture(id: string) {
  memory.delete(id);
  await tx('readwrite', (s) => s.delete(id));
}
