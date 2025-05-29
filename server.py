from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import urllib.request
import csv
from io import StringIO
from datetime import datetime
import os
import base64
import sqlite3
from contextlib import contextmanager
from urllib.parse import urlparse, parse_qs

# Password for authentication
PASSWORD = "mgh"

class RequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Override to provide minimal logging
        try:
            # Convert all args to strings
            str_args = []
            for arg in args:
                if hasattr(arg, 'value'):  # HTTPStatus object
                    str_args.append(str(arg.value))
                elif hasattr(arg, 'startswith'):  # String
                    str_args.append(str(arg))
                else:  # Other types
                    str_args.append(str(arg))
            
            # Format the message
            try:
                message = format % tuple(str_args)
            except:
                message = f"{format} {' '.join(str_args)}"
            
            # Log based on message content
            if isinstance(message, str):
                if 'GET /api/' in message:
                    print(f"{self.address_string()} - API request: {message}")
                elif 'GET /verify' in message:
                    print(f"{self.address_string()} - Verify request")
                else:
                    print(f"{self.address_string()} - {message}")
        except Exception as e:
            # Fallback logging
            print(f"{self.address_string()} - Error in logging: {e}")

    def do_GET(self):
        # Check if the request is for the login verification
        if self.path == '/verify':
            auth_header = self.headers.get('Authorization')
            if auth_header and self.verify_password(auth_header):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True}).encode())
                return
            else:
                self.send_response(401)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False}).encode())
                return

        # Handle API endpoints
        if self.path.startswith('/api/'):
            self.handle_api_request()
            return

        # For all other requests, serve static files
        return SimpleHTTPRequestHandler.do_GET(self)

    def verify_password(self, auth_header):
        try:
            encoded_credentials = auth_header.split(' ')[1]
            decoded_credentials = base64.b64decode(encoded_credentials).decode('utf-8')
            password = decoded_credentials.split(':')[1]
            return password == PASSWORD
        except:
            return False

    def handle_api_request(self):
        # Check authentication for all API requests
        auth_header = self.headers.get('Authorization')
        if not auth_header or not self.verify_password(auth_header):
            self.send_response(401)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Unauthorized'}).encode())
            return

        # Extract date parameters from the request
        if '?' in self.path:
            base_path, params = self.path.split('?', 1)
            params = dict(param.split('=') for param in params.split('&'))
            day = params.get('day', datetime.now().strftime('%d'))
            month = params.get('month', datetime.now().strftime('%m'))
            year = params.get('year', datetime.now().strftime('%Y'))
        else:
            base_path = self.path
            day = datetime.now().strftime('%d')
            month = datetime.now().strftime('%m')
            year = datetime.now().strftime('%Y')

        # Clean up base path by removing trailing slashes
        base_path = base_path.rstrip('/')

        if base_path == '/api/schedule':
            self.handle_schedule_request(day, month, year)
        elif base_path == '/api/churchill':
            self.handle_churchill_request(day, month, year)
        elif base_path == '/api/vascular':
            self.handle_vascular_request(day, month, year)
        elif base_path == '/api/thoracic':
            self.handle_thoracic_request(day, month, year)
        elif base_path == '/api/cardiac':
            self.handle_cardiac_request(day, month, year)
        elif base_path == '/api/phone/categories':
            self.handle_phone_categories_request()
        elif base_path == '/api/phone/contacts':
            self.handle_phone_contacts_request()
        else:
            print(f"404 Not Found for path: {base_path}")  # Add debug logging
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not found'}).encode())

    def handle_schedule_request(self, day, month, year):
        try:
            url = f'http://www.amion.com/cgi-bin/ocs?Lo=mghsurgery1811&Rpt=619&Day={day}&Month={month}&Year={year}'
            with urllib.request.urlopen(url) as response:
                data = response.read().decode('utf-8')
                
            self.send_response(200)
            self.send_header('Content-type', 'text/csv')
            self.end_headers()
            self.wfile.write(data.encode())
            
        except Exception as e:
            print(f"Error fetching schedule: {e}")
            self.send_error(500)

    def handle_churchill_request(self, day, month, year):
        try:
            url = f'http://www.amion.com/cgi-bin/ocs?Lo=Churchill&Rpt=619&Day={day}&Month={month}&Year={year}'
            with urllib.request.urlopen(url) as response:
                data = response.read().decode('utf-8')
                
            self.send_response(200)
            self.send_header('Content-type', 'text/csv')
            self.end_headers()
            self.wfile.write(data.encode())
            
        except Exception as e:
            print(f"Error fetching Churchill schedule: {e}")
            self.send_error(500)

    def handle_vascular_request(self, day, month, year):
        try:
            url = f'http://www.amion.com/cgi-bin/ocs?Lo=VascOncall!&Rpt=619&Day={day}&Month={month}&Year={year}'
            with urllib.request.urlopen(url) as response:
                data = response.read().decode('utf-8')
                
            self.send_response(200)
            self.send_header('Content-type', 'text/csv')
            self.end_headers()
            self.wfile.write(data.encode())
            
        except Exception as e:
            print(f"Error fetching Vascular schedule: {e}")
            self.send_error(500)

    def handle_thoracic_request(self, day, month, year):
        """Handle requests for thoracic schedule data"""
        try:
            # Construct the URL for the thoracic schedule
            url = f'http://www.amion.com/cgi-bin/ocs?Lo=MGHThoracic&Rpt=619&Day={day}&Month={month}&Year={year}'
            
            print(f"Fetching data from: {url}")
            with urllib.request.urlopen(url) as response:
                csv_text = response.read().decode('utf-8')
                print("Received CSV data:", csv_text.split('\n')[0])  # Print first line only
                
                self.send_response(200)
                self.send_header('Content-type', 'text/csv')
                self.end_headers()
                self.wfile.write(csv_text.encode())
        except Exception as e:
            print(f"Error fetching thoracic schedule: {str(e)}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def handle_cardiac_request(self, day, month, year):
        try:
            # Don't subtract 1 from year for cardiac schedule
            url = f'http://www.amion.com/cgi-bin/ocs?Lo=mghcs&Rpt=619&Day={day}&Month={month}&Year={year}'
            print(f"Fetching cardiac data from: {url}")
            
            try:
                response = urllib.request.urlopen(url)
            except urllib.error.HTTPError as e:
                print(f"HTTP Error fetching cardiac data: {e.code} - {e.reason}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
                return
            except urllib.error.URLError as e:
                print(f"URL Error fetching cardiac data: {e.reason}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
                return
                
            data = response.read().decode('utf-8')
            print("Received cardiac CSV data:", data.split('\n')[0])  # Print first line only
            
            self.send_response(200)
            self.send_header('Content-type', 'text/csv')
            self.end_headers()
            self.wfile.write(data.encode())
            
        except Exception as e:
            print(f"Error in handle_cardiac_request: {str(e)}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def handle_phone_categories_request(self):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                categories = cursor.execute('SELECT * FROM categories').fetchall()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                # Convert rows to dictionaries
                categories_list = [dict(zip([col[0] for col in cursor.description], row)) for row in categories]
                self.wfile.write(json.dumps(categories_list).encode())
        except Exception as e:
            print(f"Error handling categories request: {str(e)}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def handle_phone_contacts_request(self):
        try:
            # Parse query parameters
            from urllib.parse import urlparse, parse_qs
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            
            category = query_params.get('category', [None])[0]
            search = query_params.get('search', [None])[0]
            
            print(f"Phone contacts request - category: {category}, search: {search}")  # Debug log
            
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
                
                if category and category != 'all':
                    query += ' AND cat.name = ?'
                    params.append(category)
                    
                if search:
                    query += ' AND (c.name LIKE ? OR c.role LIKE ? OR c.phone_number LIKE ?)'
                    search_param = f'%{search}%'
                    params.extend([search_param, search_param, search_param])
                
                print(f"Executing query: {query} with params: {params}")  # Debug log
                
                cursor.execute(query, params)
                contacts = cursor.fetchall()
                
                # Convert rows to dictionaries
                contacts_list = []
                columns = [col[0] for col in cursor.description]
                for row in contacts:
                    contact_dict = dict(zip(columns, row))
                    contacts_list.append(contact_dict)
                
                print(f"Found {len(contacts_list)} contacts")  # Debug log
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(contacts_list).encode())
                
        except Exception as e:
            print(f"Error handling contacts request: {str(e)}")
            print("Detailed error information:")
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

def run_server():
    port = 8000
    server_address = ('', port)
    
    try:
        # Check if port is already in use
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', port))
        if result == 0:
            print(f"Error: Port {port} is already in use.")
            print("Attempting to kill existing process...")
            import os
            os.system('pkill -f "python3 server.py"')
            print("Waiting for port to be released...")
            import time
            time.sleep(2)
        sock.close()
        
        # Start server
        print(f"Starting server on port {port}...")
        httpd = HTTPServer(server_address, RequestHandler)
        print(f"Server is running at http://localhost:{port}")
        httpd.serve_forever()
    except Exception as e:
        print(f"Error starting server: {str(e)}")
        print("Detailed error information:")
        import traceback
        traceback.print_exc()
        
        if isinstance(e, OSError):
            if e.errno == 48:  # Address already in use
                print(f"\nPort {port} is already in use.")
                print("Try one of the following:")
                print("1. Close any other running instances of the server")
                print("2. Wait a few seconds and try again")
                print("3. Change the port number in the code")
            elif e.errno == 13:  # Permission denied
                print("\nPermission denied when trying to bind to port.")
                print("Try running with sudo or choose a port number above 1024")
        return

@contextmanager
def get_db_connection():
    conn = sqlite3.connect('data/phonebook.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

if __name__ == '__main__':
    run_server() 