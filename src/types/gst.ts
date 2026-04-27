export type MatchType = "exact_hsn" | "prefix" | "chapter_prefix" | "description_keyword" | "fuzzy" | "not_found";

export interface HsnRecord {
  code: string;
  description: string;
  type?: string;
  category?: string;
  raw?: Record<string, unknown>;
}

export interface GstRateRow {
  id: string;
  schedule?: string;
  serialNo?: string;
  heading?: string;
  description: string;
  cgst?: number;
  sgstUtgst?: number;
  igst?: number;
  rate?: number;
  compensationCess?: string;
  condition?: string;
  slab?: "below_1000" | "above_1000" | "none";
  sourceFile: "gstgoodsrates.pdf";
  rawText?: string;
}

export interface SearchRecord {
  hsn?: HsnRecord;
  gst?: GstRateRow;
  code?: string;
  description: string;
  keywords: string;
}

export interface RateBucket {
  rate?: number;
  cgst?: number;
  sgst_utgst?: number;
  igst?: number;
  schedule?: string;
  serial_no?: string;
  condition?: string;
  matched_heading?: string;
  description?: string;
  compensation_cess?: string;
}

export interface MatchedRateResponse {
  query: string;
  normalized_query: string;
  matched: true;
  match_type: Exclude<MatchType, "not_found">;
  confidence: number;
  hsn?: { code: string; description: string };
  gst: {
    below_1000: RateBucket;
    above_1000: RateBucket;
    selected_rate?: { rate: number; reason: string };
  };
  sources: Array<Record<string, string | undefined>>;
  disclaimer: string;
}

export interface NotFoundResponse {
  query: string;
  matched: false;
  match_type: "not_found";
  confidence: 0;
  message: string;
}

export type RateResponse = MatchedRateResponse | NotFoundResponse;
