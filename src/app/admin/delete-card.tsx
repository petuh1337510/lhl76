"use client";

import { useState } from "react";
import { AdminModal } from "./admin-modal";

export function DeleteCard({ kind, id, name, updatedAt }: { kind: "player" | "team"; id: string; name: string; updatedAt: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = kind === "player" ? "Удалить игрока" : "Удалить команду";

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/${kind}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, expectedUpdatedAt: updatedAt, confirmed: true }),
      });
      if (response.ok) { window.location.assign(kind === "player" ? "/admin/players" : "/admin/teams"); return; }
      const result = await response.json();
      setError(result.error || "Не удалось удалить карточку.");
    } catch {
      setError("Не удалось удалить карточку. Попробуйте ещё раз.");
    }
    setBusy(false);
  }

  return <div className="adminCardDelete">
    <button type="button" onClick={() => { setError(""); setOpen(true); }}>{title}</button>
    {open && <AdminModal title={title} onClose={() => { if (!busy) setOpen(false); }}>
      <section className="adminForm">
        <h2>{title}</h2>
        <p>Карточка «{name}» будет скрыта из списка и с публичного сайта. {kind === "player"
          ? "Игрок исчезнет из заявок, доступных для редактирования. Записи о сыгранных матчах сохранятся."
          : "Удалить можно только команду без привязки к соревнованиям."}</p>
        {error && <p className="formError" role="alert">{error}</p>}
        <footer>
          <button type="button" disabled={busy} onClick={() => setOpen(false)}>Отмена</button>
          <button type="button" disabled={busy} onClick={remove}>{busy ? "Удаляю…" : title}</button>
        </footer>
      </section>
    </AdminModal>}
  </div>;
}
