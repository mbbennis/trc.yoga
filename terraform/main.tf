terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.27"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 5.15"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.7"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      project = "trc.yoga"
    }
  }
}

provider "cloudflare" {}

# ---------- Variables ----------

variable "aws_region" {
  default = "us-east-1"
}

variable "ical_sources" {
  description = "Map of location abbreviation to iCal feed URL, name, address, and site URL"
  type = map(object({
    url     = string
    name    = string
    address = string
    siteUrl = string
  }))
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table for yoga events"
  default     = "trc-yoga-events"
}

variable "aggregator_schedule" {
  description = "EventBridge schedule for the aggregator Lambda"
  default     = "cron(0 * * * ? *)"
}

variable "calendar_schedule" {
  description = "EventBridge schedule for the calendar Lambda"
  default     = "cron(10 * * * ? *)"
}

variable "domain_name" {
  description = "Domain name for the website"
  default     = "trc.yoga"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for the domain"
  type        = string
}

# ---------- DynamoDB Table ----------

resource "aws_dynamodb_table" "yoga_events" {
  name             = var.dynamodb_table_name
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "uid"
  range_key        = "dtstart"
  stream_enabled   = false

  attribute {
    name = "uid"
    type = "S"
  }

  attribute {
    name = "dtstart"
    type = "S"
  }

  attribute {
    name = "locationName"
    type = "S"
  }

  global_secondary_index {
    name            = "locationName-dtstart-index"
    hash_key        = "locationName"
    range_key       = "dtstart"
    projection_type = "ALL"
  }
}

# ---------- SQS Queue ----------

resource "aws_sqs_queue" "yoga_events" {
  name                       = "trc-yoga-events"
  visibility_timeout_seconds = 360
}

# ---------- IAM ----------

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    actions   = ["dynamodb:Query"]
    resources = [
      aws_dynamodb_table.yoga_events.arn,
      "${aws_dynamodb_table.yoga_events.arn}/index/*",
    ]
  }
  statement {
    actions   = ["sqs:SendMessage", "sqs:SendMessageBatch"]
    resources = [aws_sqs_queue.yoga_events.arn]
  }
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_role" "lambda" {
  name               = "trc-yoga-ingest-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "lambda" {
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

# ---------- Lambda ----------

resource "aws_lambda_function" "yoga_ical" {
  function_name    = "trc-yoga-ingest"
  role             = aws_iam_role.lambda.arn
  handler          = "ingest.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 256
  filename         = "${path.module}/../lambda/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambda/lambda.zip")

  environment {
    variables = {
      ICAL_SOURCES   = jsonencode(var.ical_sources)
      DYNAMODB_TABLE = var.dynamodb_table_name
      SQS_QUEUE_URL  = aws_sqs_queue.yoga_events.url
    }
  }
}

# ---------- Describe Lambda (Bedrock Nova Micro) ----------

data "aws_iam_policy_document" "describe_lambda_permissions" {
  statement {
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.yoga_events.arn]
  }
  statement {
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.yoga_events.arn]
  }
  statement {
    actions   = ["bedrock:InvokeModel"]
    resources = ["arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0"]
  }
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_role" "describe_lambda" {
  name               = "trc-yoga-describe-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "describe_lambda" {
  role   = aws_iam_role.describe_lambda.id
  policy = data.aws_iam_policy_document.describe_lambda_permissions.json
}

resource "aws_lambda_function" "yoga_describe" {
  function_name    = "trc-yoga-describe"
  role             = aws_iam_role.describe_lambda.arn
  handler          = "describe.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 256
  filename         = "${path.module}/../lambda/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambda/lambda.zip")

  environment {
    variables = {
      DYNAMODB_TABLE = var.dynamodb_table_name
    }
  }
}

resource "aws_lambda_event_source_mapping" "yoga_describe_sqs" {
  event_source_arn                   = aws_sqs_queue.yoga_events.arn
  function_name                      = aws_lambda_function.yoga_describe.arn
  batch_size                         = 10
  function_response_types            = ["ReportBatchItemFailures"]
}

# ---------- Website (S3 + Cloudflare) ----------

module "website" {
  source = "github.com/mbbennis/terraform-aws-s3-cloudflare-website"

  domain_name        = var.domain_name
  bucket_name        = "trc.yoga"
  cloudflare_zone_id = var.cloudflare_zone_id
}

# ---------- Calendar Lambda IAM ----------

data "aws_iam_policy_document" "calendar_lambda_permissions" {
  statement {
    actions   = ["dynamodb:Query"]
    resources = [
      aws_dynamodb_table.yoga_events.arn,
      "${aws_dynamodb_table.yoga_events.arn}/index/*",
    ]
  }
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${module.website.bucket_arn}/*"]
  }
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_role" "calendar_lambda" {
  name               = "trc-yoga-calendar-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "calendar_lambda" {
  role   = aws_iam_role.calendar_lambda.id
  policy = data.aws_iam_policy_document.calendar_lambda_permissions.json
}

# ---------- Calendar Lambda ----------

resource "aws_lambda_function" "yoga_calendar" {
  function_name    = "trc-yoga-calendar"
  role             = aws_iam_role.calendar_lambda.arn
  handler          = "calendar.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 256
  filename         = "${path.module}/../lambda/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambda/lambda.zip")

  environment {
    variables = {
      DYNAMODB_TABLE = var.dynamodb_table_name
      S3_BUCKET      = module.website.bucket_name
      ICAL_SOURCES   = jsonencode(var.ical_sources)
    }
  }
}

# ---------- EventBridge Schedule ----------

resource "aws_cloudwatch_event_rule" "aggregator_schedule" {
  name                = "trc-yoga-ingest-schedule"
  schedule_expression = var.aggregator_schedule
}

resource "aws_cloudwatch_event_target" "aggregator" {
  rule = aws_cloudwatch_event_rule.aggregator_schedule.name
  arn  = aws_lambda_function.yoga_ical.arn
}

resource "aws_lambda_permission" "eventbridge_aggregator" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.yoga_ical.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.aggregator_schedule.arn
}

resource "aws_cloudwatch_event_rule" "calendar_schedule" {
  name                = "trc-yoga-calendar-schedule"
  schedule_expression = var.calendar_schedule
}

resource "aws_cloudwatch_event_target" "calendar" {
  rule = aws_cloudwatch_event_rule.calendar_schedule.name
  arn  = aws_lambda_function.yoga_calendar.arn
}

resource "aws_lambda_permission" "eventbridge_calendar" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.yoga_calendar.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.calendar_schedule.arn
}

# ---------- Outputs ----------

output "lambda_function_name" {
  value = aws_lambda_function.yoga_ical.function_name
}

output "describe_lambda_function_name" {
  value = aws_lambda_function.yoga_describe.function_name
}

output "dynamodb_table" {
  value = aws_dynamodb_table.yoga_events.name
}

output "calendar_lambda_function_name" {
  value = aws_lambda_function.yoga_calendar.function_name
}

output "calendar_s3_bucket" {
  value = module.website.bucket_name
}

output "calendar_website_url" {
  value = "https://${var.domain_name}"
}

output "sqs_queue_url" {
  value = aws_sqs_queue.yoga_events.url
}
