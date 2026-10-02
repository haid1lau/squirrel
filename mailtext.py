"""
mailtext.py

Turns an HTML email body into readable plain text for the AI model. Shared by
the Gmail (google_api.py) and IMAP (imap_sync.py) readers.
"""

import re
from html.parser import HTMLParser


class _TextFromHtml(HTMLParser):
    _SKIP = {"script", "style", "head", "title"}
    _BREAK = {"br", "p", "div", "tr", "li", "h1", "h2", "h3", "h4", "table"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag in self._BREAK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if not self._skip_depth:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    parser = _TextFromHtml()
    parser.feed(html)
    text = "".join(parser.parts)
    text = re.sub(r"[ \t\r\f\v ‌]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()
