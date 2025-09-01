output "lambda_arn" { 
    value = aws_lambda_function.rest.arn 
}
output "lambda_name" { 
    value = aws_lambda_function.rest.function_name 
}
output "lambda_invoke_arn" {
  value = aws_lambda_function.rest.invoke_arn
}