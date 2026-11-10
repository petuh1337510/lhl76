import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/admin-guard";
import { editVersion, nextEditVersion } from "@/lib/edit-version";
import { prisma } from "@/lib/prisma";

const input = z.object({ id: z.string().uuid(), expectedUpdatedAt: z.string().datetime(), confirmed: z.literal(true).optional() });

export function deleteAdminCard(kind: "player" | "team") {
  return withAdmin(async request => {
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Обновите карточку и повторите удаление." }, { status: 400 });
    if (kind === "player" && !parsed.data.confirmed)
      return NextResponse.json({ error: "Подтвердите удаление игрока в карточке." }, { status: 400 });
    const { id, expectedUpdatedAt } = parsed.data;
    const updatedAt = editVersion(expectedUpdatedAt);
    const record = { id, updatedAt, deletedAt: null };
    const data = { deletedAt: new Date(), updatedAt: nextEditVersion(updatedAt) };
    const result = await prisma.$transaction(async tx => {
      if (kind === "team") {
        await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${id} FOR UPDATE`;
        return tx.team.updateMany({ where: { ...record, entries: { none: {} } }, data });
      }
      await tx.$queryRaw`SELECT id FROM "Player" WHERE id = ${id} FOR UPDATE`;
      return tx.player.updateMany({ where: record, data });
    });
    if (!result.count) {
      const current = kind === "team" ? await prisma.team.findUnique({ where: { id }, select: { updatedAt: true, deletedAt: true } })
        : await prisma.player.findUnique({ where: { id }, select: { updatedAt: true, deletedAt: true } });
      if (!current || current.deletedAt) return NextResponse.json({ error: "Карточка уже удалена или не найдена." }, { status: 404 });
      const error = kind === "team" && current.updatedAt.getTime() === updatedAt.getTime()
        ? "Команда привязана к соревнованию."
        : "Карточка изменилась. Обновите страницу и повторите действие.";
      return NextResponse.json({ error }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  });
}
