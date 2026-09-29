"""Local preview with byte-range support for native media seeking."""
import argparse
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REDIRECTS = {
    '/hanuman-chalisa.html': '/stotra/hanuman-chalisa/',
    '/aditya-hridayam.html': '/stotra/aditya-hridayam/',
    '/sri-suktam.html': '/stotra/sri-suktam/',
    '/bajrang-baan.html': '/stotra/bajrang-baan/',
    '/divine-names.html': '/stotra/divine-names/',
    '/ganapati-atharvashirsha.html': '/stotra/ganapati-atharvashirsha/',
    '/rudrashtakam.html': '/stotra/rudrashtakam/',
    '/shiva-tandava-stotram.html': '/stotra/shiva-tandava-stotram/',
    '/nirvana-shatkam.html': '/stotra/nirvana-shatkam/',
    '/bhaja-govindam.html': '/stotra/bhaja-govindam/',
    '/bhagavad-gita-chapter-1.html': '/gita/1/',
    '/bhagavad-gita-chapter-2.html': '/gita/2/',
    '/bhagavad-gita-chapter-3.html': '/gita/3/',
    '/vishnu-sahasranamam.html': '/vishnu-sahasranama/',
    '/vishnu-sahasranama-videos.html': '/vishnu-sahasranama/guide/',
    '/verify.html': '/tools/verify/',
}

class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        request_path = self.path.split('?', 1)[0]
        target = REDIRECTS.get(request_path)
        verse = re.fullmatch(r'/vishnu-sahasranam-verses/verse-(\d+)\.html', request_path)
        if verse:
            target = f'/vishnu-sahasranama/verse/{verse.group(1)}/'
        if target:
            self.send_response(301)
            self.send_header('Location', target)
            self.end_headers()
            return None
        self.byte_range = None
        path = self.translate_path(self.path)
        if not path.lower().endswith('.mp3') or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        start, end = 0, size - 1
        requested = self.headers.get('Range')
        if requested:
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
            if not match or not any(match.groups()):
                self.send_error(416)
                return None
            first, last = match.groups()
            if first:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
            else:
                start = max(0, size - int(last))
            if start > end or start >= size:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return None
        self.send_response(206 if requested else 200)
        self.send_header('Content-Type', 'audio/mpeg')
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(end-start+1))
        if requested:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        file = open(path, 'rb')
        file.seek(start)
        self.byte_range = end-start+1
        return file

    def copyfile(self, source, outputfile):
        if self.byte_range is None:
            return super().copyfile(source, outputfile)
        remaining = self.byte_range
        try:
            while remaining:
                block = source.read(min(64*1024, remaining))
                if not block: break
                outputfile.write(block)
                remaining -= len(block)
        except (BrokenPipeError, ConnectionResetError):
            pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=43128)
    args = parser.parse_args()
    os.chdir(Path(__file__).resolve().parents[2])
    ThreadingHTTPServer.allow_reuse_address = False
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Preview: http://127.0.0.1:{args.port}/', flush=True)
    server.serve_forever()
