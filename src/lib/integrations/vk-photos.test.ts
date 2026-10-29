import { describe, expect, it } from "vitest";

import { parseVkAlbumSlug, parseVkAlbumUrl, vkAlbumSlug } from "./vk-photos";

describe("VK photo albums", () => {
  it("accepts only VK album links", () => {
    expect(parseVkAlbumUrl("https://vk.com/album-170455976_310217710"))
      .toEqual({ ownerId: -170455976, albumId: 310217710 });
    expect(parseVkAlbumUrl("https://vk.ru/album-170455976_313395065"))
      .toEqual({ ownerId: -170455976, albumId: 313395065 });
    expect(parseVkAlbumUrl("https://example.com/album-170455976_310217710")).toBeNull();
    expect(parseVkAlbumUrl("https://vk.com/id1")).toBeNull();
  });

  it("round-trips a community album slug", () => {
    expect(parseVkAlbumSlug(vkAlbumSlug(-170455976, 310217710)))
      .toEqual({ ownerId: -170455976, albumId: 310217710 });
    expect(parseVkAlbumSlug("match-photos")).toBeNull();
  });
});
