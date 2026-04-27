import fs from "node:fs/promises";
import { parseGstPdf } from "./gstPdfImporter.js";
import { parseHsnWorkbook } from "./hsnImporter.js";
import { SearchRecord } from "../types/gst.js";
import { dataGeneratedDir, generatedGstPath, generatedHsnPath, generatedRawPdfRowsPath, generatedSearchPath, rawGstPdfPath, rawHsnPath } from "../utils/paths.js";

async function writeJson(path: string, data: unknown): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function importData(): Promise<void> {
  await fs.mkdir(dataGeneratedDir, { recursive: true });
  const hsn = parseHsnWorkbook(rawHsnPath);
  const gst = await parseGstPdf(rawGstPdfPath);
  const search: SearchRecord[] = [
    ...hsn.map((record) => ({ hsn: record, code: record.code, description: record.description, keywords: `${record.code} ${record.description} ${record.type ?? ""} ${record.category ?? ""}` })),
    ...gst.rows.map((row) => ({ gst: row, code: row.heading, description: row.description, keywords: `${row.heading ?? ""} ${row.description} ${row.condition ?? ""} ${row.schedule ?? ""} ${row.serialNo ?? ""}` }))
  ];
  await writeJson(generatedHsnPath, hsn);
  await writeJson(generatedGstPath, gst.rows);
  await writeJson(generatedRawPdfRowsPath, gst.rawRows);
  await writeJson(generatedSearchPath, search);
  console.log(`Imported ${hsn.length} HSN/SAC records`);
  console.log(`Imported ${gst.rows.length} GST rate rows`);
}

importData().catch((error) => {
  console.error(error);
  process.exit(1);
});
