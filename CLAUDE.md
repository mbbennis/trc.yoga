# TRC Yoga

Aggregates yoga and fitness class schedules from Triangle Rock Club's four locations into a single web app at https://trc.yoga.

## Architecture

```
iCal feeds (RockGymPro) → Ingest Lambda → SQS → Describe Lambda → DynamoDB
                                                                      ↓
                                                            Calendar Lambda → S3 (.ics files)
                                                            Capacity Lambda → DynamoDB (sold-out status)
                                                            Data Lambda → S3 (data/events.json) → Vercel ISR
```

## Lambdas

- **Ingest** (`lambda/src/ingest.ts`): Fetches iCal feeds from 4 locations, computes content hash (stripping volatile DTSTAMP and URL fields), compares against DynamoDB, sends new/changed events to SQS. Runs daily via EventBridge.
- **Describe** (`lambda/src/describe.ts`): Consumes SQS messages, uses Bedrock Nova Micro to rewrite descriptions, classifies events as yoga/fitness (run club events are always fitness), writes to DynamoDB with contentHash and lastModified.
- **Calendar** (`lambda/src/calendar.ts`): Queries DynamoDB, generates power-set .ics files under `calendars/yoga/` and `calendars/fitness/` in S3. Runs every 12 hours and on capacity changes via EventBridge.
- **Capacity** (`lambda/src/capacity.ts`): Queries upcoming events, scrapes RockGymPro for sold-out status, updates DynamoDB. Runs every 15 minutes via EventBridge. Emits `CapacityChanged` event when status changes.
- **Data** (`lambda/src/data.ts`): Queries DynamoDB, writes `data/events.json` to S3, then POSTs to the Vercel `/api/revalidate` endpoint to trigger ISR. Runs every 12 hours and on capacity changes via EventBridge.

## DynamoDB Table (`trc-yoga-events`)

- Primary key: `{uid, startTime}` — used by ingest (GetItem), describe (PutItem), capacity (UpdateItem)
- GSI: `{locationName, startTime}` (`locationName-startTime-index`) — used by calendar, capacity, and data for range queries by location
- TTL on `ttl` attribute (1 year)

## Web App (`web/`)

- Next.js 15 App Router, deployed on Vercel
- Server-rendered with on-demand ISR — page rebuilds when the data lambda POSTs to `/api/revalidate`
- Fetches `https://data.trc.yoga/data/events.json` at build time
- `data.trc.yoga` is a Vercel domain that rewrites to the S3 bucket (HTTP), providing HTTPS termination
- iCal subscription URLs served from `https://data.trc.yoga/calendars/`

## S3 Bucket (`data.trc.yoga`)

- Public read, hosted at `data.trc.yoga` via Vercel rewrite proxy
- Contains `data/events.json` (written by data lambda) and `calendars/**/*.ics` (written by calendar lambda)

## Key Locations

- 4 TRC locations: MV (Morrisville), NR (North Raleigh), SY (Salvage Yard), D (Durham)
- iCal source URLs configured in `terraform/terraform.tfvars`

## Build & Deploy

- Lambda + infra: `npm run deploy` (from project root) — builds lambda zip and runs `terraform apply`
- Web: deployed automatically by Vercel on push to main

## Content Hash

Content hash strips DTSTAMP and URL lines before SHA-256 hashing — RockGymPro includes a volatile `&random=` parameter in URLs and DTSTAMP changes on every fetch.

## Testing

- `cd lambda && npx jest` — runs all lambda tests
- `cd web && npx tsc --noEmit` — type check web app
