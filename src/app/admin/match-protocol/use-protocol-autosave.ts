"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveOverride = { status?: string; rosterEntryIds?: string[]; numberOverrides?: Record<string, string> };
type SavedProtocol = { updatedAt: string; score: { home: number; away: number } };
type SaveNotice = { response: SavedProtocol; latest: boolean; hasShootouts: boolean };

export function useProtocolAutosave(
  match: { id: string; updatedAt: string } | null,
  draft: string | null,
  blockedReason: string,
  onSaved: (notice: SaveNotice) => void,
) {
  const matchId = match?.id;
  const originalVersion = match?.updatedAt;
  const session = useRef<{ matchId: string; version: string; saved: string; failed: string | null; conflict: boolean } | null>(null);
  const inFlight = useRef(false);
  const current = useRef({ matchId, draft, blockedReason, onSaved });
  current.current = { matchId, draft, blockedReason, onSaved };

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);

  const saveNow = useCallback(async (override?: SaveOverride, onCommit?: () => void) => {
    const active = session.current;
    const original = current.current.draft;
    if (!active || !original || current.current.matchId !== active.matchId || inFlight.current || active.conflict || current.current.blockedReason) return false;
    const payload = { ...JSON.parse(original), ...override };
    const snapshot = JSON.stringify(payload);
    if (snapshot === active.saved) {
      onCommit?.();
      return true;
    }
    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/admin/match-protocol", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, expectedUpdatedAt: active.version }),
      });
      const data = await response.json();
      if (session.current !== active) return false;
      if (!response.ok) {
        active.failed = snapshot;
        active.conflict = response.status === 409;
        setConflict(active.conflict);
        setSaveError(data.error || "Не удалось сохранить протокол.");
        return false;
      }
      active.version = data.updatedAt;
      active.saved = snapshot;
      active.failed = null;
      setLastSaved(snapshot);
      onCommit?.();
      current.current.onSaved({ response: data, latest: current.current.draft === original, hasShootouts: payload.shootouts.length > 0 });
      return true;
    } catch {
      if (session.current === active) {
        active.failed = snapshot;
        setSaveError("Нет связи с сервером. Повторите сохранение.");
      }
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!draft || !matchId || !originalVersion) return;
    if (session.current?.matchId !== matchId) {
      session.current = { matchId, version: originalVersion, saved: draft, failed: null, conflict: false };
      setLastSaved(draft);
      setSaveError("");
      setConflict(false);
      return;
    }
    const active = session.current;
    if (saving || blockedReason || active.conflict || draft === active.saved || draft === active.failed) return;
    const timer = window.setTimeout(() => { void saveNow(); }, 450);
    return () => window.clearTimeout(timer);
  }, [draft, matchId, originalVersion, blockedReason, saving, saveNow]);

  const dirty = Boolean(lastSaved && draft !== lastSaved);
  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  return { saveNow, saving, dirty, saveError, conflict };
}
