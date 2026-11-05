import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ failures: 0, lockedUntil: null as Date | null, writes: 0 }));

vi.mock("@/lib/auth", () => ({
  hashPassword: async () => "dummy",
  verifyPassword: async (password: string) => password === "correct",
  setSessionCookie: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { findUnique: async () => ({ id: "existing-id", username: "admin", passwordHash: "hash", active: true, lockedUntil: state.lockedUntil, email: "contact@example.com", name: "Admin", role: "SUPER_ADMIN" }) },
  $queryRaw: async () => {
    state.writes++;
    state.failures++;
    if (state.failures >= 10) state.lockedUntil = new Date(Date.now() + 15 * 60_000);
    return [{ failedLoginAttempts: state.failures, lockedUntil: state.lockedUntil }];
  },
  $executeRaw: async () => { state.failures = 0; state.lockedUntil = null; return 1; },
  auditLog: { create: vi.fn() },
} }));
vi.mock("@/lib/request-limits", () => ({
  clientKey: () => "local",
  consumeLimit: async () => true,
  readBounded: async (request: Request) => Buffer.from(await request.text()),
}));
vi.mock("@/lib/security-policy", () => ({ sameOriginMutation: () => true }));
vi.mock("@/lib/security-events", () => ({ securityEvent: vi.fn() }));

import { login } from "./login-handler";

function request(password: string, username = "admin") {
  return new NextRequest("http://localhost:3000/api/admin/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
  });
}

describe("admin login", () => {
  beforeEach(() => { state.failures = 0; state.lockedUntil = null; state.writes = 0; });

  it("blocks after exactly ten failed passwords and accepts a correct password after expiry", async () => {
    for (let attempt = 1; attempt <= 9; attempt++) expect((await login(request("wrong"))).status).toBe(401);
    const tenth = await login(request("wrong"));
    expect(tenth.status).toBe(429);
    expect(Number(tenth.headers.get("Retry-After"))).toBeGreaterThanOrEqual(899);
    expect((await login(request("correct"))).status).toBe(429);
    expect(state.writes).toBe(10);

    state.lockedUntil = new Date(Date.now() - 1000);
    expect((await login(request("correct"))).status).toBe(200);
    expect(state.failures).toBe(0);
  });

  it("does not accept an email address as a login", async () => {
    expect((await login(request("correct", "admin@example.com"))).status).toBe(401);
    expect(state.writes).toBe(0);
  });

  it("clears failed attempts after a valid login", async () => {
    expect((await login(request("wrong"))).status).toBe(401);
    expect((await login(request("correct"))).status).toBe(200);
    expect(state.failures).toBe(0);
    expect((await login(request("wrong"))).status).toBe(401);
    expect(state.failures).toBe(1);
  });
});
