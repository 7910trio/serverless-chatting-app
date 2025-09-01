variable "name" {
  description = "Lambda function prefix name"
  type        = string
}

variable "zip_path" {
  description = "Path to Lambda deployment package zip"
  type        = string
}

variable "messages_table" {
  description = "DynamoDB table name for chat messages"
  type        = string
}

variable "connections_table" {
  description = "DynamoDB table name for websocket connections"
  type        = string
}

variable "ws_endpoint" {
  description = "API Gateway WebSocket endpoint"
  type        = string
}
