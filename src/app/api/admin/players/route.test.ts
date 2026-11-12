import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/admin-guard", () => ({ withAdmin: (handler: unknown) => handler }));
vi.mock("@/lib/prisma", () => ({ prisma: { player: db, $transaction: (queries: unknown[]) => Promise.all(queries) } }));
import { GET } from "./route";

const players = [
  { id: "target", lastName: "Иванов", firstName: "Александр", patronymic: "Сергеевич", deletedAt: null },
  { id: "other", lastName: "Иванов", firstName: "Пётр", patronymic: null, deletedAt: null },
  { id: "deleted", lastName: "Иванов", firstName: "Александр", patronymic: "Сергеевич", deletedAt: "2026-01-01" },
];
// Interpret Prisma's logical/string filters over fixtures, including deleted rows.
function matches(row: Record<string, unknown>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return value.every((clause: Record<string, any>) => matches(row, clause));
    if (key === "OR") return value.some((clause: Record<string, any>) => matches(row, clause));
    if (value && typeof value === "object" && "contains" in value) {
      return typeof row[key] === "string" && String(row[key]).toLocaleLowerCase("ru").includes(value.contains.toLocaleLowerCase("ru"));
    }
    return row[key] === value;
  });
}

describe("player registry name search", () => {
  it.each(["Иванов Александр", "Александр Иванов", "  иВаНоВ   алекс  серг  ", "Иванов Сергеевич"])("finds combined name: %s", async (search) => {
    db.count.mockImplementation(({ where }) => players.filter(row => matches(row, where)).length);
    db.findMany.mockImplementation(({ where, skip, take }) => players.filter(row => matches(row, where)).slice(skip, skip + take));
    const response = await GET(new NextRequest(`http://localhost/api/admin/players?search=${encodeURIComponent(search)}`));
    const data = await response.json();
    expect(data.items.map((row: { id: string }) => row.id)).toEqual(["target"]);
    expect(data.total).toBe(1);
    expect(data.pages).toBe(1);
  });
  it.each(["Иванов", "", "  "])("keeps surname-only and empty searches: %s", async (search) => {
    db.count.mockImplementation(({ where }) => players.filter(row => matches(row, where)).length);
    db.findMany.mockImplementation(({ where }) => players.filter(row => matches(row, where)));
    const response = await GET(new NextRequest(`http://localhost/api/admin/players?search=${encodeURIComponent(search)}`));
    expect((await response.json()).total).toBe(2);
  });
});
