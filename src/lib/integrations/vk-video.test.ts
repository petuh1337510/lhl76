import { describe, expect, it } from "vitest";
import { normalizeVkVideos } from "./vk-video";

describe("VK Видео", () => {
  it("отличает прямой эфир от записи и выбирает крупную обложку", () => {
    const items = normalizeVkVideos([
      { id: 42, owner_id: -123, title: "Матч ЛХЛ-76", live: 1, date: 1000, image: [
        { url: "https://example.com/small.jpg", width: 320 },
        { url: "https://example.com/large.jpg", width: 1280 },
      ] },
      { id: 43, owner_id: -123, title: "Запись матча", date: 900 },
      { id: 44, owner_id: -123, title: "Будущий эфир", upcoming: 1 },
    ]);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      isLive: false,
      videoUrl: "https://vkvideo.ru/video-123_42",
      imageUrl: "https://example.com/large.jpg",
    });
    expect(items[2].startsAt).toBeNull();
    expect(items[1]).toMatchObject({ isLive: false, videoUrl: "https://vkvideo.ru/video-123_43" });
  });
});
