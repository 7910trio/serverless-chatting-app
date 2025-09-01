terraform {
  required_providers {
    aws = {
        source = "hashicorp/aws"
        version = "~> 5.0"
        }
    }

  backend "s3" {
    bucket = "chat-app-tf-backend-bucket"
    key = "chat-app/terraform.tfstate"
    region = "ap-northeast-2"
    dynamodb_table = "tf-lock-table"
    encrypt = true
  }
}

provider "aws" {
  region = "ap-northeast-2"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

module "dynamodb" {
  source            = "./modules/dynamodb"
  table_messages    = var.table_messages
  table_connections = var.table_connections
}

module "lambda_rest" {
  source         = "./modules/lambda/rest"
  name           = var.lambda_name
  zip_path       = "dist/rest.zip"
  messages_table = module.dynamodb.messages_table
}

module "lambda_ws" {
  source            = "./modules/lambda/websocket"
  name              = var.lambda_name
  zip_path          = "dist/websocket.zip"
  messages_table    = module.dynamodb.messages_table
  connections_table = module.dynamodb.connections_table
  ws_endpoint       = module.api_gateway.websocket_api_url
}

module "api_gateway" {
  source = "./modules/api-gateway"

  cloudfront_domain      = module.cloudfront.domain_name
  rest_lambda_invoke_arn = module.lambda_rest.lambda_invoke_arn
  rest_lambda_name       = module.lambda_rest.lambda_name

  ws_lambda_invoke_arn   = module.lambda_ws.lambda_invoke_arn
  ws_lambda_name         = module.lambda_ws.lambda_name
}

module "s3_website" {
  source  = "./modules/s3-website"
  project = "chat-frontend"
}

module "cloudfront" {
  source  = "./modules/cloudfront"
  project = "chat-frontend"

  bucket_name                 = module.s3_website.bucket_name
  bucket_arn                  = module.s3_website.bucket_arn
  bucket_regional_domain_name = module.s3_website.bucket_regional_domain_name
}

