import { useEffect, useRef } from "react";
import api from "../api/axios";
import { localDB } from "../utils/localDB";
import toast from "react-hot-toast";

export default function useSyncQueue(online) {
  const syncingRef = useRef(false);
  const clearedRef = useRef(false);

  // Note: Do NOT clear the queue on mount — that would drop pending offline changes.
  // Stale items are handled gracefully during sync (4xx errors cause dequeue).
  useEffect(() => {
    if (clearedRef.current) return;
    clearedRef.current = true;
  }, []);

  useEffect(() => {
    if (!online || syncingRef.current) return;
    syncAll();
  }, [online]);

  const syncAll = async () => {
    syncingRef.current = true;
    const queue = await localDB.getQueue();
    if (!queue.length) {
      syncingRef.current = false;
      return;
    }

    let synced = 0;
    for (const item of queue) {
      try {
        const method = item.method.toLowerCase();
        if (method === "post") await api.post(item.url, item.data);
        if (method === "put") await api.put(item.url, item.data);
        if (method === "patch") await api.patch(item.url, item.data);
        if (method === "delete") await api.delete(item.url);
        if (item.qid) {
          await localDB.dequeue(item.qid);
        }
        synced++;
      } catch (err) {
        // Dequeue on 4xx errors (not found, forbidden, etc.) or network failure
        if (!err.response || err.response.status < 500) {
          await localDB.dequeue(item.qid);
        }
      }
    }
    if (synced > 0)
      toast.success(`Synced ${synced} offline change${synced > 1 ? "s" : ""}`);
    syncingRef.current = false;
  };

  return { syncAll };
}
