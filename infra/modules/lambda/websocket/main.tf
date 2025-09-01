resource "aws_lambda_function" "websocket" {
  function_name = "${var.name}-websocket"
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  role          = aws_iam_role.ws_lambda_role.arn

  filename         = var.zip_path
  source_code_hash = filebase64sha256(var.zip_path)

  environment {
    variables = {
      TABLE_MESSAGES    = var.messages_table      # ChatMessages 테이블 이름
      TABLE_CONNECTIONS = var.connections_table   # Connections 테이블 이름
      WS_ENDPOINT       = var.ws_endpoint         # API Gateway WebSocket 엔드포인트
    }
  }
}


# WebSocket Lambda 역할
resource "aws_iam_role" "ws_lambda_role" {
  name = "ws_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })
}

# 기본 Lambda 실행 정책 (CloudWatch 로그)
resource "aws_iam_role_policy_attachment" "ws_lambda_logs" {
  role       = aws_iam_role.ws_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB 정책 (메시지 저장 + 연결 관리)
resource "aws_iam_policy" "ws_lambda_dynamo_policy" {
  name   = "ws_lambda_dynamo_policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "dynamodb:PutItem"
        ]
        Resource = "arn:aws:dynamodb:*:*:table/ChatMessages"
      },
      {
        Effect   = "Allow"
        Action   = [
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:DeleteItem"
        ]
        Resource = "arn:aws:dynamodb:*:*:table/Connections"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_ws_dynamo_policy" {
  role       = aws_iam_role.ws_lambda_role.name
  policy_arn = aws_iam_policy.ws_lambda_dynamo_policy.arn
}
