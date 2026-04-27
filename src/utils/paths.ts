import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, "..", "..");
export const dataRawDir = path.join(rootDir, "data", "raw");
export const dataGeneratedDir = path.join(rootDir, "data", "generated");
export const rawHsnPath = path.join(dataRawDir, "HSN_SAC.xlsx");
export const rawGstPdfPath = path.join(dataRawDir, "gstgoodsrates.pdf");
export const generatedHsnPath = path.join(dataGeneratedDir, "hsn.json");
export const generatedGstPath = path.join(dataGeneratedDir, "gst-rates.json");
export const generatedSearchPath = path.join(dataGeneratedDir, "search-index.json");
export const generatedRawPdfRowsPath = path.join(dataGeneratedDir, "gst-raw-rows.json");
