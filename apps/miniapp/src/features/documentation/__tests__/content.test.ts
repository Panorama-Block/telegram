import { describe, expect, test } from "vitest";
import {
  documentationCategories,
  INTERNAL_ARCHITECTURE_PATH,
  OFFICIAL_DOCS_BASE,
  technicalResources,
} from "@/features/documentation/content";

describe("documentation content map", () => {
  test("all category links contain title and href", () => {
    for (const category of documentationCategories) {
      expect(category.title.trim().length).toBeGreaterThan(0);
      expect(category.links.length).toBeGreaterThan(0);
      for (const link of category.links) {
        expect(link.title.trim().length).toBeGreaterThan(0);
        expect(link.href.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("official links start with docs domain", () => {
    for (const category of documentationCategories) {
      for (const link of category.links) {
        expect(link.href.startsWith(OFFICIAL_DOCS_BASE)).toBe(true);
      }
    }
  });

  test("technical resources include internal architecture path", () => {
    const architecture = technicalResources.find((resource) => resource.title === "Architecture Diagram");
    expect(architecture).toBeDefined();
    expect(architecture?.href).toBe(INTERNAL_ARCHITECTURE_PATH);
    expect(architecture?.external).toBe(false);
  });
});
