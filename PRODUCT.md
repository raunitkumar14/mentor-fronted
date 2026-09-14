# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal CRM operations managers — the kind of person who supervises a small team of calling agents ("owners" in the CRM) working a lead pipeline. They open this tool during coverage reviews (daily standups, weekly reviews, 1:1s with an agent) to answer one question at a time: "is this agent actually working the leads assigned to them?" [Inferred from the tool's purpose and this project's build history, not a separate interview — confidence is high because the requester is also the tool's builder.]

## Product Purpose

Give a manager a fast, trustworthy read on CRM call-coverage per agent over a date range: how many leads they own, how many got called at all, how many got called more than once, what happened on those calls, and how long they spent on the phone — computed live from the real Kylas CRM data mirrored in MongoDB, not a cached or estimated summary. Success is a manager picking one agent + date range and immediately seeing whether leads are being worked or going untouched, including the ones being called repeatedly without reaching anyone.

## Positioning

N/A — an internal, single-purpose instrument built for one team's own CRM data. There is no external alternative it competes with or must differentiate from.

## Operating Context

Used at a desk, in a browser, during work reviews — not a always-on wallboard, a tool someone opens, picks an agent and range, and reads. One view: owner + date-range filters produce KPI numbers, a call-frequency breakdown (how many leads got 0 / 1 / 2 / 3+ calls), and an outcome table for that selection. A FastAPI/Motor backend runs one MongoDB aggregation per request; the frontend has no login of its own yet (internal/dev use, not public).

## Capabilities and Constraints

- React (Vite) single-page app calling two endpoints: `GET /api/owners`, `GET /api/metrics?ownerId&start&end`.
- No routing or multi-page navigation needed — this is one view, not a suite of pages.
- No authentication/roles implemented yet.
- Real data means real edge cases: an agent can own leads and have made zero calls (leadsWithCalls = 0), a range can return zero leads for an agent, and one lead can be called many times (observed: up to 19 calls on a single lead) — the UI must present all of these legibly, not just the populated middle case.
- Numbers shown must be exactly what the API returns — no client-side rounding beyond what the API already applies, no invented states.

## Evidence on Hand

Real figures already pulled from the live database in this project's build history — e.g. agent "Aryan 1": 1722 leads in range, 103 with at least one call, 156 total call attempts against those leads, one lead called 19 times, ~4364s total talk time. This is production data, not a sample/demo dataset; no placeholder metrics should be invented beyond what the live API returns.

## Product Principles

- Numbers are the product — clarity and correctness of the figures always outrank decoration.
- Built for fast, repeated scanning: one manager comparing several agents in sequence, minimizing reading effort per KPI.
- Stay a single, focused view — resist adding navigation, settings, or sections the actual review workflow doesn't need.
- An internal tool earns trust through precision and legibility, not visual flourish for its own sake.
