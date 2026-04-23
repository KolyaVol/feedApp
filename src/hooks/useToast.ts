import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastState<T> {
  value: T;
  id: number;
}

export function useToast<T>(
  durationMs = 2500,
): {
  toast: ToastState<T> | null;
  show: (value: T, duration?: number) => void;
  hide: () => void;
} {
  const [toast, setToast] = useState<ToastState<T> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const show = useCallback(
    (value: T, duration?: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      idRef.current += 1;
      const id = idRef.current;
      setToast({ value, id });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setToast((cur) => (cur && cur.id === id ? null : cur));
      }, duration ?? durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { toast, show, hide };
}
