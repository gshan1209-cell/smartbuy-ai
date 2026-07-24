---
name: smartbuy-agri-intelligence
description: Use when implementing or reviewing agriculture market data, county crops, weather risk, 24 solar terms, seasonal produce, price direction predictions, buying advice, or source freshness in SmartBuy AI. Do not use for generic UI work without agriculture data meaning.
---

# SmartBuy Agriculture Intelligence

## Purpose

Convert agriculture, weather, seasonal, market, and AI data into traceable, plain-language decisions without overstating certainty.

## Domain inputs

Possible inputs include:

- Ministry of Agriculture market or production data.
- Central Weather Administration observations and forecasts.
- Supabase recent market, member, favorite, notification, and mutual-aid data.
- Cloudflare R2 Parquet historical data.
- LightGBM next-trading-day direction output: down, flat, or up.
- 24 solar term rules, seasonal produce tables, and risk rules.

## Workflow

1. Read `/AGENT.md` and `/AGENTS.md`.
2. Define the user decision first: buy now, wait, compare, watch weather, manage supply, or publish an alert.
3. Inventory every required field and its real source.
4. For each source, define:
   - official owner
   - endpoint or storage location
   - update cadence
   - latest available timestamp
   - timeout and retry behavior
   - cache and stale policy
   - fallback behavior
5. Preserve source provenance through backend response and frontend presentation when practical.
6. Normalize location, date, market, product name, unit, and missing values before combining datasets.
7. Do not combine values with incompatible units or time windows.
8. Separate observed facts from derived rules and model predictions:
   - observed: official price, rainfall, temperature, production area
   - derived: weather risk score, seasonal recommendation, price status
   - predicted: LightGBM direction or other model output
9. Include confidence or limitation language appropriate to the result. A direction prediction is not a guaranteed future price.
10. Define user-facing states:
   - fresh official data
   - cached or stale data
   - static seed or maintained seasonal knowledge
   - demo data
   - unavailable
11. Translate outputs into plain language and a next action. Keep access to source date and supporting values.
12. Test boundary cases including missing county, unknown crop, no recent market day, API timeout, stale cache, and conflicting signals.
13. Use `smartbuy-api-change` for endpoint or schema changes and `smartbuy-quality-gate` before delivery.

## Agriculture-specific guardrails

- Do not present demo, static seed, cache, or model output as real-time official truth.
- Do not claim weather caused a price change unless the system only labels it as a risk or supported correlation.
- Do not infer a product is cheap from a single raw price without a defined comparison baseline.
- Do not erase source timestamps during aggregation.
- Do not silently replace an unavailable official source with unrelated sample data.
- Do not let a map become the only way to select a county.
- Seasonal recommendations must distinguish maintained knowledge rules from live market evidence.

## Recommended response metadata

Where relevant, return fields equivalent to:

```json
{
  "data_status": "official|cached|stale|static_seed|demo|unavailable",
  "source_name": "...",
  "source_updated_at": "...",
  "generated_at": "...",
  "method": "observed|rule|model",
  "confidence": null,
  "limitations": []
}
```

Field names may follow existing contracts, but the meaning must remain available.

## Deliverables

- Source and freshness mapping.
- Normalization and aggregation logic.
- Plain-language recommendation rules.
- Tests for unavailable, stale, missing, and conflicting data.
- Visible distinction between observed facts, derived rules, and predictions.

## Completion criteria

The task is complete when users can understand what the recommendation means, where it came from, how current it is, what uncertainty remains, and what action they can take next.
