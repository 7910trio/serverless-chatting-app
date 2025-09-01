resource "aws_lambda_function" "rest" {
  function_name = var.name
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  role          = aws_iam_role.rest_lambda_role.arn
  filename      = var.zip_path
  source_code_hash = filebase64sha256(var.zip_path)
  environment {
    variables = {
      TABLE_MESSAGES = var.messages_table
    }
  }
}

# REST Lambda 역할
resource "aws_iam_role" "rest_lambda_role" {
  name = "rest_lambda_role"

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
resource "aws_iam_role_policy_attachment" "rest_lambda_logs" {
  role       = aws_iam_role.rest_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB 조회 정책 (ChatMessages 조회만)
resource "aws_iam_policy" "rest_lambda_dynamo_policy" {
  name   = "rest_lambda_dynamo_policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "dynamodb:Query"
        ]
        Resource = "arn:aws:dynamodb:*:*:table/ChatMessages"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_rest_dynamo_policy" {
  role       = aws_iam_role.rest_lambda_role.name
  policy_arn = aws_iam_policy.rest_lambda_dynamo_policy.arn
}


