# India GST Rate Finder API

Node.js + TypeScript API for finding India GST rates from user-supplied official files:

- `data/raw/HSN_SAC.xlsx`
- `data/raw/gstgoodsrates.pdf`

The API does not invent a default GST rate. It never defaults to 18% unless that rate exists in the parsed source data.

## Setup

```bash
npm install
npm run import:data
npm run dev
```

Open:

- Health: `http://localhost:3000/health`
- Docs: `http://localhost:3000/docs`

## Commands

```bash
npm run import:data
npm run dev
npm test
npm run build
```

## API Examples

```bash
curl http://localhost:3000/health
curl "http://localhost:3000/api/search?q=6204"
curl http://localhost:3000/api/rate/6204
curl -X POST http://localhost:3000/api/rate -H "Content-Type: application/json" -d "{\"query\":\"6204\",\"price\":1200}"
```

Example response for `6204` includes Chapter 62 apparel slabs:

- below/equal Rs. 1000: 5% GST
- above Rs. 1000: 12% GST

## Matching Order

1. Exact HSN match
2. Longest prefix match
3. Chapter prefix match
4. Description keyword match
5. Fuse.js fuzzy match
6. `not_found`

If no source-backed match is found, the API returns `not_found`; it does not guess.

## Data Import

`npm run import:data` reads the raw files and writes:

- `data/generated/hsn.json`
- `data/generated/gst-rates.json`
- `data/generated/search-index.json`
- `data/generated/gst-raw-rows.json`

Raw parsed PDF rows are stored for debugging because PDF tables can extract messily.

## Docker

```bash
docker build -t india-gst-rate-finder-api .
docker run --rm -p 3000:3000 india-gst-rate-finder-api
```

## Legal Disclaimer

GST rates are based on parsed official files supplied by the user. Verify with CBIC notifications before legal filing.
