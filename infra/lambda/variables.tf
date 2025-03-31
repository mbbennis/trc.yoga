variable "website_bucket_name" {
  type    = string
  default = "www.trc.yoga"
}

variable "locations_data_key" {
  type    = string
  default = "data/locations.json"
}

variable "calendar_folder_key" {
  type    = string
  default = "calendars"
}

variable "lambda_function_name" {
  type    = string
  default = "trc-yoga-update-lambda"
}

variable "lambda_function_handler" {
  type    = string
  default = "bootstrap"
}

variable "zip_file_path" {
  type    = string
}
