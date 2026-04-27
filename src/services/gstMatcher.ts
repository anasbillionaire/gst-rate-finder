import type { FuseResult } from "fuse.js";
import { loadGstRows, loadHsnRecords, loadSearchRecords } from "./dataStore.js";
import { FuzzySearchService } from "./fuzzySearch.js";
import { GstRateRow, HsnRecord, MatchType, RateBucket, RateCandidate, RateCondition, RateResponse, SearchRecord } from "../types/gst.js";
import { digitsOnly, normalizeQuery, uniqueBy } from "../utils/text.js";

const DISCLAIMER = "GST rates are based on parsed official files supplied by the user. Verify with CBIC notifications before legal filing.";

function toBucket(row: GstRateRow): RateBucket {
  return {
    rate: row.rate,
    cgst: row.cgst,
    sgst_utgst: row.sgstUtgst,
    igst: row.igst,
    schedule: row.schedule,
    serial_no: row.serialNo,
    condition: row.condition,
    matched_heading: row.heading,
    description: row.description,
    compensation_cess: row.compensationCess
  };
}

function parseMoney(text: string): number | undefined {
  const normalized = text.replace(/,/g, "");
  const match = normalized.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function parseRateCondition(row: GstRateRow): RateCondition {
  const text = `${row.condition || ""} ${row.description || ""} ${row.rawText || ""}`.toLowerCase();
  const value = parseMoney(text);
  const unit: RateCondition["unit"] = /piece|unit|item/.test(text) ? "piece" : "unknown";
  if (/not\s+exceeding|does\s+not\s+exceed|not\s+more\s+than|up\s*to|upto|below\s+or\s+equal|at\s+or\s+below/.test(text)) {
    return { kind: "lte", value, unit, text: row.condition };
  }
  if (/less\s+than|below/.test(text)) return { kind: "lt", value, unit, text: row.condition };
  if (/exceeding|more\s+than|above|greater\s+than/.test(text)) return { kind: "gt", value, unit, text: row.condition };
  if (/at\s+least|not\s+less\s+than/.test(text)) return { kind: "gte", value, unit, text: row.condition };
  if (row.slab === "below_1000") return { kind: "lte", value: 1000, unit, text: row.condition };
  if (row.slab === "above_1000") return { kind: "gt", value: 1000, unit, text: row.condition };
  return row.condition ? { kind: "unknown", value, unit, text: row.condition } : { kind: "none", unit };
}

function toCandidate(row: GstRateRow): RateCandidate {
  return {
    ...toBucket(row),
    condition_parsed: parseRateCondition(row),
    source_file: row.sourceFile
  };
}

function prefixCandidates(code: string): string[] {
  const candidates: string[] = [];
  for (let len = code.length; len >= 2; len--) candidates.push(code.slice(0, len));
  return candidates;
}

function chooseRateRows(rows: GstRateRow[]): { below?: GstRateRow; above?: GstRateRow } {
  const valid = rows.filter((row) => row.rate !== undefined);
  const below = valid.find((row) => row.slab === "below_1000");
  const above = valid.find((row) => row.slab === "above_1000");
  const single = valid.find((row) => row.slab === "none") ?? valid[0];
  return { below: below ?? single, above: above ?? single };
}

function conditionMatchesPrice(condition: RateCondition, price: number): boolean {
  if (condition.value === undefined) return condition.kind === "none" || condition.kind === "unknown";
  if (condition.kind === "lte") return price <= condition.value;
  if (condition.kind === "lt") return price < condition.value;
  if (condition.kind === "gte") return price >= condition.value;
  if (condition.kind === "gt") return price > condition.value;
  return false;
}

function thresholdSpecificity(condition: RateCondition): number {
  if (condition.value === undefined) return 0;
  if (condition.kind === "gt" || condition.kind === "gte") return 100000000 + condition.value;
  if (condition.kind === "lt" || condition.kind === "lte") return 100000000 - condition.value;
  return condition.value;
}

function chooseCandidateForPrice(rows: GstRateRow[], price?: number): { candidate?: GstRateRow; reason?: string; needsSelection: boolean } {
  const valid = rows.filter((row) => row.rate !== undefined);
  if (!valid.length) return { needsSelection: false };
  if (price === undefined) return { needsSelection: valid.length > 1 };
  const hasStructuredThresholds = valid.some((row) => {
    const condition = parseRateCondition(row);
    return condition.value !== undefined && condition.kind !== "none" && condition.kind !== "unknown";
  });
  const scopedRows = hasStructuredThresholds ? valid.filter((row) => parseRateCondition(row).kind !== "none") : valid;
  const matching = scopedRows
    .filter((row) => conditionMatchesPrice(parseRateCondition(row), price))
    .sort((a, b) => thresholdSpecificity(parseRateCondition(b)) - thresholdSpecificity(parseRateCondition(a)));
  const candidate = matching[0] ?? (valid.length === 1 ? valid[0] : undefined);
  if (!candidate) return { needsSelection: true };
  const selectedSignature = `${candidate.rate}-${candidate.condition}-${candidate.heading}`;
  const competingSelections = uniqueBy(matching, (row) => `${row.rate}-${row.condition}-${row.heading}`)
    .filter((row) => `${row.rate}-${row.condition}-${row.heading}` !== selectedSignature);
  const condition = parseRateCondition(candidate);
  const valueText = condition.value === undefined ? "" : ` Rs. ${condition.value}`;
  const reason = condition.kind === "none"
    ? "single GST rate row applies"
    : `price ${price} matched ${condition.kind}${valueText} condition`;
  return { candidate, reason, needsSelection: competingSelections.length > 0 };
}

function candidateRows(rows: GstRateRow[]): GstRateRow[] {
  const valid = rows.filter((row) => row.rate !== undefined);
  const hasStructuredThresholds = valid.some((row) => {
    const condition = parseRateCondition(row);
    return condition.value !== undefined && condition.kind !== "none" && condition.kind !== "unknown";
  });
  const scoped = hasStructuredThresholds ? valid.filter((row) => parseRateCondition(row).kind !== "none") : valid;
  return uniqueBy(scoped, (row) => `${row.heading}-${row.rate}-${row.condition}-${row.schedule}-${row.serialNo}`);
}

function notFound(query: string): RateResponse {
  return {
    query,
    matched: false,
    match_type: "not_found",
    confidence: 0,
    message: "No matching GST rate found in uploaded official files. Please verify from CBIC."
  };
}

function sourceList(rows: GstRateRow[], hsn?: HsnRecord): Array<Record<string, string | undefined>> {
  const gstSources = rows.map((row) => ({ file: row.sourceFile, schedule: row.schedule, serial_no: row.serialNo }));
  return [...uniqueBy(gstSources, (source) => `${source.file}-${source.schedule}-${source.serial_no}`), ...(hsn ? [{ file: "HSN_SAC.xlsx" }] : [])];
}

export class GstMatcher {
  private hsnRecords: HsnRecord[];
  private gstRows: GstRateRow[];
  private searchRecords: SearchRecord[];
  private fuzzy: FuzzySearchService;

  constructor(overrides: { hsnRecords?: HsnRecord[]; gstRows?: GstRateRow[]; searchRecords?: SearchRecord[] } = {}) {
    this.hsnRecords = overrides.hsnRecords ?? loadHsnRecords();
    this.gstRows = overrides.gstRows ?? loadGstRows();
    this.searchRecords = overrides.searchRecords ?? loadSearchRecords();
    this.fuzzy = new FuzzySearchService(this.searchRecords);
  }

  search(query: string) {
    const normalized = normalizeQuery(query);
    const code = digitsOnly(query);
    return {
      query,
      normalized_query: normalized,
      hsn_matches: code ? this.hsnRecords.filter((record) => record.code === code) : [],
      gst_matches: code ? this.gstRows.filter((row) => row.heading && (code.startsWith(row.heading) || row.heading.startsWith(code))).slice(0, 10) : [],
      fuzzy_matches: this.fuzzy.search(normalized, 10).map((result) => ({
        score: result.score,
        code: result.item.code,
        description: result.item.description,
        hsn: result.item.hsn,
        gst: result.item.gst
      }))
    };
  }

  rate(query: string, price?: number): RateResponse {
    const normalized = normalizeQuery(query);
    const code = digitsOnly(query);
    const hsn = this.resolveHsn(code, normalized);
    const match = this.resolveGstRows(code, normalized, hsn);
    if (!match) return notFound(query);
    const chosen = chooseRateRows(match.rows);
    if (!chosen.below || !chosen.above) return notFound(query);
    const candidates = candidateRows(match.rows).map(toCandidate);
    const selected = chooseCandidateForPrice(match.rows, price);
    const selectedRate = selected.candidate
      ? { rate: selected.candidate.rate ?? 0, reason: selected.reason ?? "matched GST candidate", candidate: toCandidate(selected.candidate) }
      : undefined;
    return {
      query,
      normalized_query: code || normalized,
      matched: true,
      match_type: match.type,
      confidence: match.confidence,
      hsn: hsn ? { code: hsn.code, description: hsn.description } : undefined,
      gst: {
        below_1000: toBucket(chosen.below),
        above_1000: toBucket(chosen.above),
        slabs: candidates,
        candidates,
        needs_selection: selected.needsSelection,
        selected_rate: selectedRate
      },
      sources: sourceList(match.rows, hsn),
      disclaimer: DISCLAIMER
    };
  }

  private resolveHsn(code: string, normalized: string): HsnRecord | undefined {
    if (code) {
      if (code.length > 8) return undefined;
      const exact = this.hsnRecords.find((record) => record.code === code);
      if (exact) return exact;
      for (const prefix of prefixCandidates(code)) {
        const record = this.hsnRecords.find((candidate) => candidate.code === prefix || candidate.code.startsWith(prefix));
        if (record) return { ...record, code };
      }
    }
    const words = normalized.split(" ").filter((word) => word.length > 2);
    return this.hsnRecords.find((record) => {
      const description = record.description.toLowerCase();
      return words.every((word) => description.includes(word) || description.includes(`${word}s`) || description.includes(word.replace(/s$/, "")));
    });
  }

  private resolveGstRows(code: string, normalized: string, hsn?: HsnRecord): { rows: GstRateRow[]; type: Exclude<MatchType, "not_found">; confidence: number } | undefined {
    const lookupCode = code.length > 8 ? "" : code || hsn?.code || "";
    if (lookupCode) {
      const exact = this.gstRows.filter((row) => row.heading === lookupCode);
      if (exact.length) return { rows: exact, type: "exact_hsn", confidence: 1 };
      if (lookupCode.length >= 6) {
        const specificChildren = this.gstRows.filter((row) => row.heading?.startsWith(lookupCode));
        if (specificChildren.length) return { rows: specificChildren, type: "exact_hsn", confidence: 1 };
      }
      for (const prefix of prefixCandidates(lookupCode)) {
        const rows = this.gstRows.filter((row) => row.heading === prefix);
        if (rows.length) return { rows, type: prefix.length === 2 ? "chapter_prefix" : "prefix", confidence: prefix.length === 2 ? 0.98 : 0.99 };
      }
    }
    const words = normalized.split(" ").filter((word) => word.length > 2);
    if (words.length) {
      const keywordRows = this.gstRows.filter((row) => words.some((word) => row.description.toLowerCase().includes(word)));
      if (keywordRows.length) return { rows: keywordRows, type: "description_keyword", confidence: 0.72 };
    }
    const fuzzyResult = this.bestFuzzyGst(normalized, hsn);
    if (!fuzzyResult) return undefined;
    return { rows: [fuzzyResult.item.gst], type: "fuzzy", confidence: Math.max(0.55, Math.min(0.9, 1 - (fuzzyResult.score ?? 0.35))) };
  }

  private bestFuzzyGst(normalized: string, hsn?: HsnRecord): FuseResult<SearchRecord & { gst: GstRateRow }> | undefined {
    const result = this.fuzzy.search(hsn ? `${normalized} ${hsn.description}` : normalized, 20).find((hit) => hit.item.gst);
    if (!result?.item.gst) return undefined;
    return result as FuseResult<SearchRecord & { gst: GstRateRow }>;
  }
}
