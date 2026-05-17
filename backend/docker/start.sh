#!/bin/bash
set -e

echo "Waiting for MySQL..."
for i in $(seq 1 30); do
  if mysqladmin ping -h mysql -unoteapp -pnoteapp --silent --skip-ssl 2>/dev/null; then
    echo "MySQL ready."
    break
  fi
  if [ $i -eq 30 ]; then
    echo "MySQL not ready after 30 attempts."
    exit 1
  fi
  sleep 2
done

if [ ! -d vendor ]; then
  echo "vendor/ not found, running composer install..."
  composer install --no-interaction --prefer-dist --no-dev --no-progress
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

if ! grep -q '^APP_KEY=[A-Za-z0-9]' .env 2>/dev/null; then
  php artisan key:generate --force
fi

if [ ! -L public/storage ]; then
  php artisan storage:link
fi

mkdir -p /var/www/storage/framework/{views,cache,sessions,testing}

php artisan migrate --force

php artisan config:clear 2>/dev/null || true

exec php artisan serve --host=0.0.0.0 --port=8000
