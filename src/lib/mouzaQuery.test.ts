import { describe, it, expect } from "vitest";
import {
  resolveMouzaName,
  resolveRowMouzaName,
  rowMatchesMouza,
  buildMouzaOptions,
  resolveMouzaAllNames,
  namesMatchMouza,
  LAND_MOUZA_FIELDS,
  LANDS_EMBED,
} from "./mouzaQuery";

describe("mouzaQuery shared helpers", () => {
  it("prefers the joined mouzas relation over the text column", () => {
    expect(resolveMouzaName({ mouza: "old", mouzas: { name: "চরপাড়া" } })).toBe("চরপাড়া");
  });

  it("falls back to the text column for legacy rows without a join", () => {
    expect(resolveMouzaName({ mouza: "বড়পাড়া", mouzas: null })).toBe("বড়পাড়া");
  });

  it("handles the array form of the embed", () => {
    expect(resolveMouzaName({ mouza: "x", mouzas: [{ name: "নদীপাড়া" }] })).toBe("নদীপাড়া");
  });

  it("returns empty string when nothing resolves", () => {
    expect(resolveMouzaName(null)).toBe("");
    expect(resolveMouzaName({})).toBe("");
  });

  it("resolves mouza from a row that embeds a land", () => {
    expect(resolveRowMouzaName({ lands: { mouza: "x", mouzas: { name: "ধানক্ষেত" } } })).toBe("ধানক্ষেত");
  });

  it("matches mouza filter and treats 'all'/empty as wildcard", () => {
    const row = { lands: { mouzas: { name: "চরপাড়া" } } };
    expect(rowMatchesMouza(row, "all")).toBe(true);
    expect(rowMatchesMouza(row, "")).toBe(true);
    expect(rowMatchesMouza(row, "চরপাড়া")).toBe(true);
    expect(rowMatchesMouza(row, "বড়পাড়া")).toBe(false);
  });

  it("builds sorted unique mouza options", () => {
    const rows = [
      { lands: { mouzas: { name: "বড়পাড়া" } } },
      { lands: { mouzas: { name: "চরপাড়া" } } },
      { lands: { mouza: "বড়পাড়া" } },
      { lands: {} },
    ];
    const opts = buildMouzaOptions(rows, resolveRowMouzaName);
    expect(opts).toEqual(["চরপাড়া", "বড়পাড়া"].sort((a, b) => a.localeCompare(b, "bn")));
    expect(opts).toHaveLength(2);
  });

  it("exposes a stable embed fragment used by every module", () => {
    expect(LAND_MOUZA_FIELDS).toContain("mouzas(name_bn,name)");
    expect(LANDS_EMBED).toBe("lands(dag_no,land_size,mouza,notes,mouzas(name_bn,name))");
  });

  it("prefers the Bengali mouza name from the relation", () => {
    const row = { lands: { mouza: "text-fallback", mouzas: { name: "English", name_bn: "বাংলা" } } };
    expect(resolveRowMouzaName(row)).toBe("বাংলা");
  });


  it("resolves mouza on Laravel/MySQL where mouzas(name) is unavailable (text fallback)", () => {
    // On the VPS backend the mouzas(name) embed is dropped, so rows arrive with
    // only the `mouza` text column and no `mouzas` relation. The fallback must
    // still surface the correct name.
    const laravelRow = { lands: { mouza: "চরপাড়া" } }; // no `mouzas` key at all
    expect(resolveRowMouzaName(laravelRow)).toBe("চরপাড়া");
    expect(rowMatchesMouza(laravelRow, "চরপাড়া")).toBe(true);

    const rows = [
      { lands: { mouza: "বড়পাড়া" } },
      { lands: { mouza: "চরপাড়া" } },
      { lands: { mouza: "চরপাড়া" } },
    ];
    expect(buildMouzaOptions(rows, resolveRowMouzaName)).toHaveLength(2);
});

describe("mouza filter helpers (name / name_bn / text variants)", () => {
  it("collects all unique name variants from a land relation", () => {
    const land = { mouza: "কোচলাপাড়া", mouzas: { name: "Kochlapara", name_bn: "কোচলাপাড়া" } };
    const names = resolveMouzaAllNames(land);
    expect(names).toContain("কোচলাপাড়া");
    expect(names).toContain("Kochlapara");
    expect(new Set(names).size).toBe(names.length); // de-duped
  });

  it("returns the text fallback variant when no relation exists", () => {
    expect(resolveMouzaAllNames({ mouza: "কোচলাপাড়া" })).toEqual(["কোচলাপাড়া"]);
    expect(resolveMouzaAllNames(null)).toEqual([]);
    expect(resolveMouzaAllNames({})).toEqual([]);
  });

  it("matches when the filter equals the Bengali name (MouzaSelect emits name_bn)", () => {
    const names = resolveMouzaAllNames({ mouzas: { name: "Kochlapara", name_bn: "কোচলাপাড়া" } });
    expect(namesMatchMouza(names, "কোচলাপাড়া")).toBe(true);
  });

  it("matches when the filter equals the English name variant", () => {
    const names = resolveMouzaAllNames({ mouzas: { name: "Kochlapara", name_bn: "কোচলাপাড়া" } });
    expect(namesMatchMouza(names, "Kochlapara")).toBe(true);
    expect(namesMatchMouza(names, "kochlapara")).toBe(true); // case-insensitive
  });

  it("matches on the legacy text column variant only", () => {
    const names = resolveMouzaAllNames({ mouza: "কোচলাপাড়া" });
    expect(namesMatchMouza(names, "কোচলাপাড়া")).toBe(true);
  });

  it("treats 'all' and empty filter as a wildcard", () => {
    const names = resolveMouzaAllNames({ mouzas: { name_bn: "কোচলাপাড়া" } });
    expect(namesMatchMouza(names, "all")).toBe(true);
    expect(namesMatchMouza(names, "")).toBe(true);
    expect(namesMatchMouza([], "all")).toBe(true);
  });

  it("does not match an unrelated mouza filter", () => {
    const names = resolveMouzaAllNames({ mouzas: { name_bn: "কোচলাপাড়া" } });
    expect(namesMatchMouza(names, "চরপাড়া")).toBe(false);
    expect(namesMatchMouza([], "চরপাড়া")).toBe(false);
  });
});
});
