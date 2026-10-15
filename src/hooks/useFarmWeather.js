import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Live weather for one farm, read from the provider on every call. A failure is returned as a
// failure so the screen can say so instead of showing a made-up figure.
export default function useFarmWeather(farmId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (id) => {
    if (!id) {
      setData(null);
      setError(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("farmWeather", { farm_id: id });
      const payload = response.data || {};
      if (payload.status === "ok") {
        setData(payload);
        return payload;
      }
      setData(null);
      setError({ code: payload.status || "error", message: payload.error });
      return null;
    } catch (err) {
      const payload = err && err.response ? err.response.data : null;
      setData(null);
      setError({
        code: (payload && payload.status) || "error",
        message: (payload && payload.error) || err.message,
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(farmId);
  }, [farmId, load]);

  const refresh = useCallback(() => load(farmId), [farmId, load]);

  return { data, loading, error, refresh };
}