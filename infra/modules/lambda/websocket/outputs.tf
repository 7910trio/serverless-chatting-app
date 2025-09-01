output "lambda_name" { 
    value = aws_lambda_function.websocket.function_name
}
output "lambda_invoke_arn" {
  value = aws_lambda_function.websocket.invoke_arn
}