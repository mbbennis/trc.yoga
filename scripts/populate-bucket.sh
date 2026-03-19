#!/bin/bash
set -e

echo "Invoking trc-yoga-calendar..."
aws lambda invoke \
  --function-name trc-yoga-calendar \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/calendar-response.json
echo "Calendar response:"
cat /tmp/calendar-response.json
echo

echo "Invoking trc-yoga-data..."
aws lambda invoke \
  --function-name trc-yoga-data \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/data-response.json
echo "Data response:"
cat /tmp/data-response.json
echo

echo "Done."
