import { useCallback, useEffect, useRef, useState } from "react";
import api from "./api.js";

/** Refresh server-derived categories without allowing old requests to replace newer data. */
export default function useTaskData() {
  const [data, setData] = useState({ tasks: [], courses: [], evaluatedAt: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const currentRequest = useRef(null);

  const refresh = useCallback(async () => {
    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    setRefreshing(true);
    try {
      const options = { signal: controller.signal, timeout: 15000 };
      const [tasksRes, coursesRes] = await Promise.all([
        api.get("/tasks", options), api.get("/courses", options)
      ]);
      if (controller.signal.aborted) return;
      setData({ tasks: tasksRes.data.tasks, courses: coursesRes.data.courses,
        evaluatedAt: tasksRes.data.evaluated_at });
      setLoadError("");
    } catch (err) {
      if (controller.signal.aborted) return;
      setLoadError(err.response?.data?.error || "Gagal memperbarui daftar tugas. Data yang ditampilkan mungkin belum terbaru.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 60000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      currentRequest.current?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [refresh]);

  return { ...data, loading, refreshing, loadError, refresh };
}
