from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.parse
from urllib.error import URLError
import json
from datetime import datetime
import ssl
import os

class RequestHandler(BaseHTTPRequestHandler):
    def send_file(self, filename, content_type='text/html'):
        try:
            with open(filename, 'rb') as f:
                content = f.read()
                self.send_response(200)
                self.send_header('Content-type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
        except FileNotFoundError:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        # Parse URL and query parameters
        parsed_path = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_path.query)

        # Handle static files and root path
        if parsed_path.path == '/' or parsed_path.path == '/index.html':
            return self.send_file('index.html')
        elif parsed_path.path.endswith('.css'):
            return self.send_file(parsed_path.path[1:], 'text/css')
        elif parsed_path.path.endswith('.js'):
            return self.send_file(parsed_path.path[1:], 'application/javascript')
        
        # Set CORS headers for API routes
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-type', 'text/plain')
        self.end_headers()

        # Extract date parameters
        day = query_params.get('day', [''])[0]
        month = query_params.get('month', [''])[0]
        year = query_params.get('year', [''])[0]

        try:
            if parsed_path.path == '/api/schedule':
                # For mghsurgery URL, we need to use the previous year (2024) to get 2025 schedule
                amion_url = f'http://www.amion.com/cgi-bin/ocs?Lo=mghsurgery1811&Rpt=619&Day={day}&Month={month}&Year=2024'
            elif parsed_path.path == '/api/churchill':
                # For Churchill URL, use the current year (2025)
                amion_url = f'http://www.amion.com/cgi-bin/ocs?Lo=Churchill&Rpt=619&Day={day}&Month={month}&Year=2025'
            else:
                self.send_response(404)
                self.end_headers()
                return

            print(f'Fetching data from: {amion_url}')
            
            # Create SSL context that ignores certificate verification
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            
            # Make the request to Amion
            with urllib.request.urlopen(amion_url, context=context) as response:
                data = response.read().decode('utf-8')
                print('Received CSV data:', data)
                self.wfile.write(data.encode())

        except URLError as e:
            print(f'Error fetching data: {e}')
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'Error fetching schedule data')
        except Exception as e:
            print(f'Unexpected error: {e}')
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'Internal server error')

def run(server_class=HTTPServer, handler_class=RequestHandler, port=8000):
    server_address = ('', port)
    try:
        httpd = server_class(server_address, handler_class)
        print(f'Starting server on port {port}...')
        httpd.serve_forever()
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f'Error: Port {port} is already in use. Try killing the existing process or using a different port.')
        else:
            print(f'Error starting server: {e}')
    except KeyboardInterrupt:
        print('\nShutting down server...')
        httpd.server_close()

if __name__ == '__main__':
    run() 