resource "aws_s3_bucket" "site" {
  bucket = "${var.project}-site-${random_id.rand.hex}"
  tags   = { Project = var.project }
}

resource "random_id" "rand" {
  byte_length = 4
}

resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

