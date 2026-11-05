import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAdmin } from "@/lib/admin-guard";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const fields = z.object({
  username: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{2,31}$/i).transform((value) => value.toLowerCase()),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "SECRETARY"]),
});
const select = { id: true, username: true, email: true, name: true, role: true, active: true, lockedUntil: true, createdAt: true } as const;

export const GET = withAdmin(async () => NextResponse.json({ items: await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select }) }));

export const POST = withAdmin(async (request: NextRequest) => {
  const result = fields.extend({ password: z.string().min(10).max(256) }).safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: "Проверьте логин (3–32 латинских символа, цифры, точка, дефис или подчёркивание), email, имя и пароль (10–256 символов)" }, { status: 400 });
  const { password, ...data } = result.data;
  try {
    return NextResponse.json({ item: await prisma.user.create({ data: { ...data, passwordHash: await hashPassword(password), active: true }, select }) });
  } catch {
    return NextResponse.json({ error: "Не удалось создать пользователя. Проверьте уникальность логина и email." }, { status: 409 });
  }
});

export const PATCH = withAdmin(async (request: NextRequest) => {
  const result = fields.extend({
    id: z.string().min(1).max(100),
    active: z.boolean(),
    password: z.union([z.literal(""), z.string().min(10).max(256)]).optional(),
    unlock: z.boolean().optional(),
  }).safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: "Проверьте логин, email, имя и длину пароля" }, { status: 400 });
  const { id, password, unlock, ...data } = result.data;
  try {
    return NextResponse.json({ item: await prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
        ...(password || unlock ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
      },
      select,
    }) });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить пользователя. Проверьте уникальность логина и email." }, { status: 409 });
  }
});
