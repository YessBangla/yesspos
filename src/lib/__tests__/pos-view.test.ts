import { describe, expect, it } from "vitest";
import {
  POS_BREAKPOINTS,
  TILE_MIN_WIDTH,
  gridColumns,
  sortProducts,
  type TileSize,
} from "../pos-view";

const SIZES: TileSize[] = ["small", "medium", "large"];

describe("POS product grid responsiveness", () => {
  for (const [name, viewport] of Object.entries(POS_BREAKPOINTS)) {
    for (const tile of SIZES) {
      it(`keeps ${tile} tiles expanded at ${name} (${viewport}px)`, () => {
        const { cols, tileWidth } = gridColumns(viewport, tile);
        // Tiles never shrink below their minimum: no collapsed slivers.
        expect(tileWidth).toBeGreaterThanOrEqual(TILE_MIN_WIDTH[tile] - 0.5);
        // And they always fill the row rather than leaving a single stretched tile.
        expect(cols).toBeGreaterThanOrEqual(1);
        expect(tileWidth).toBeLessThan(TILE_MIN_WIDTH[tile] * 2);
      });
    }
  }

  it("shows more columns as the screen widens", () => {
    const tablet = gridColumns(POS_BREAKPOINTS.tablet, "medium").cols;
    const wide = gridColumns(POS_BREAKPOINTS.wide, "medium").cols;
    expect(wide).toBeGreaterThan(tablet);
  });

  it("shows more columns for smaller tiles at the same width", () => {
    expect(gridColumns(POS_BREAKPOINTS.laptop, "small").cols).toBeGreaterThan(
      gridColumns(POS_BREAKPOINTS.laptop, "large").cols,
    );
  });
});

describe("sortProducts", () => {
  const rows = [
    { name_en: "Rice", price: 120, stock: 3 },
    { name_en: "Atta", price: 60, stock: 10 },
    { name_en: "Oil", price: 200, stock: 1 },
  ];

  it("sorts by name, price and stock", () => {
    expect(sortProducts(rows, "name").map((r) => r.name_en)).toEqual(["Atta", "Oil", "Rice"]);
    expect(sortProducts(rows, "price-asc").map((r) => r.price)).toEqual([60, 120, 200]);
    expect(sortProducts(rows, "price-desc").map((r) => r.price)).toEqual([200, 120, 60]);
    expect(sortProducts(rows, "stock-desc").map((r) => r.stock)).toEqual([10, 3, 1]);
  });
});
