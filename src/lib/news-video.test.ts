import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { vkNewsVideo, newsVideoSource } from "./news-video";
import { parseVkNewsPreview, getVkNewsPreview } from "./vk-news-video";
const clip = "https://vk.ru/clip-170455976_456240126";
const html = '<iframe src="https://vk.com/video_ext.php?oid=-170455976&amp;id=456240126&amp;hash=abc"></iframe>';
afterEach(() => vi.unstubAllGlobals());
describe("VK clips in news", () => {
  it("normalizes clips on supported VK hosts and preserves vertical type", () => {
    expect(vkNewsVideo(clip + "?list=123")).toMatchObject({ clip: true, canonical: "https://vk.com/video-170455976_456240126" });
    expect(newsVideoSource(clip)).toMatchObject({ kind: "vk", clip: true });
    expect(newsVideoSource("/uploads/media/test.mp4")).toMatchObject({ kind: "file" });
    expect(newsVideoSource("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ kind: "embed" });
  });
  it("rejects lookalike hosts, arbitrary pages and unsafe schemes", () => {
    for (const url of ["https://vk.ru.evil.com/clip-1_2", "javascript:alert(1)", "https://evil.com/movie", "//evil.com/video.mp4", "https://vk.ru:8443/clip-1_2", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ"]) expect(newsVideoSource(url)).toBeNull();
  });
  it("uses only a matching official embed, with autoplay disabled and a trusted thumbnail", () => {
    expect(parseVkNewsPreview({ response: { html, thumbnail_url: "https://sun9.userapi.com/cover.jpg" } }, clip)).toEqual({ embedUrl: "https://vk.com/video_ext.php?oid=-170455976&id=456240126&hash=abc&autoplay=0", thumbnail: "https://sun9.userapi.com/cover.jpg" });
    expect(parseVkNewsPreview({ response: { html: html.replace("vk.com", "evil.com") } }, clip)).toBeNull();
    expect(parseVkNewsPreview({ response: { html: html.replace("456240126", "42") } }, clip)).toBeNull();
    expect(parseVkNewsPreview({ response: { html, thumbnail_url: "https://evil.com/image" } }, clip)?.thumbnail).toBeNull();
  });
  it("calls VK using the canonical video URL and handles unavailable clips", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { html } }) }); vi.stubGlobal("fetch", fetcher);
    expect(await getVkNewsPreview(clip)).not.toBeNull();
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("url")).toBe("https://vk.com/video-170455976_456240126");
    fetcher.mockRejectedValue(new Error("timeout")); expect(await getVkNewsPreview(clip)).toBeNull();
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ error: { error_code: 104 } }) }); expect(await getVkNewsPreview(clip)).toBeNull();
  });
});
