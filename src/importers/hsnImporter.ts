import XLSX from "xlsx";
import { HsnRecord } from "../types/gst.js";
import { digitsOnly, normalizeWhitespace } from "../utils/text.js";

const CODE_KEYS = ["hsn", "hsn code", "code", "tariff item", "heading"];
const DESCRIPTION_KEYS = ["description", "description of goods", "goods", "name", "commodity"];
const TYPE_KEYS = ["type", "category", "sac/hsn", "service/goods"];

function pickValue(row: Record<string, unknown>, candidates: string[]): string | undefined {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const found = entries.find(([key]) => key.toLowerCase().trim() === candidate);
    if (found?.[1] !== undefined && found[1] !== null) return String(found[1]);
  }
  for (const candidate of candidates) {
    const found = entries.find(([key]) => key.toLowerCase().includes(candidate));
    if (found?.[1] !== undefined && found[1] !== null) return String(found[1]);
  }
  return undefined;
}

export function parseHsnWorkbook(filePath: string): HsnRecord[] {
  const workbook = XLSX.readFile(filePath);
  const records: HsnRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    for (const row of rows) {
      const code = digitsOnly(String(pickValue(row, CODE_KEYS) ?? ""));
      const description = normalizeWhitespace(String(pickValue(row, DESCRIPTION_KEYS) ?? ""));
      if (!code || !description) continue;
      records.push({
        code,
        description,
        type: normalizeWhitespace(String(pickValue(row, TYPE_KEYS) ?? "")) || undefined,
        category: sheetName,
        raw: row
      });
    }
  }

  const deduped = new Map<string, HsnRecord>();
  for (const record of records) {
    const existing = deduped.get(record.code);
    if (!existing || record.description.length > existing.description.length) deduped.set(record.code, record);
  }
  return [...deduped.values()].sort((a, b) => a.code.localeCompare(b.code));
}
