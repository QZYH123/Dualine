import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "../lib/clipboard";

const COPIED_MS = 1600;

/** Copy text and show "copied" until the timer elapses. */
export function useCopiedFlag(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback((text: string) => {
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
    });
  }, []);

  return { copied, copy };
}
