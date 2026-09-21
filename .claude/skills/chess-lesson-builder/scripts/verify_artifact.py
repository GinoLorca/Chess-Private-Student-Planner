#!/usr/bin/env python3
"""Extract the <script> block from a lesson-artifact HTML file and syntax-check
it with `node --check`. This is the fast, cheap check to run after every edit,
before spending a Playwright screenshot on it.

Usage: python3 verify_artifact.py path/to/lesson-planner-gold.html
Exit code 0 = valid JS. Non-zero = syntax error (message printed by node).
"""
import re
import subprocess
import sys
import tempfile
import os

def main():
    if len(sys.argv) != 2:
        print("usage: verify_artifact.py <html-file>", file=sys.stderr)
        sys.exit(2)

    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        html = f.read()

    m = re.search(r"<script>(.*)</script>", html, re.S)
    if not m:
        print(f"no <script>...</script> block found in {path}", file=sys.stderr)
        sys.exit(2)

    fd, tmp_path = tempfile.mkstemp(suffix=".js")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(m.group(1))
        result = subprocess.run(["node", "--check", tmp_path], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"OK: {path} — script block is valid JavaScript")
        else:
            print(f"SYNTAX ERROR in {path}:", file=sys.stderr)
            print(result.stderr, file=sys.stderr)
        sys.exit(result.returncode)
    finally:
        os.unlink(tmp_path)

if __name__ == "__main__":
    main()
