import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

const mocks = vi.hoisted(() => ({ session: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ currentSession: mocks.session, resolveSession: mocks.session, AUTH_COOKIE: "test-session" }));
vi.mock("@/lib/prisma", () => ({ prisma: { auditLog: { create: mocks.audit } } }));
import { config } from "@/middleware";
import { withAdmin } from "./admin-guard";

describe("uploads without middleware body cloning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ userId: "admin", role: "ADMIN" });
    mocks.audit.mockResolvedValue({});
  });

  it("skips only the upload endpoint, retaining middleware on other admin routes", () => {
    for (const url of ["/api/admin/upload", "/api/admin/upload/", "/api/admin/upload?kind=teams"]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
    for (const url of ["/admin", "/admin/team", "/api/admin/team", "/api/admin/upload-extra", "/api/admin/upload/nested"]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
  });

  const request = (headers: Record<string, string> = {}) => new NextRequest("https://lhl-76.ru/api/admin/upload", {
    method: "POST", body: "test", headers: { origin: "https://lhl-76.ru", ...headers },
  });

  it.each(["anonymous", "secretary", "cross-origin", "oversized"])("still rejects %s uploads before the handler", async (scenario) => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    if (scenario === "anonymous") mocks.session.mockResolvedValue(null);
    if (scenario === "secretary") mocks.session.mockResolvedValue({ userId: "secretary", role: "SECRETARY" });
    const headers: Record<string, string> = scenario === "cross-origin" ? { origin: "https://other.invalid" }
      : scenario === "oversized" ? { "content-length": String(152 * 1024 * 1024) } : {};
    const response = await withAdmin(handler)(request(headers));
    expect(response.status).toBe(scenario === "anonymous" ? 401 : scenario === "oversized" ? 413 : 403);
    expect(handler).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("preserves the full multipart upload above 10 MB and audits success", async () => {
    const bytes = new Uint8Array(11 * 1024 * 1024).fill(42);
    const form = new FormData();
    form.set("file", new File([bytes], "large.png", { type: "image/png" }));
    form.set("kind", "teams");
    const handler = vi.fn(async (req: NextRequest) => {
      const uploaded = (await req.formData()).get("file") as File;
      expect(uploaded.size).toBe(bytes.length);
      expect(Buffer.from(await uploaded.arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);
      return Response.json({ ok: true });
    });
    const response = await withAdmin(handler)(new NextRequest("https://lhl-76.ru/api/admin/upload", {
      method: "POST", body: form, headers: { origin: "https://lhl-76.ru" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });
});
