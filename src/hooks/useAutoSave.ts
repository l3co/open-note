import { useRef, useCallback, useEffect } from "react";
import type { JSONContent } from "@tiptap/react";

interface UseAutoSaveOptions {
  content: JSONContent | null;
  onSave: (content: JSONContent) => Promise<void>;
  delayMs?: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
  forceSave: () => Promise<void>;
}

export function useAutoSave({
  content,
  onSave,
  delayMs = 1000,
  enabled = true,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const lastSavedRef = useRef<Date | null>(null);
  const errorRef = useRef<string | null>(null);
  const pendingContentRef = useRef<JSONContent | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const doSave = useCallback(async (doc: JSONContent) => {
    savingRef.current = true;
    errorRef.current = null;
    try {
      await onSaveRef.current(doc);
      lastSavedRef.current = new Date();
      errorRef.current = null;
    } catch (err) {
      errorRef.current = err instanceof Error ? err.message : String(err);
    } finally {
      savingRef.current = false;
    }
  }, []);

  const forceSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const doc = pendingContentRef.current;
    if (doc) {
      pendingContentRef.current = null;
      await doSave(doc);
    }
  }, [doSave]);

  useEffect(() => {
    if (!enabled || !content) return;

    pendingContentRef.current = content;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const doc = pendingContentRef.current;
      if (doc) {
        pendingContentRef.current = null;
        doSave(doc);
      }
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, delayMs, enabled, doSave]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const doc = pendingContentRef.current;
      if (doc) {
        pendingContentRef.current = null;
        onSaveRef.current(doc).catch(() => {});
      }
    };
  }, []);

  return {
    isSaving: savingRef.current,
    lastSavedAt: lastSavedRef.current,
    error: errorRef.current,
    forceSave,
  };
}
