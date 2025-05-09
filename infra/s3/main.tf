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
  cloudflare_ip_addresses = [
    "2400:cb00::/32",
    "2405:8100::/32",
    "2405:b500::/32",
    "2606:4700::/32",
    "2803:f800::/32",
    "2a06:98c0::/29",
    "2c0f:f248::/32",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "108.162.192.0/18",
    "131.0.72.0/22",
    "141.101.64.0/18",
    "162.158.0.0/15",
    "172.64.0.0/13",
    "173.245.48.0/20",
    "188.114.96.0/20",
    "190.93.240.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17"
  ]

  mime_map = {
    css         = "text/css"
    html        = "text/html"
    ico         = "image/x-icon"
    png         = "image/png"
    svg         = "image/svg+xml"
    webmanifest = "application/manifest+json"
    xml         = "application/xml"
  }

  redirect_bucket_name = replace(var.website_bucket_name, "www.", "")

  static_keys = fileset(var.static_folder_path, "**")

  static_objects = {
    for key in local.static_keys : key => {
      content_type = lookup(local.mime_map, reverse(split(".", key))[0], "text/plain")
      source       = "${var.static_folder_path}/${key}"
    }
  }
}

data "aws_iam_policy_document" "allow_access_from_cloudflare" {
  statement {

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = [
      "s3:GetObject",
    ]

    resources = [
      "${aws_s3_bucket.website.arn}/*",
    ]

    condition {
      test     = "IpAddress"
      variable = "aws:SourceIp"
      values   = local.cloudflare_ip_addresses
    }
  }
}

resource "aws_s3_bucket" "website" {
  bucket = var.website_bucket_name
}

resource "aws_s3_bucket_website_configuration" "website_configuration" {
  bucket = aws_s3_bucket.website.id

  index_document {
    suffix = var.index_object_key
  }

  error_document {
    key = var.error_object_key
  }
}

resource "aws_s3_bucket_public_access_block" "website_public_access_block" {
  bucket                  = aws_s3_bucket.website.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "website_bucket_policy" {
  bucket = aws_s3_bucket.website.id
  policy = data.aws_iam_policy_document.allow_access_from_cloudflare.json
  depends_on = [
    aws_s3_bucket_public_access_block.website_public_access_block
  ]
}

resource "aws_s3_object" "static_objects" {
  for_each = local.static_objects

  bucket       = aws_s3_bucket.website.id
  key          = each.key
  content_type = each.value.content_type
  source       = each.value.source
  source_hash  = filemd5(each.value.source)
}

resource "aws_s3_bucket" "redirect" {
  bucket = local.redirect_bucket_name
}

resource "aws_s3_bucket_website_configuration" "redirect_configuration" {
  bucket = aws_s3_bucket.redirect.id

  redirect_all_requests_to {
    host_name = var.website_bucket_name
    protocol  = "https"
  }
}
