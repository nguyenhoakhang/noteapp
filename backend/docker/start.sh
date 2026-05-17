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

if [ ! -f .env ]; then
  cp .env.example .env
fi

if [ ! -d vendor ] || [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction --prefer-dist --no-dev --no-progress
fi

APP_KEY=$(grep -oP 'APP_KEY=\K.*' .env)
if [ -z "$APP_KEY" ]; then
  php artisan key:generate --force
fi

if [ ! -L public/storage ]; then
  php artisan storage:link
fi

php artisan migrate --force
php artisan config:clear 2>/dev/null || true
php artisan config:cache 2>/dev/null || true

exec php artisan serve --host=0.0.0.0 --port=8000
