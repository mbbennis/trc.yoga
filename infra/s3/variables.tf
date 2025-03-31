variable "website_bucket_name" {
  type    = string
}

variable "index_object_key" {
  type    = string
  default = "index.html"
}

variable "error_object_key" {
  type    = string
  default = "404.html"
}

variable "static_folder_path" {
  type = string
}
