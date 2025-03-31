terraform {
  required_version = "~> 1.5.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  region                  = "us-east-1"
  website_bucket_name     = "www.trc.yoga"
  index_object_key        = "index.html"
  error_object_key        = "404.html"
  locations_data_key      = "data/locations.json"
  calendar_folder_key     = "calendars"
  lambda_function_name    = "trc-yoga-update-lambda"
  lambda_function_handler = "bootstrap"
  static_folder_path      = abspath("${path.module}/../frontend/public")
  zip_file_path           = abspath("${path.module}/../backend/lambda.zip")
}

provider "aws" {
  region = local.region
  default_tags {
    tags = {
      IsPublicResource = true
    }
  }
}

module "s3" {
  source              = "./s3"
  website_bucket_name = local.website_bucket_name
  index_object_key    = local.index_object_key
  error_object_key    = local.error_object_key
  static_folder_path  = local.static_folder_path
}

module "lambda" {
  source                  = "./lambda"
  website_bucket_name     = local.website_bucket_name
  locations_data_key      = local.locations_data_key
  calendar_folder_key     = local.calendar_folder_key
  lambda_function_name    = local.lambda_function_name
  lambda_function_handler = local.lambda_function_handler
  zip_file_path           = local.zip_file_path
}

module "scheduler" {
  source               = "./scheduler"
  lambda_function_name = local.lambda_function_name
}
