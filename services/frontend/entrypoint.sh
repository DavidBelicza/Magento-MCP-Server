#!/bin/sh
set -e

envsubst '${MAGENTIC_API_TOKEN}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/http.d/default.conf

exec "$@"
