import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth", () => ({ AUTH_COOKIE: "lhl76_admin", resolveSession: vi.fn() }));
vi.mock("@/lib/security-events", () => ({ securityEvent: vi.fn() }));
import { middleware } from "./middleware";
describe("VK album image policy", () => {
  it("allows direct VK photos without permitting arbitrary image hosts", async () => {
    for (const path of ["/media", "/media/vk-photo-170455976-313395065", "/admin/login"]) {
      const response = await middleware(new NextRequest(`https://lhl-76.ru${path}`));
      const policy = response.headers.get("Content-Security-Policy")!;
      const images = policy.split(";").find(part => part.trim().startsWith("img-src"))!.trim().split(/\s+/);
      expect(images).toContain("https://*.userapi.com");
      expect(images).toContain("https://*.vkuserphoto.ru");
      expect(images).not.toContain("*");
      expect(images).not.toContain("https:");
      expect(policy).toContain("object-src 'none'");
      expect(policy).toContain("script-src 'self' 'nonce-");
    }
  });
});
