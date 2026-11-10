import { describe, expect, it } from "vitest";
import { moveLayer, placeImage, type EditorElement } from "./model";

const element = (id: string): EditorElement => ({
  id, type: "text", text: id, x: 0, y: 0, width: 100,
  fontSize: 20, bold: false, align: "left", color: "#000000",
  fontFamily: "sans-serif",
});

describe("image placement", () => {
  it("fits a landscape image without stretching", () => {
    expect(placeImage(1000, 500)).toEqual({ x: 320, y: 200, width: 640, height: 320 });
  });
  it("keeps smaller images at their natural size", () => {
    expect(placeImage(100, 100)).toEqual({ x: 590, y: 310, width: 100, height: 100 });
  });
  it("rejects invalid dimensions", () => {
    expect(() => placeImage(0, 500)).toThrow();
  });
});

describe("layer order", () => {
  const initial = [element("a"), element("b"), element("c")];
  it("moves an element one level toward the front", () => {
    expect(moveLayer(initial, "a", 1).map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(initial[0].id).toBe("a");
  });
  it("does not go past the edge", () => {
    expect(moveLayer(initial, "a", -1)).toBe(initial);
    expect(moveLayer(initial, "missing", 1)).toBe(initial);
  });
});
