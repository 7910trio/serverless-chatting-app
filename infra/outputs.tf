output "ws_url" {
  value = module.api_gateway.websocket_api_url
}

output "bucket_name" {
  value = module.s3_website.bucket_name
}

output "cloudfront_id" {
  value = module.cloudfront.cloudfront_id
}