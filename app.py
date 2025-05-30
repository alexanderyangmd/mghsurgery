from flask import Flask, request, jsonify, session
from flask_session import Session
import os
import sqlite3
import requests
from datetime import datetime
import csv
from io import StringIO
import redis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure Redis for session handling
app.config['SESSION_TYPE'] = 'redis'
app.config['SESSION_REDIS'] = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
Session(app)

# Database connection
def get_db_connection():
    conn = sqlite3.connect('data/phonebook.db')
    conn.row_factory = sqlite3.Row
    return conn

# Authentication middleware
def require_auth(f):
    def decorated(*args, **kwargs):
        if not session.get('authenticated'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated

@app.route('/verify', methods=['GET'])
def verify():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'success': False}), 401
    
    try:
        # Your existing verification logic
        session['authenticated'] = True
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 401

@app.route('/api/phone/contacts')
@require_auth
def get_contacts():
    category = request.args.get('category')
    search = request.args.get('search')
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            query = '''
                SELECT 
                    c.*,
                    cat.name as category_name,
                    cat.display_name as category_display_name
                FROM contacts c
                JOIN categories cat ON c.category_id = cat.id
                WHERE c.is_active = 1
            '''
            params = []
            
            if category:
                query += ' AND cat.name = ?'
                params.append(category)
            
            if search:
                query += ' AND (c.name LIKE ? OR c.role LIKE ? OR c.phone_number LIKE ?)'
                search_param = f'%{search}%'
                params.extend([search_param, search_param, search_param])
            
            cursor.execute(query, params)
            contacts = [dict(row) for row in cursor.fetchall()]
            return jsonify(contacts)
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/schedule')
@require_auth
def get_schedule():
    try:
        day = request.args.get('day')
        month = request.args.get('month')
        year = request.args.get('year')
        
        # Your existing Amion fetching logic
        url = f"http://www.amion.com/cgi-bin/ocs?Lo=mghsurg&Rpt=619&Day={day}&Month={month}&Year={year}"
        response = requests.get(url)
        
        if response.ok:
            return response.text
        else:
            return jsonify({'error': 'Failed to fetch schedule'}), response.status_code
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Similar routes for churchill, vascular, thoracic, and cardiac
# Each with proper authentication and error handling

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 8000))) 