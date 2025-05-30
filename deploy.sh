#!/bin/bash

# Exit on error
set -e

# Update system packages
sudo apt-get update
sudo apt-get upgrade -y

# Install required system packages
sudo apt-get install -y python3-pip python3-dev nginx redis-server

# Install Python packages
pip3 install -r requirements.txt

# Create necessary directories
sudo mkdir -p /var/log/mghsurgery
sudo mkdir -p /var/www/mghsurgery/static

# Copy static files
cp -r static/* /var/www/mghsurgery/static/

# Set up Nginx
sudo cp nginx.conf /etc/nginx/sites-available/mghsurgery
sudo ln -sf /etc/nginx/sites-available/mghsurgery /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Install SSL certificate using Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Set up systemd service for Gunicorn
sudo bash -c 'cat > /etc/systemd/system/mghsurgery.service << EOL
[Unit]
Description=MGH Surgery Gunicorn daemon
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/your/app
Environment="PATH=/path/to/your/venv/bin"
ExecStart=/path/to/your/venv/bin/gunicorn -c gunicorn.conf.py app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOL'

# Set up systemd service for Redis
sudo bash -c 'cat > /etc/systemd/system/redis.service << EOL
[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf
ExecStop=/usr/local/bin/redis-cli shutdown
Restart=always

[Install]
WantedBy=multi-user.target
EOL'

# Start and enable services
sudo systemctl daemon-reload
sudo systemctl start redis
sudo systemctl enable redis
sudo systemctl start mghsurgery
sudo systemctl enable mghsurgery
sudo systemctl restart nginx

echo "Deployment complete!" 