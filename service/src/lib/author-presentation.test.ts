import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthorPresentation, resolveAuthorPresentation } from "@/lib/author-presentation";

test("buildAuthorPresentation returns X profile only for twitter sources", () => {
  assert.deepEqual(
    buildAuthorPresentation({
      source: "twitter",
      target: "search:AI",
      author: "@openai",
      fullname: "OpenAI",
      xUrl: "https://x.com/openai/status/1",
    }),
    {
      displayAuthor: "OpenAI",
      displayHandle: "@openai",
      authorProfileUrl: "https://x.com/openai",
      authorProfilePlatform: "X",
    },
  );
});

test("buildAuthorPresentation uses item detail links for site sources", () => {
  const cases = [
    ["heiliao", "黑料", "https://among.uvsoskqus.cc/archives/1"],
    ["cg91", "91吃瓜", "https://www.91cg1.com/post/1"],
    ["baoliao51", "51爆料", "https://www.51baoliao01.com/archives/1"],
    ["douyin", "抖阴", "https://xygrfrfb3g.b2h7y8w.com/recommend/?id=1"],
    ["18mh", "禁漫天堂", "https://18mh.net/mv/detail/1"],
    ["rou", "肉視頻", "https://rou.video/v/video-1"],
    ["dadaafa", "DadaAFA", "https://dadaafa.cc/play/1O7BBW/video?utm_source=xx"],
    ["18j", "18J.TV", "https://18j.tv/v/37590/"],
    ["1mtif", "蜜桃视频", "https://1mtif.sbs/play/K2118Pwl"],
    ["tikporn", "Tik.Porn", "https://tik.porn/video/1529368"],
    ["91porna", "91porna", "https://91porna.com/comic/index/detail?video_key=346951"],
    ["91porn", "91porn", "https://91porn.com/view_video.php?viewkey=abc123"],
    ["91rb", "91热爆", "https://www.91rb.com/videos/319962/example/"],
    ["badnews", "Bad.news", "https://bad.news/t/6227046"],
    ["bdrq", "背德人妻", "https://g3h4i5j6.bdrq45.cc/voddetail/769512.html"],
    ["avgood", "AvGood", "https://avgood.com/c/663855.html"],
    ["705hs", "992KP", "https://705hs.com/Html/91/50710.html"],
    ["xxxtik", "xxxtik", "https://xxxtik.com/post/example"],
    ["dirtyship", "DirtyShip", "https://dirtyship.com/sample-video/"],
  ] as const;

  for (const [source, platform, link] of cases) {
    assert.deepEqual(
      buildAuthorPresentation({
        source,
        target: `${source}:https://example.com`,
        author: `${platform}网`,
        fullname: `${platform}网`,
        link,
      }),
      {
        displayAuthor: `${platform}网`,
        displayHandle: null,
        authorProfileUrl: link,
        authorProfilePlatform: platform,
      },
    );
  }
});

test("buildAuthorPresentation does not use site target homepages as item links", () => {
  assert.deepEqual(
    buildAuthorPresentation({
      source: "91",
      target: "cg91:https://www.91cg1.com",
      author: "91吃瓜网",
      fullname: "91吃瓜网",
    }),
    {
      displayAuthor: "91吃瓜网",
      displayHandle: null,
      authorProfileUrl: null,
      authorProfilePlatform: null,
    },
  );
});

test("buildAuthorPresentation returns YouTube profile for YouTube sources", () => {
  assert.deepEqual(
    buildAuthorPresentation({
      source: "youtube",
      target: "youtube:https://www.youtube.com/feeds/videos.xml?channel_id=UC12345678901234567890",
      author: "Channel",
      fullname: "Channel",
      link: "https://www.youtube.com/watch?v=abc123",
    }),
    {
      displayAuthor: "Channel",
      displayHandle: null,
      authorProfileUrl: "https://www.youtube.com/channel/UC12345678901234567890",
      authorProfilePlatform: "YouTube",
    },
  );
});

test("buildAuthorPresentation normalizes source aliases before presentation", () => {
  assert.deepEqual(
    buildAuthorPresentation({
      source: "x",
      target: "search:AI",
      author: "@openai",
      fullname: "OpenAI",
    }),
    {
      displayAuthor: "OpenAI",
      displayHandle: "@openai",
      authorProfileUrl: "https://x.com/openai",
      authorProfilePlatform: "X",
    },
  );

  assert.deepEqual(
    buildAuthorPresentation({
      source: "yt",
      target: "youtube:UC12345678901234567890",
      author: "Channel",
      fullname: "Channel",
    }),
    {
      displayAuthor: "Channel",
      displayHandle: null,
      authorProfileUrl: "https://www.youtube.com/channel/UC12345678901234567890",
      authorProfilePlatform: "YouTube",
    },
  );
});

test("resolveAuthorPresentation prefers stored presentation fields", () => {
  assert.deepEqual(
    resolveAuthorPresentation({
      source: "twitter",
      target: "search:AI",
      author: "@openai",
      fullname: "OpenAI",
      displayAuthor: "Stored Author",
      displayHandle: "@stored",
      authorProfileUrl: "https://x.com/stored",
      authorProfilePlatform: "Stored",
    }),
    {
      displayAuthor: "Stored Author",
      displayHandle: "@stored",
      authorProfileUrl: "https://x.com/stored",
      authorProfilePlatform: "Stored",
    },
  );
});
