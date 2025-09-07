output "rest_api_url" { 
  value = aws_apigatewayv2_api.rest_api.api_endpoint
}

output "websocket_api_url" {
  value = "${aws_apigatewayv2_api.websocket_api.api_endpoint}/${aws_apigatewayv2_stage.ws_default_stage.name}"
}
