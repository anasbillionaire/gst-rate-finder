import fs from "node:fs";
import { GstRateRow, HsnRecord, SearchRecord } from "../types/gst.js";
import { generatedGstPath, generatedHsnPath, generatedSearchPath } from "../utils/paths.js";

function readJson<T>(path: string, fallback: T): T {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, "utf8")) as T;
}

export function loadHsnRecords(): HsnRecord[] {
  return readJson<HsnRecord[]>(generatedHsnPath, []);
}

export function loadGstRows(): GstRateRow[] {
  return readJson<GstRateRow[]>(generatedGstPath, []);
}

export function loadSearchRecords(): SearchRecord[] {
  return readJson<SearchRecord[]>(generatedSearchPath, []);
}
