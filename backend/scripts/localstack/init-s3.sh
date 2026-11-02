#!/bin/sh
set -eu

bucket="helpdesk-uploads"

if ! awslocal s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
  awslocal s3api create-bucket --bucket "$bucket" --region us-east-1
fi
