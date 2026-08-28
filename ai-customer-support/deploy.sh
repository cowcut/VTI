#!/usr/bin/env bash

# Deploy the API with PM2 and rebuild both the API and Vite frontend.
# Optional environment variables:
#   PM2_APP_NAME=ai-customer-support-api  # PM2 process name
#   INSTALL_DEPS=0                        # Skip `npm ci` when dependencies are unchanged

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="${PM2_APP_NAME:-ai-customer-support-api}"

command -v node >/dev/null || { echo "Node.js is not installed." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is not installed." >&2; exit 1; }
command -v pm2 >/dev/null || { echo "PM2 is not installed. Install it with: npm install -g pm2" >&2; exit 1; }

cd "$SCRIPT_DIR"

if [[ "${INSTALL_DEPS:-1}" == "1" ]]; then
  echo "Installing dependencies..."
  npm ci
fi

echo "Building backend and frontend..."
npm run build

echo "Starting PM2 process: $APP_NAME"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  # Run from backend so dotenv loads backend/.env correctly.
  pm2 start dist/server.js --name "$APP_NAME" --cwd "$SCRIPT_DIR/backend"
fi

pm2 save
echo "Deploy completed successfully."
