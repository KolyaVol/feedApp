import { useCallback, useEffect, useState } from "react";
import type { BestPracticesData } from "../types";
import { fetchBestPractices } from "../remoteFeed/bestPractices";

export function useBestPractices() {
  const [data, setData] = useState<BestPracticesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    const result = await fetchBestPractices(force);
    setData(result.data);
    if (!result.ok) setError(result.text);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const forceRefresh = useCallback(() => load(true), [load]);

  return { data, loading, error, refresh: forceRefresh };
}
