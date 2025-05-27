from http.server import HTTPServer, SimpleHTTPRequestHandler
import requests
from urllib.parse import urlparse, parse_qs
import sys
import signal
import socket
import os
import json
import urllib.request
import csv
from io import StringIO

class RequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urlparse(self.path)
        query_params = parse_qs(parsed_url.query)
        
        if parsed_url.path == "/api/schedule":
            day = query_params.get("day", [""])[0]
            month = query_params.get("month", [""])[0]
            year = query_params.get("year", [""])[0]
            
            # Base URL with required parameters
            amion_url = "http://www.amion.com/cgi-bin/ocs?Lo=mghsurgery1811&Rpt=619"
            
            # Add date parameters if provided
            if day and month and year:
                amion_url += f"&Day={day}&Month={month}&Year={year}"
            
            print(f"Fetching data from: {amion_url}")
            
            try:
                response = requests.get(amion_url)
                self.send_response(200)
                self.send_header("Content-type", "text/plain")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(response.content)
            except Exception as e:
                print(f"Error fetching schedule: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"Error fetching schedule")
            return
            
        return SimpleHTTPRequestHandler.do_GET(self)

    def log_message(self, format, *args):
        """Log messages to stderr."""
        print(f"{self.address_string()} - - [{self.log_date_time_string()}] {format%args}", file=sys.stderr)

def signal_handler(sig, frame):
    print('\nShutting down server...')
    try:
        httpd.server_close()
    except:
        pass
    sys.exit(0)

if __name__ == '__main__':
    server_address = ('', 8000)
    
    # Allow socket reuse
    HTTPServer.allow_reuse_address = True
    
    try:
        httpd = HTTPServer(server_address, RequestHandler)
        print(f'Starting server on port {server_address[1]}...')
        
        # Set up signal handlers
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        httpd.serve_forever()
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print('Port 8000 is in use. Attempting to kill existing process...')
            os.system('lsof -i :8000 | grep LISTEN | awk \'{print $2}\' | xargs kill -9 2>/dev/null')
            print('Retrying server start...')
            httpd = HTTPServer(server_address, RequestHandler)
            httpd.serve_forever()
        else:
            raise
    except KeyboardInterrupt:
        print('\nShutting down server...')
        httpd.server_close()
        sys.exit(0) 