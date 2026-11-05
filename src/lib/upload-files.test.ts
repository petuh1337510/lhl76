import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeUploadKey, parseUploadFileName, readUploadFamilies, removeUploadFamily, safeUploadStem, uploadFamilyKey } from "./upload-files";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("uploaded file families", () => {
  it("groups an original image with its display and thumbnail files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lhl-upload-test-"));
    roots.push(root);
    const directory = path.join(root, "media");
    await mkdir(directory);
    const id = "123e4567-e89b-42d3-a456-426614174000";
    await writeFile(path.join(directory, `${id}-original-Фото-команды.jpg`), "original");
    await writeFile(path.join(directory, `${id}-display.webp`), "display");
    await writeFile(path.join(directory, `${id}-thumb.webp`), "thumb");

    const items = await readUploadFamilies(root);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: `media/${id}`, title: "Фото команды", type: "image", size: 8, totalBytes: 20 });
    expect(items[0].previewUrl).toContain(`${id}-thumb.webp`);
    expect(uploadFamilyKey(items[0].url)).toBe(items[0].key);
    expect(await removeUploadFamily(root, `media/${id}`)).toBe(true);
    expect(await readUploadFamilies(root)).toHaveLength(0);
  });

  it("rejects path traversal and ignores unrelated files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lhl-upload-test-"));
    roots.push(root);
    const directory = path.join(root, "documents");
    await mkdir(directory);
    const id = "123e4567-e89b-42d3-a456-426614174000";
    const file = path.join(directory, `${id}.pdf`);
    await writeFile(file, "document");
    expect(await removeUploadFamily(root, `documents/../../${id}`)).toBe(false);
    expect(normalizeUploadKey(`DOCUMENTS/${id.toUpperCase()}`)).toBe(`documents/${id}`);
    expect(await readFile(file, "utf8")).toBe("document");
    expect(parseUploadFileName("secret.env")).toBeNull();
    expect(uploadFamilyKey("/uploads/documents/../../secret.env")).toBeNull();
    expect(safeUploadStem("C:\\fakepath\\Протокол матча.pdf")).toBe("Протокол-матча");
    expect(uploadFamilyKey(`/uploads/documents/${encodeURIComponent(`${id}-original-Протокол-матча.pdf`)}`)).toBe(`documents/${id}`);
  });
});
