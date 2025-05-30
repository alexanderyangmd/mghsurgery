import multiprocessing

# Gunicorn configuration for production
bind = "0.0.0.0:8000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
timeout = 120
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
accesslog = "access.log"
errorlog = "error.log"
loglevel = "info"

# SSL configuration (if needed)
# keyfile = "path/to/keyfile"
# certfile = "path/to/certfile" 