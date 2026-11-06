"""Serve only the self-contained example page on loopback; no API proxy or directory listing."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import argparse
import subprocess
import threading


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('page', type=Path)
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    page = args.page.resolve(strict=True)
    if page.suffix != '.html':
        raise ValueError('미리보기 HTML 파일을 선택해 주세요.')
    payload = page.read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.respond(False)

        def do_HEAD(self):
            self.respond(True)

        def respond(self, head):
            if self.path.split('?', 1)[0] not in ('/', '/index.html'):
                self.send_error(404)
                return
            # Read on each request so visual fixes can be verified with refresh.
            body = page.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            if not head:
                self.wfile.write(body)

        def log_message(self, *_args):
            pass

    # Existing service ports 5207/18086/15216 and all their processes are untouched.
    with HTTPServer(('127.0.0.1', 5218), Handler) as server:
        print('보호자 웹 디자인 미리보기: http://127.0.0.1:5218/#/dashboard', flush=True)
        print(f'예시 화면1개만 제공 · {len(payload)}bytes · API 연결/유료 호출/DB 변경0', flush=True)
        print('이 창만 유지하세요. Control+C는 이 미리보기 서버만 종료합니다.', flush=True)
        if args.open:
            threading.Timer(.3, lambda: subprocess.run(['/usr/bin/open', 'http://127.0.0.1:5218/#/dashboard'], check=False)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    try:
        main()
    except OSError as error:
        print('미리보기 서버를 시작하지 못했습니다:', error, flush=True)
        raise SystemExit(1)
