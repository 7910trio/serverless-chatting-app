output "messages_table" { 
    value = aws_dynamodb_table.messages.name 
}
output "connections_table" { 
    value = aws_dynamodb_table.connections.name 
}