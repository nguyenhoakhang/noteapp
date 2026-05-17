FROM php:8.3-fpm

RUN apt-get update && apt-get install -y \
    git curl zip unzip libpng-dev libonig-dev libxml2-dev libzip-dev \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip opcache

# OPcache — cache compiled PHP
# RUN docker-php-ext-install opcache
# COPY docker/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
# COPY php-fpm.conf /usr/local/etc/php-fpm.d/www.conf

WORKDIR /var/www
EXPOSE 9000
CMD ["php-fpm"]