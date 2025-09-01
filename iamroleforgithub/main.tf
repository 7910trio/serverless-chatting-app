terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-2"
}

resource "aws_iam_role" "github_actions_role" {
  name = "GitHubActionsRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${var.aws_account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            # 선택 사항: 특정 리포지토리만 허용
            "token.actions.githubusercontent.com:sub" = "repo:7910trio/serverless-chatting-app:ref:refs/heads/master"
          }
        }
      }
    ]
  })
}

resource "aws_iam_policy" "github_actions_policy" {
  name        = "GitHubActionsPolicy"
  description = "Minimum permissions for deploying ChatApp"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      # Lambda
      {
        Effect = "Allow",
        Action = [
          "lambda:CreateFunction",
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:GetFunction",
          "lambda:AddPermission"
        ],
        Resource = "*"
      },
      # API Gateway
      {
        Effect = "Allow",
        Action = [
          "apigateway:*",
          "execute-api:ManageConnections"
        ],
        Resource = "*"
      },
      # S3
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject",
          "s3:CreateBucket",
          "s3:GetBucketTagging",
          "s3:GetBucketPolicy",
          "s3:GetBucketAcl"
        ],
        Resource = "*"
      },
      # CloudFront
      {
        Effect = "Allow",
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:GetDistributionConfig",
          "cloudfront:CreateOriginAccessControl",
          "cloudfront:GetOriginAccessControl",
        ],
        Resource = "*"
      },
      # STS: AssumeRole 권한
      {
        Effect = "Allow",
        Action = ["sts:AssumeRole"],
        Resource = "*"
      },
      # DynamoDB
      {
        Effect = "Allow",
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ],
        Resource = "arn:aws:dynamodb:ap-northeast-2:${var.aws_account_id}:table/tf-lock-table"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:CreateTable",
          "dynamodb:DescribeTable",
          "dynamodb:DescribeContinuousBackups"
          ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:CreatePolicy",
          "iam:AttachRolePolicy",
          "iam:PassRole",
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:GetPolicy",
          "iam:ListRolePolicies",
          "iam:GetPolicyVersion",
          "iam:ListAttachedRolePolicies"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_attach" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = aws_iam_policy.github_actions_policy.arn
}

