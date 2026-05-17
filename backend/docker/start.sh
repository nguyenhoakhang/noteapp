#!/bin/bash
set -e

echo "Waiting for MySQL..."
for i in $(seq 1 30); do
  if mysqladmin ping -h mysql -unoteapp -pnoteapp --silent 2>/dev/null; then
    echo "MySQL ready."
    break
  fi
  if [ $i -eq 30 ]; then
    echo "MySQL not ready after 30 attempts."
    exit 1
  fi
  sleep 2
done

# Fallback: if vendor/ is missing (e.g., bind mount override), install at runtime
if [ ! -d vendor ]; then
  echo "vendor/ not found, running composer install..."
  composer install --no-interaction --prefer-dist --no-dev --no-progress
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

# Only generate APP_KEY if missing
if ! grep -q '^APP_KEY=[A-Za-z0-9]' .env 2>/dev/null; then
  php artisan key:generate --force
fi

if [ ! -L public/storage ]; then
  php artisan storage:link
fi

# Start server in background first so healthcheck can pass
php artisan serve --host=0.0.0.0 --port=8000 &
PHP_PID=$!

# Wait for port 8000 to actually be listening
echo "Waiting for server on port 8000..."
for i in $(seq 1 15); do
  if curl -s -o /dev/null http://localhost:8000 2>/dev/null; then
    echo "Server ready on port 8000."
    break
  fi
  if [ $i -eq 15 ]; then
    echo "Server did not start in time."
    exit 1
  fi
  sleep 1
done

# Now run migrations (server can handle DB ops while running)
php artisan migrate --force
php artisan config:clear 2>/dev/null || true
php artisan config:cache 2>/dev/null || true

wait $PHP_PID
