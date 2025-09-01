variable "name" {
    default = "ChatLambdaFunction"
}

variable "zip_path" {
    description = "Path to the Lambda function zip file"
}

variable "messages_table" {
    description = "DynamoDB table name for chat messages"
    type        = string
}