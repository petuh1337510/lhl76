import { NextRequest, NextResponse } from "next/server";

import { normalizeUsername } from "@/lib/admin-username";
import { hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientKey, consumeLimit, readBounded } from "@/lib/request-limits";
import { securityEvent } from "@/lib/security-events";
import { sameOriginMutation } from "@/lib/security-policy";

const maxFailures = 10;
const lockMinutes = 15;
const dummy = hashPassword("not-a-real-user-password");
type FailedAttempt = { failedLoginAttempts: number; lockedUntil: Date | null };

function locked(until?: Date | null) {
  const seconds = Math.max(1, Math.ceil(((until?.getTime() ?? Date.now() + lockMinutes * 60_000) - Date.now()) / 1000));
  return NextResponse.json(
    { error: `После ${maxFailures} неверных попыток вход заблокирован на ${lockMinutes} минут.` },
    { status: 429, headers: { "Retry-After": String(seconds) } },
  );
}

export async function login(request: NextRequest) {
  if (!sameOriginMutation(request.headers.get("origin"), request.url, request.headers.get("sec-fetch-site"), request.headers.get("host"))) {
    return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  }
  try {
    if (!await consumeLimit(`login-ip:${clientKey(request)}`, 60, 300_000)) {
      return NextResponse.json({ error: "Слишком много запросов. Повторите позже." }, { status: 429, headers: { "Retry-After": "300" } });
    }
    const body = JSON.parse((await readBounded(request, 8192)).toString());
    const username = normalizeUsername(body.username);
    if (!username || typeof body.password !== "string" || !body.password || body.password.length > 256) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (user?.lockedUntil && user.lockedUntil > new Date()) return locked(user.lockedUntil);
    if (user?.lockedUntil) {
      await prisma.$executeRaw`UPDATE "User" SET "failedLoginAttempts" = 0, "lockedUntil" = NULL WHERE id = ${user.id} AND "lockedUntil" <= NOW()`;
    }
    const valid = await verifyPassword(body.password, user?.passwordHash ?? await dummy);
    if (!user?.active || !valid) {
      securityEvent("LOGIN_DENIED", "login");
      if (user?.active) {
        const attempts = await prisma.$queryRaw<FailedAttempt[]>`
          UPDATE "User"
          SET "failedLoginAttempts" = LEAST("failedLoginAttempts" + 1, ${maxFailures}),
              "lockedUntil" = CASE WHEN "failedLoginAttempts" + 1 >= ${maxFailures}
                THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
          WHERE id = ${user.id} AND ("lockedUntil" IS NULL OR "lockedUntil" <= NOW())
          RETURNING "failedLoginAttempts", "lockedUntil"`;
        if (!attempts.length || attempts[0].failedLoginAttempts >= maxFailures) return locked(attempts[0]?.lockedUntil);
      } else if (!await consumeLimit(`login-unknown:${username}`, maxFailures - 1, lockMinutes * 60_000)) {
        return locked();
      }
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const cleared = await prisma.$executeRaw`
      UPDATE "User" SET "failedLoginAttempts" = 0, "lockedUntil" = NULL
      WHERE id = ${user.id} AND ("lockedUntil" IS NULL OR "lockedUntil" <= NOW())`;
    if (!cleared) return locked();
    await setSessionCookie({ userId: user.id, email: user.email, name: user.name, role: user.role });
    await prisma.auditLog.create({ data: { userId: user.id, entityType: "auth", entityId: user.id, action: "LOGIN" } });
    return NextResponse.json({ ok: true, role: user.role });
  } catch (error) {
    console.error("Admin login failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Не удалось выполнить вход. Проверьте данные или повторите позже." }, { status: 400 });
  }
}
