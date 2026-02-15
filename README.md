# trc.yoga

Aggregates yoga and fitness class schedules from Triangle Rock Club locations (Morrisville, North Raleigh, Salvage Yard, Durham) into a browsable website and subscribable iCal feeds.

Live at **[trc.yoga](https://trc.yoga)**

## Architecture

```
iCal feeds ─► Ingest Lambda ─► SQS ─► Describe Lambda (Bedrock) ─► DynamoDB
                                                                        │
                                                        Calendar Lambda ─┘─► S3 (.ics files)
                                                                              │
                                                          React frontend ─────┘─► trc.yoga
```

- **Ingest** — Fetches iCal feeds daily, detects new/changed events via content hashing, sends them to SQS
- **Describe** — Uses Amazon Nova Micro to rewrite class descriptions into concise summaries, classifies events as yoga or fitness, stores in DynamoDB
- **Calendar** — Generates `.ics` files for every combination of locations under `calendars/yoga/` and `calendars/fitness/`, uploads to S3
- **Capacity** — Checks class capacity/sold-out status and updates DynamoDB records
- **Web** — React/Vite frontend that parses `.ics` feeds client-side with location filtering and calendar subscription links

## Prerequisites

- Node.js 20+
- Terraform 1.5+
- AWS CLI configured
- Cloudflare API token (for DNS)

## Setup

```bash
# Install dependencies
cd lambda && npm install && cd ..
cd web && npm install && cd ..

# Configure Terraform variables
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit terraform.tfvars with your values
```

## Scripts

From the project root:

| Command | Description |
|---|---|
| `npm run build` | Build both web and lambda |
| `npm run build:web` | Build the Vite frontend |
| `npm run build:lambda` | Compile and zip the lambda |
| `npm test` | Run lambda tests |
| `npm run deploy:web` | Build and sync frontend to S3 |
| `npm run deploy:lambda` | Build lambda and terraform apply |
| `npm run deploy` | Deploy everything |
