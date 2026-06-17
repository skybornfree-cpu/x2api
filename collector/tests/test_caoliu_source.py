from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from collector import caoliu_source as caoliu
from collector.twitter_monitor import parse_target_value


class CaoliuSourceTests(unittest.TestCase):
    def test_parse_list_page_extracts_html_thread_rows(self):
        html = """
        <html><body>
        <table id="ajaxtable">
          <tr class="tr3 t_one tac">
            <td><span class='s3'>182</span></td>
            <td class="tal">
              <h3><a href="/htm_data/2605/16/344501.html" target="_blank" id="t344501">各类图片及视频上传的图床更新</a></h3>
            </td>
            <td>
              <a class="bl">lj413025</a>
              <div class="f12"><span title="2009-07-21 21:19" data-timestamp="1248182350s">16 年前</span></div>
            </td>
            <td>1744</td>
            <td><a class="f10" data-timestamp="1780972145">06-09 10:29</a></td>
          </tr>
        </table>
        </body></html>
        """

        with patch.object(caoliu, "fetch_html", return_value=html):
            items = caoliu.parse_list_page("https://t66y.com/thread0806.php?fid=16", 1)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["guid"], "caoliu:344501")
        self.assertEqual(items[0]["url"], "https://t66y.com/htm_data/2605/16/344501.html")
        self.assertEqual(items[0]["author"], "lj413025")
        self.assertEqual(items[0]["published_at"], datetime(2009, 7, 21, 13, 19, 10, tzinfo=timezone.utc))

    def test_parse_detail_page_extracts_first_floor_images_and_direct_video(self):
        html = """
        <html><head>
          <title>示例帖子 - 達蓋爾的旗幟 | 草榴社區 - t66y.com</title>
        </head><body>
          <div class="t t2">
            <table><tr class="tr1 do_not_catch">
              <th rowspan="2"><b>楼主名字</b></th>
              <th>
                <div class="tiptop"><a href="../../../show.php?uid=123">資料</a></div>
                <h4 class="f16">示例帖子</h4>
                <br />
                <div class="tpc_content do_not_catch" id="conttpc">
                  <div class="tips">本帖被编辑</div>
                  正文第一段<br />
                  <a target="_blank" href="https://cdn.example.test/video.mp4">视频</a><br />
                  <img iyl-data="http://a.d/adblo_ck.jpg" ess-data="https://img.example.test/a.jpg" />
                  <img src="https://img.example.test/b.jpg" />
                </div>
              </th>
            </tr>
            <tr class="tr1">
              <th><div class="tipad">Posted: <span data-timestamp="1777304501">04-27 23:41</span></div></th>
            </tr></table>
          </div>
          <span class='gray f12'>此貼由楼主重新編輯：2026-04-21 14:03</span>
        </body></html>
        """

        with patch.object(caoliu, "fetch_html", return_value=html):
            detail = caoliu.parse_detail_page("https://t66y.com/htm_data/2604/16/7299919.html")

        self.assertEqual(detail["guid"], "caoliu:7299919")
        self.assertEqual(detail["title"], "示例帖子")
        self.assertEqual(detail["author"], "楼主名字")
        self.assertEqual(detail["video_url"], "https://cdn.example.test/video.mp4")
        self.assertEqual(detail["video_type"], "direct")
        self.assertEqual(detail["video_variants"][0]["variant_key"], "https://cdn.example.test/video.mp4")
        self.assertEqual(detail["images"], ["https://img.example.test/a.jpg", "https://img.example.test/b.jpg"])
        self.assertEqual(detail["published_at"], datetime(2026, 4, 27, 15, 41, 41, tzinfo=timezone.utc))
        self.assertEqual(detail["modified_at"], datetime(2026, 4, 21, 6, 3, tzinfo=timezone.utc))

    def test_parse_target_value_supports_caoliu_prefix_and_url(self):
        prefixed = parse_target_value("caoliu:https://t66y.com/thread0806.php?fid=16")
        self.assertEqual(prefixed["source"], "caoliu")
        self.assertEqual(prefixed["kind"], "site")

        by_url = parse_target_value("https://t66y.com/thread0806.php?fid=16")
        self.assertEqual(by_url["source"], "caoliu")
        self.assertEqual(by_url["normalized_value"], "t66y.com:16")


if __name__ == "__main__":
    unittest.main()
