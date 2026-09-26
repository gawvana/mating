/**
 * Lightweight IndexedDB persistent mutation queue for offline resilience.
 * Implements deterministic FIFO ordering, retry tracking, exponential backoff,
 * idempotency protection, and non-infinite failure handling.
 */

export interface QueuedMutation {
  id: string; // client_mutation_id (UUID)
  type: "create" | "batch_create" | "toggle" | "delete" | "restore";
  payload: any;
  timestamp: number;
  retryCount: number;
  status: "pending" | "processing" | "failed";
  lastError?: string;
}

export interface FlushResult {
  processedCount: number;
  failedCount: number;
  hasFailures: boolean;
}

const DB_NAME = "mating_offline_db";
const STORE_NAME = "mutation_queue";
const DB_VERSION = 1;

export const MAX_RETRIES = 3;
export const BASE_BACKOFF_MS = 400;
export const MAX_BACKOFF_MS = 6000;

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueMutation(
  item: Omit<QueuedMutation, "timestamp" | "retryCount" | "status"> & {
    id?: string;
    timestamp?: number;
    retryCount?: number;
    status?: "pending" | "processing" | "failed";
  }
): Promise<string> {
  const mutationId = item.id || generateUUID();
  const mutation: QueuedMutation = {
    id: mutationId,
    type: item.type,
    payload: item.payload,
    timestamp: item.timestamp ?? Date.now(),
    retryCount: item.retryCount ?? 0,
    status: item.status ?? "pending",
  };

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(mutation);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return mutationId;
  } catch (e) {
    console.warn("Failed to enqueue mutation in IndexedDB", e);
    return mutationId;
  }
}

/**
 * Returns pending mutations strictly sorted by FIFO timestamp (ascending).
 * Identical timestamps are tie-broken deterministically by mutation id.
 */
export async function getPendingMutations(): Promise<QueuedMutation[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const raw: QueuedMutation[] = request.result || [];
        // Only return mutations that are pending or haven't exceeded MAX_RETRIES
        const pending = raw.filter(
          (m) => m.status !== "failed" && (m.retryCount || 0) < MAX_RETRIES
        );
        // Deterministic FIFO sort
        pending.sort((a, b) => {
          if (a.timestamp !== b.timestamp) {
            return a.timestamp - b.timestamp;
          }
          return a.id.localeCompare(b.id);
        });
        resolve(pending);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function updateMutation(mutation: QueuedMutation): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(mutation);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Failed to update mutation in IndexedDB", mutation.id, e);
  }
}

export async function removeMutation(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore error
  }
}

export async function clearQueue(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore error
  }
}

/**
 * Core queue processor. Iterates through pending mutations in deterministic FIFO order,
 * handles all 5 mutation types, applies exponential backoff, checks online state,
 * and tracks retry counts without infinite loops.
 */
export async function flushOfflineQueue(apiClient: any): Promise<FlushResult> {
  const pending = await getPendingMutations();
  let processedCount = 0;
  let failedCount = 0;

  for (const item of pending) {
    // Abort replay immediately if network dropped mid-process
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      break;
    }

    try {
      await updateMutation({ ...item, status: "processing" });

      switch (item.type) {
        case "create": {
          const payload = {
            ...item.payload,
            // Preserve client_mutation_id for backend idempotency
            client_mutation_id: item.payload?.client_mutation_id || item.id,
          };
          await apiClient.createItem(payload);
          break;
        }

        case "batch_create": {
          const rawItems = Array.isArray(item.payload)
            ? item.payload
            : item.payload?.items || [];
          const itemsWithIds = rawItems.map((it: any) => ({
            ...it,
            client_mutation_id: it.client_mutation_id || generateUUID(),
          }));
          await apiClient.batchCreateItems(itemsWithIds);
          break;
        }

        case "toggle": {
          const id = item.payload?.id;
          const version = item.payload?.version ?? 1;
          if (!id) throw new Error("Toggle mutation missing item id");
          await apiClient.togglePurchased(id, version);
          break;
        }

        case "delete": {
          const id = typeof item.payload === "string" ? item.payload : item.payload?.id;
          if (!id) throw new Error("Delete mutation missing item id");
          await apiClient.deleteItem(id);
          break;
        }

        case "restore": {
          const id = typeof item.payload === "string" ? item.payload : item.payload?.id;
          if (!id) throw new Error("Restore mutation missing item id");
          await apiClient.restoreItem(id);
          break;
        }

        default:
          console.warn(`Unrecognized mutation type: ${(item as any).type}`);
      }

      // Success: dequeue mutation
      await removeMutation(item.id);
      processedCount++;
    } catch (err: any) {
      const statusCode = err?.statusCode || 0;
      const errorCode = err?.code || "";

      // 1. Conflict (409) or Not Found (404): State on server superseded or already deleted/restored.
      // Reconciled - remove immediately to prevent stuck loops.
      if (statusCode === 409 || errorCode === "VERSION_CONFLICT") {
        console.warn(`Replay: Version conflict on ${item.type} (${item.id}), reconciled:`, err);
        await removeMutation(item.id);
        processedCount++;
        continue;
      }

      if (statusCode === 404 || errorCode === "ITEM_NOT_FOUND" || errorCode === "NOT_FOUND") {
        console.warn(`Replay: Item not found for ${item.type} (${item.id}), reconciled:`, err);
        await removeMutation(item.id);
        processedCount++;
        continue;
      }

      // 2. Unrecoverable Validation Error (400, 422): invalid payload
      if (statusCode === 400 || statusCode === 422) {
        console.error(`Replay: Terminal validation error for ${item.type} (${item.id}):`, err);
        await removeMutation(item.id);
        failedCount++;
        continue;
      }

      // 3. Retryable error (Network outage, 5xx server errors)
      const nextRetry = (item.retryCount || 0) + 1;
      if (nextRetry >= MAX_RETRIES) {
        console.error(`Replay: Max retries (${MAX_RETRIES}) reached for ${item.id}. Marking failed.`);
        await updateMutation({
          ...item,
          retryCount: nextRetry,
          status: "failed",
          lastError: err?.message || String(err),
        });
        failedCount++;
      } else {
        console.warn(`Replay: Failed mutation ${item.id} (attempt ${nextRetry}/${MAX_RETRIES}):`, err);
        await updateMutation({
          ...item,
          retryCount: nextRetry,
          status: "pending",
          lastError: err?.message || String(err),
        });

        // Exponential backoff with jitter
        const backoff =
          Math.min(BASE_BACKOFF_MS * Math.pow(2, nextRetry - 1), MAX_BACKOFF_MS) +
          Math.floor(Math.random() * 150);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  return {
    processedCount,
    failedCount,
    hasFailures: failedCount > 0,
  };
}
