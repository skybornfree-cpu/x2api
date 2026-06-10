from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from collector.dirtyship_source import (
    DIRTYSHIP_STABLE_VIDEO_URL_EXPIRES_AT,
    parse_detail_page,
    parse_list_page,
    parse_query_expiry,
    reject_ad_url,
    verify_direct_video_url,
)


class FakeResponse:
    status_code = 206

    def __init__(self, headers: dict[str, str] | None = None):
        self.headers = headers or {"Content-Type": "video/mp4", "Content-Range": "bytes 0-4095/123456"}


class DirtyShipSourceTest(unittest.TestCase):
    def test_parse_list_page_extracts_latest_items(self):
        html = """
        <html>
          <body>
            <ul class="Thumbnail_List">
              <li class="thumi">
                <a id="preview_image" href="/sample-video/" title="Real Video">
                  <img data-src="/wp-content/uploads/cover.jpg" alt="Cover alt">
                </a>
              </li>
              <li class="thumi">
                <a id="preview_image" href="/sample-video/" title="duplicate"></a>
              </li>
              <li class="thumi">
                <a href="/tag/ignore/" title="ignore"></a>
              </li>
            </ul>
          </body>
        </html>
        """

        with patch("collector.dirtyship_source.fetch_html", return_value=html):
            items = parse_list_page("https://dirtyship.com", 1)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["guid"], "dirtyship:sample-video")
        self.assertEqual(items[0]["detail_id"], "sample-video")
        self.assertEqual(items[0]["title"], "Real Video")
        self.assertEqual(items[0]["url"], "https://dirtyship.com/sample-video/")
        self.assertEqual(items[0]["image"], "https://dirtyship.com/wp-content/uploads/cover.jpg")

    def test_parse_detail_page_extracts_media_and_ignores_ad_iframes(self):
        detail_html = """
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "Article",
                "headline": "Article Title",
                "datePublished": "2026-06-10T01:02:03Z",
                "dateModified": "2026-06-10T02:03:04Z",
                "thumbnailUrl": "https://dirtyship.com/thumb.jpg",
                "keywords": ["tag-a", "tag-b"]
              }
            </script>
          </head>
          <body>
            <h1 class="singletitle">Fallback Title</h1>
            <iframe src="https://a.adtng.com/get/100000"></iframe>
            <video controls poster="/poster.jpg">
              <source src="https://cdn6.dirtyship.net/cdn3/sample-video.mp4" type="video/mp4">
              <source src="https://cdn6.dirtyship.net/cdn3/sample-video.mp4" type="video/mp4">
            </video>
          </body>
        </html>
        """

        with patch("collector.dirtyship_source.fetch_html", return_value=detail_html):
            detail = parse_detail_page("https://dirtyship.com/sample-video/")

        self.assertEqual(detail["detail_id"], "sample-video")
        self.assertEqual(detail["title"], "Article Title")
        self.assertEqual(detail["published_at"], datetime(2026, 6, 10, 1, 2, 3, tzinfo=timezone.utc))
        self.assertEqual(detail["tags"], ["tag-a", "tag-b"])
        self.assertEqual(len(detail["players"]), 1)
        self.assertEqual(detail["players"][0]["video_url"], "https://cdn6.dirtyship.net/cdn3/sample-video.mp4")
        self.assertEqual(detail["players"][0]["video_type"], "direct")
        self.assertEqual(detail["players"][0]["referer"], "https://dirtyship.com/sample-video/")

    def test_verify_direct_video_url_stores_referer_headers_for_static_mp4(self):
        with patch(
            "collector.dirtyship_source.read_media_chunk",
            return_value=(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64, FakeResponse()),
        ):
            verified = verify_direct_video_url(
                "https://cdn6.dirtyship.net/cdn3/sample-video.mp4",
                "https://dirtyship.com/sample-video/",
            )

        self.assertEqual(verified["media_format"], "direct")
        self.assertFalse(verified["playback_refresh_required"])
        self.assertEqual(verified["video_url_expires_at"], DIRTYSHIP_STABLE_VIDEO_URL_EXPIRES_AT)
        self.assertEqual(
            verified["playback_headers"],
            {
                "Referer": "https://dirtyship.com/sample-video/",
                "Origin": "https://dirtyship.com",
            },
        )

    def test_verify_direct_video_url_marks_expiring_mp4_refreshable(self):
        with patch(
            "collector.dirtyship_source.read_media_chunk",
            return_value=(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64, FakeResponse()),
        ):
            with patch("collector.dirtyship_source.now_utc", return_value=datetime(2026, 6, 10, 0, 0, tzinfo=timezone.utc)):
                verified = verify_direct_video_url(
                    "https://cdn6.dirtyship.net/cdn3/sample-video.mp4?e=1781076186",
                    "https://dirtyship.com/sample-video/",
                )

        self.assertTrue(verified["playback_refresh_required"])
        self.assertEqual(verified["video_url_expires_at"], datetime(2026, 6, 10, 7, 23, 6, tzinfo=timezone.utc))

    def test_parse_query_expiry_returns_none_without_expiry_query(self):
        self.assertIsNone(parse_query_expiry("https://cdn6.dirtyship.net/cdn3/sample-video.mp4"))

    def test_reject_ad_url_blocks_known_ad_hosts(self):
        with self.assertRaisesRegex(ValueError, "ad host"):
            reject_ad_url("https://a.adtng.com/get/100000")


if __name__ == "__main__":
    unittest.main()
