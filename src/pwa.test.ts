import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "public", "manifest.webmanifest"), "utf8"));
const html = readFileSync(join(root, "index.html"), "utf8");

describe("installable app", () => {
  it("is a standalone app with relative paths, so it works under /somenail/", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    expect(manifest.name).toBeTruthy();
  });

  it("ships the 192px and 512px icons installability requires, and every icon file exists", () => {
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons) expect(existsSync(join(root, "public", icon.src)), icon.src).toBe(true);
  });

  it("links the manifest and has a service worker with a fetch handler", () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    const worker = readFileSync(join(root, "public", "sw.js"), "utf8");
    expect(worker).toContain('addEventListener("fetch"');
  });
});
