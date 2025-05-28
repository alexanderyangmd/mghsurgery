from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import urllib.request
import csv
from io import StringIO
from datetime import datetime
import os
import base64

# Password for authentication
PASSWORD = "mgh"

class RequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Override to provide minimal logging
        if args[0].startswith('GET /api/'):
            print(f"{self.address_string()} - API request: {args[0]}")
        elif args[0].startswith('GET /verify'):
            print(f"{self.address_string()} - Verify request")
        else:
            print(f"{self.address_string()} - {args[0]}")

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

        # Handle different API endpoints
        if base_path == '/api/schedule':
            self.handle_schedule_request(day, month, year)
        elif base_path == '/api/churchill':
            self.handle_churchill_request(day, month, year)
        elif base_path == '/api/vascular':
            self.handle_vascular_request(day, month, year)
        else:
            self.send_error(404)

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

def run_server():
    port = 8000
    server_address = ('', port)
    
    try:
        httpd = HTTPServer(server_address, RequestHandler)
        print(f"Starting server on port {port}...")
        httpd.serve_forever()
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"Error: Port {port} is already in use. Try killing the existing process or using a different port.")
        else:
            print(f"Error starting server: {e}")

if __name__ == '__main__':
    run_server() 