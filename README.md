# trc.yoga

Aggregates yoga and fitness class schedules from Triangle Rock Club locations (Morrisville, North Raleigh, Salvage Yard, Durham) into a browsable website and subscribable iCal feeds.

Live at **[trc.yoga](https://trc.yoga)**


## Prerequisites

- Node.js 20+
- Terraform 1.5+
- AWS CLI configured

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
| `npm run build:web` | Build the Next.js frontend |
| `npm run build:lambda` | Compile and zip the lambda |
| `npm test` | Run lambda tests |
| `npm run deploy` | Build lambda and run terraform apply |
