terraform {
  required_version = "~> 1.5.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_s3_bucket" "website_bucket" {
  bucket = var.website_bucket_name
}

resource "aws_iam_policy" "lambda_policy" {
  name = "trc-yoga-lambda-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${data.aws_s3_bucket.website_bucket.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = ["arn:aws:logs:*:*:*"]
      }
    ]
  })
}

resource "aws_iam_role" "lambda_role" {
  name = "trc-yoga-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Effect = "Allow"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

resource "aws_cloudwatch_log_group" "log_group" {
  name              = "/aws/lambda/${var.lambda_function_name}"
  retention_in_days = 7
}

resource "aws_lambda_function" "update_lambda" {
  function_name = var.lambda_function_name
  filename      = var.zip_file_path
  role          = aws_iam_role.lambda_role.arn
  handler       = var.lambda_function_handler
  runtime       = "provided.al2023"
  timeout       = 60

  depends_on = [aws_cloudwatch_log_group.log_group]

  source_code_hash = filebase64sha256(var.zip_file_path)

  environment {
    variables = {
      BUCKET_NAME         = var.website_bucket_name
      LOCATIONS_DATA_KEY  = var.locations_data_key
      CALENDAR_FOLDER_KEY = var.calendar_folder_key
    }
  }
}
