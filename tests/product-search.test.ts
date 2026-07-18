import { describe, expect, it } from "vitest";
import { matchesProductSearch, type SearchableProduct } from "../lib/product-search";

const naruto: SearchableProduct = {
  sku: "EAKI1045",
  nameZh: "火影忍者-疾风传双闪徽章 Vol.2",
  nameEn: "Naruto Badge Vol. 2",
  ipZh: "火影忍者",
  ipEn: "Naruto",
  aliases: ["Naruto Shippuden", "鸣人"],
};

describe("bilingual product search", () => {
  it.each(["EAKI1045", "火影", "忍者", "Naruto", "badge", "鸣人"])("matches %s", (query) => {
    expect(matchesProductSearch(naruto, query)).toBe(true);
  });
  it("does not match unrelated words", () => expect(matchesProductSearch(naruto, "芙莉莲")).toBe(false));
});
