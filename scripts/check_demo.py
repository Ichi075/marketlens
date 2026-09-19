from html.parser import HTMLParser
from pathlib import Path
import subprocess


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and not dict(attrs).get("src"):
            self.inside = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.inside = False

    def handle_data(self, data):
        if self.inside:
            self.parts.append(data)


file = Path(__file__).resolve().parents[1] / "demo.html"
parser = Scripts()
parser.feed(file.read_text(encoding="utf-8"))
assert parser.parts, "No inline demo script found"
result = subprocess.run(
    ["node", "--check", "-"],
    input="\n".join(parser.parts),
    text=True,
    encoding="utf-8",
    capture_output=True,
    check=False,
)
if result.returncode:
    raise SystemExit(result.stderr)
print(f"demo.html: inline JavaScript syntax OK ({len(parser.parts)} script block)")
