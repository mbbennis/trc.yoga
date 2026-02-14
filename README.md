# trc.yoga

Aggregates yoga class schedules from Triangle Rock Club locations (Morrisville, North Raleigh, Salvage Yard, Durham) into a browsable website and subscribable iCal feeds.

Live at **[trc.yoga](https://trc.yoga)**

## Architecture

```
iCal feeds ─► Ingest Lambda ─► SQS ─► Describe Lambda (Bedrock) ─► DynamoDB
                                                                        │
                                                        Calendar Lambda ─┘─► S3 (.ics files)
                                                                              │
                                                          React frontend ─────┘─► trc.yoga
```

- **Ingest** — Fetches iCal feeds hourly, filters for yoga events, sends new ones to SQS
- **Describe** — Uses Amazon Nova Micro to rewrite class descriptions into concise summaries, stores in DynamoDB
- **Calendar** — Generates `.ics` files for every combination of locations, uploads to S3
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

## Cost Safety Measures

- **DynamoDB TTL** — Records auto-expire after 1 year
- **SQS Dead Letter Queue** — Failed messages retry 3 times then move to DLQ (14-day retention)
- **CloudWatch Alarm** — Alerts via email when SQS queue depth exceeds 100 messages
- **Reserved Concurrency** — Describe lambda capped at 5 concurrent executions to limit Bedrock spend
