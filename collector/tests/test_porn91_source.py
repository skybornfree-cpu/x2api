from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from urllib.parse import quote

from bs4 import BeautifulSoup

from collector.porn91_source import extract_video_source, parse_detail_page, parse_query_expiry, reject_ad_url


class Porn91SourceTest(unittest.TestCase):
    def test_extract_video_source_uses_encoded_source_not_preroll_ad(self):
        real_url = "https://media.example/video.mp4?e=1780987773"
        encoded_source = quote(f'<source src="{real_url}" type="video/mp4">')
        html = f"""
        <html>
          <body>
            <script>
              player.preroll({{src: {{src: "https://s1.kwai.net/ad.mp4"}}}});
              document.write(strencode2("{encoded_source}"));
            </script>
          </body>
        </html>
        """

        source = extract_video_source(BeautifulSoup(html, "html.parser"), "https://91porn.com/view_video.php?viewkey=abc")

        self.assertEqual(source, {"video_url": real_url, "video_type": "mp4"})

    def test_reject_ad_url_blocks_known_preroll_host(self):
        with self.assertRaisesRegex(ValueError, "ad host"):
            reject_ad_url("https://s1.kwai.net/ad.mp4")

    def test_parse_query_expiry_reads_epoch_query(self):
        self.assertEqual(
            parse_query_expiry("https://media.example/video.mp4?e=1780987773"),
            datetime(2026, 6, 9, 6, 49, 33, tzinfo=timezone.utc),
        )

    def test_parse_detail_page_uses_title_as_description_not_ad_text(self):
        html = """
        <html>
          <head><title>fallback - 91porn</title></head>
          <body>
            <div class="video-border">
              <h4 class="login_register_header">
                <img src="/logo.png"> Real Video Title
              </h4>
            </div>
            <div id="v_desc">广告推广内容</div>
            <video poster="/poster.jpg">
              <source src="https://media.example/video.mp4?e=1780987773" type="video/mp4">
            </video>
          </body>
        </html>
        """

        with patch("collector.porn91_source.fetch_html", return_value=html):
            detail = parse_detail_page("https://91porn.com/view_video.php?viewkey=abc123")

        self.assertEqual(detail["title"], "Real Video Title")
        self.assertEqual(detail["description"], "Real Video Title")


if __name__ == "__main__":
    unittest.main()
