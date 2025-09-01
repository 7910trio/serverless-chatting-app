resource "aws_dynamodb_table" "messages" {
  name         = var.table_messages
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roomId"
  range_key    = "timestamp"
  
  attribute {
    name = "roomId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }
}

resource "aws_dynamodb_table" "connections" {
  name         = var.table_connections
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roomId"
  range_key    = "connectionId"

  attribute {
    name = "roomId"
    type = "S"
  }

  attribute {
    name = "connectionId"
    type = "S"
  }
}
