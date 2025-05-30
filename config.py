import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    # Basic Flask config
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')
    SESSION_TYPE = 'redis'
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours
    
    # Redis config
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
    
    # Database config
    DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data/phonebook.db')
    
    # Security config
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # CORS settings
    CORS_ORIGINS = [
        'https://your-domain.com',
        'https://www.your-domain.com'
    ]
    
    # Rate limiting
    RATELIMIT_DEFAULT = "100 per minute"
    RATELIMIT_STORAGE_URL = REDIS_URL
    
    # Logging
    LOG_LEVEL = 'INFO'
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    LOG_FILE = 'app.log'
    
    # Cache settings
    CACHE_TYPE = 'redis'
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = 300  # 5 minutes 