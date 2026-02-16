# TRC Yoga

Aggregates yoga and fitness class schedules from Triangle Rock Club's four locations into a single web app at https://trc.yoga.

## Architecture

```
iCal feeds (RockGymPro) → Ingest Lambda → SQS → Describe Lambda → DynamoDB
                                                                      ↓
                                                            Calendar Lambda → S3 (.ics files)
                                                            Capacity Lambda → DynamoDB (sold-out status)
                                                                      ↓
                                                              Static website (S3 + CloudFront)
```

## Lambdas

- **Ingest** (`lambda/src/ingest.ts`): Fetches iCal feeds from 4 locations, computes content hash (stripping volatile DTSTAMP and URL fields), compares against DynamoDB, sends new/changed events to SQS. Runs daily via EventBridge.
- **Describe** (`lambda/src/describe.ts`): Consumes SQS messages, uses Bedrock Nova Micro to rewrite descriptions, classifies events as yoga/fitness (run club events are always fitness), writes to DynamoDB with contentHash and lastModified.
- **Calendar** (`lambda/src/calendar.ts`): Queries DynamoDB, generates power-set .ics files under `calendars/yoga/` and `calendars/fitness/` in S3. Triggered by DynamoDB stream.
- **Capacity** (`lambda/src/capacity.ts`): Queries upcoming events, scrapes RockGymPro for sold-out status, updates DynamoDB. Runs on schedule.

## DynamoDB Table (`trc-yoga-events`)

- Primary key: `{uid, dtstart}` — used by ingest (GetItem), describe (PutItem), capacity (UpdateItem)
- GSI: `{locationName, dtstart}` (`locationName-dtstart-index`) — used by calendar and capacity for range queries by location
- TTL on `ttl` attribute (1 year)

## Web App (`web/`)

- React 19 + Vite, no router library
- SPA navigation via `usePath` hook (pushState + popstate) — switching between `/` (yoga) and `/fitness` is instant
- Fetches `.ics` files from S3, parses in-browser
- Location filter persisted in cookie
- Browser tab always shows "TRC Yoga"

## Key Locations

- 4 TRC locations: MV (Morrisville), NR (North Raleigh), SY (Salvage Yard), D (Durham)
- iCal source URLs configured in `terraform/terraform.tfvars`

## Build & Deploy

- Lambda: `cd lambda && npm run package` then `cd terraform && terraform apply`
- Web: `cd web && npm run build` then `aws s3 sync dist s3://trc.yoga --exclude "calendars/*"`
- S3 deploy must use `--exclude "calendars/*"` to avoid deleting generated .ics files

## Content Hash

Content hash strips DTSTAMP and URL lines before SHA-256 hashing — RockGymPro includes a volatile `&random=` parameter in URLs and DTSTAMP changes on every fetch.

## Testing

- `cd lambda && npx jest` — runs all lambda tests
- `cd web && npx tsc --noEmit` — type check web app
