from http.server import HTTPServer, SimpleHTTPRequestHandler
import requests
from urllib.parse import urlparse, parse_qs
import sys

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

if __name__ == "__main__":
    try:
        server_address = ("", 8000)
        httpd = HTTPServer(server_address, RequestHandler)
        print(f"Server running on port {server_address[1]}...", file=sys.stderr)
        httpd.serve_forever()
    except Exception as e:
        print(f"Server error: {str(e)}", file=sys.stderr)
        sys.exit(1) 