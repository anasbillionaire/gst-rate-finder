import Fuse from "fuse.js";
import { SearchRecord } from "../types/gst.js";

export class FuzzySearchService {
  private fuse: Fuse<SearchRecord>;

  constructor(records: SearchRecord[]) {
    this.fuse = new Fuse(records, {
      includeScore: true,
      threshold: 0.42,
      ignoreLocation: true,
      keys: [
        { name: "code", weight: 0.35 },
        { name: "description", weight: 0.4 },
        { name: "keywords", weight: 0.25 }
      ]
    });
  }

  search(query: string, limit = 10) {
    return this.fuse.search(query, { limit });
  }
}
