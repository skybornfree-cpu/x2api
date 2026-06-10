from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from collector.rb91_source import (
    parse_detail_page,
    parse_list_page,
    parse_query_expiry,
    reject_ad_url,
    verify_hls_url,
)


class Rb91SourceTest(unittest.TestCase):
    def test_parse_list_page_extracts_latest_update_items(self):
        html = """
        <html>
          <body>
            <div id="list_videos_latest_videos_list_items">
              <a href="/videos/319962/example-slug/" title="Real Video Title">
                <img data-original="/contents/videos_screenshots/319000/319962/preview.jpg">
                <span class="time">12:34</span>
              </a>
              <a href="/videos/319962/example-slug/" title="duplicate"></a>
              <a href="/other/ignore/" title="ignore"></a>
            </div>
          </body>
        </html>
        """

        with patch("collector.rb91_source.fetch_html", return_value=html):
            items = parse_list_page("https://www.91rb.com/latest-updates/", 1)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["guid"], "91rb:319962")
        self.assertEqual(items[0]["video_id"], "319962")
        self.assertEqual(items[0]["slug"], "example-slug")
        self.assertEqual(items[0]["title"], "Real Video Title")
        self.assertEqual(items[0]["duration"], 754)
        self.assertEqual(items[0]["image"], "https://www.91rb.com/contents/videos_screenshots/319000/319962/preview.jpg")

    def test_parse_detail_page_rejects_trial_limit_without_public_media(self):
        detail_html = """
        <html>
          <body>
            <div id="limitplayer">试看已达上限</div>
          </body>
        </html>
        """

        def fake_fetch_html(url: str, _referer: str | None = None) -> str:
            return "" if "/embed/" in url else detail_html

        with patch("collector.rb91_source.fetch_html", side_effect=fake_fetch_html):
            with self.assertRaisesRegex(ValueError, "trial limit"):
                parse_detail_page("https://www.91rb.com/videos/319962/example-slug/")

    def test_parse_query_expiry_reads_epoch_t_query(self):
        self.assertEqual(
            parse_query_expiry("https://delivery.example/index.m3u8?k=abc&t=1781076186"),
            datetime(2026, 6, 10, 7, 23, 6, tzinfo=timezone.utc),
        )

    def test_verify_hls_url_marks_expiring_playlists_refreshable(self):
        playlist = """#EXTM3U
#EXT-X-TARGETDURATION:8
#EXTINF:8.0,
segment-1.ts?t=1781076186
#EXTINF:8.0,
segment-2.ts?t=1781076186
#EXT-X-ENDLIST
"""
        ts_chunk = b"\x47" + (b"\x00" * 187) + b"\x47" + (b"\x00" * 187)

        with patch("collector.rb91_source.fetch_text", return_value=playlist):
            with patch("collector.rb91_source.read_media_chunk", return_value=(ts_chunk, object())):
                with patch("collector.rb91_source.now_utc", return_value=datetime(2026, 6, 10, 0, 0, tzinfo=timezone.utc)):
                    verified = verify_hls_url(
                        "https://delivery.example/index.m3u8?k=abc&t=1781076186",
                        "https://www.91rb.com/videos/319962/example-slug/",
                    )

        self.assertEqual(verified["media_format"], "hls")
        self.assertTrue(verified["playback_refresh_required"])
        self.assertEqual(
            verified["playback_headers"],
            {
                "Referer": "https://www.91rb.com/videos/319962/example-slug/",
                "Origin": "https://www.91rb.com",
            },
        )
        self.assertEqual(verified["video_url_expires_at"], datetime(2026, 6, 10, 7, 23, 6, tzinfo=timezone.utc))

    def test_reject_ad_url_blocks_known_tracking_hosts(self):
        with self.assertRaisesRegex(ValueError, "ad host"):
            reject_ad_url("https://sstatic1.histats.com/0.gif")


if __name__ == "__main__":
    unittest.main()
