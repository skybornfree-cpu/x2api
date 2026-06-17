import assert from "node:assert/strict";
import test from "node:test";

import { formatTarget, parseTarget, parseTargets } from "@/lib/targets";

test("parseTarget understands user targets", () => {
  assert.deepEqual(parseTarget("OpenAI"), {
    source: "twitter",
    kind: "user",
    value: "OpenAI",
    normalizedValue: "openai",
    tags: [],
  });
});

test("parseTarget understands keyword targets", () => {
  assert.deepEqual(parseTarget("search:AI Safety"), {
    source: "twitter",
    kind: "keyword",
    value: "AI Safety",
    normalizedValue: "ai safety",
    tags: [],
  });
});

test("parseTargets rejects caoliu as a frontend subscription source", () => {
  assert.throws(
    () =>
      parseTargets([
        {
          source: "caoliu",
          kind: "site",
          target: "https://t66y.com/thread0806.php?fid=16",
          category: "adult",
        },
      ]),
    /Unsupported target source\./,
  );
});

test("parseTarget understands YouTube channel targets", () => {
  assert.deepEqual(parseTarget("youtube:UCE_M8A5yxnLfW0KghEeajjw"), {
    source: "youtube",
    kind: "channel",
    value: "UCE_M8A5yxnLfW0KghEeajjw",
    normalizedValue: "uce_m8a5yxnlfw0kgheeajjw",
    tags: [],
  });
});

test("parseTarget understands YouTube feed URLs", () => {
  assert.deepEqual(parseTarget("youtube:https://www.youtube.com/feeds/videos.xml?channel_id=UC1QxOK5YpyAyFCN_xiPfgHw"), {
    source: "youtube",
    kind: "channel",
    value: "UC1QxOK5YpyAyFCN_xiPfgHw",
    normalizedValue: "uc1qxok5ypyayfcn_xipfghw",
    tags: [],
  });
});

test("parseTarget understands plain YouTube feed URLs", () => {
  assert.deepEqual(parseTarget("https://www.youtube.com/feeds/videos.xml?user=CaspianReport"), {
    source: "youtube",
    kind: "channel",
    value: "https://www.youtube.com/feeds/videos.xml?user=CaspianReport",
    normalizedValue: "https://www.youtube.com/feeds/videos.xml?user=caspianreport",
    tags: [],
  });
});

test("parseTarget understands Heiliao site targets", () => {
  assert.deepEqual(parseTarget("heiliao:https://among.uvsoskqus.cc/"), {
    source: "heiliao",
    kind: "site",
    value: "https://among.uvsoskqus.cc",
    normalizedValue: "among.uvsoskqus.cc",
    tags: [],
  });
});

test("parseTarget understands 91cg site targets", () => {
  assert.deepEqual(parseTarget("cg91:https://www.91cg1.com/"), {
    source: "cg91",
    kind: "site",
    value: "https://www.91cg1.com",
    normalizedValue: "www.91cg1.com",
    tags: [],
  });
});

test("parseTarget understands 51baoliao site targets", () => {
  assert.deepEqual(parseTarget("baoliao51:https://www.51baoliao01.com/category/jrbl/"), {
    source: "baoliao51",
    kind: "site",
    value: "https://www.51baoliao01.com/category/jrbl/",
    normalizedValue: "www.51baoliao01.com",
    tags: [],
  });
});

test("parseTarget understands Douyin site targets", () => {
  assert.deepEqual(parseTarget("douyin:https://xygrfrfb3g.b2h7y8w.com/"), {
    source: "douyin",
    kind: "site",
    value: "https://xygrfrfb3g.b2h7y8w.com",
    normalizedValue: "xygrfrfb3g.b2h7y8w.com",
    tags: [],
  });
});

test("parseTarget understands 18mh site targets", () => {
  assert.deepEqual(parseTarget("18mh:https://18mh.net/mv/all"), {
    source: "18mh",
    kind: "site",
    value: "https://18mh.net",
    normalizedValue: "18mh.net",
    tags: [],
  });
});

test("parseTarget understands RouVideo site targets", () => {
  assert.deepEqual(parseTarget("rou:https://rou.video/v"), {
    source: "rou",
    kind: "site",
    value: "https://rou.video",
    normalizedValue: "rou.video",
    tags: [],
  });
});

test("parseTarget understands DadaAFA site targets", () => {
  assert.deepEqual(parseTarget("https://dadaafa.cc/?utm_source=xx&tab=new"), {
    source: "dadaafa",
    kind: "site",
    value: "https://dadaafa.cc",
    normalizedValue: "dadaafa.cc",
    tags: [],
  });
});

test("parseTarget understands 18J.TV site targets", () => {
  assert.deepEqual(parseTarget("https://18j.tv/show/1/"), {
    source: "18j",
    kind: "site",
    value: "https://18j.tv",
    normalizedValue: "18j.tv",
    tags: [],
  });
});

test("parseTarget understands 1mtif site targets", () => {
  assert.deepEqual(parseTarget("https://1mtif.sbs/type/2"), {
    source: "1mtif",
    kind: "site",
    value: "https://1mtif.sbs",
    normalizedValue: "1mtif.sbs",
    tags: [],
  });

  assert.deepEqual(parseTarget("mtif:1mtif.sbs"), {
    source: "1mtif",
    kind: "site",
    value: "https://1mtif.sbs",
    normalizedValue: "1mtif.sbs",
    tags: [],
  });
});

test("parseTarget understands Tik.Porn site targets", () => {
  assert.deepEqual(parseTarget("tikporn:https://tik.porn/"), {
    source: "tikporn",
    kind: "site",
    value: "https://tik.porn",
    normalizedValue: "tik.porn",
    tags: [],
  });
});

test("parseTarget understands 91porna site targets", () => {
  assert.deepEqual(parseTarget("91porna:https://91porna.com/comic/index/video?category=new_update"), {
    source: "91porna",
    kind: "site",
    value: "https://91porna.com",
    normalizedValue: "91porna.com",
    tags: [],
  });
});

test("parseTarget understands 91porn site targets", () => {
  assert.deepEqual(parseTarget("https://91porn.com/v.php?next=watch&page=1"), {
    source: "91porn",
    kind: "site",
    value: "https://91porn.com",
    normalizedValue: "91porn.com",
    tags: [],
  });
});

test("parseTarget understands 91rb site targets", () => {
  assert.deepEqual(parseTarget("https://www.91rb.com/latest-updates/"), {
    source: "91rb",
    kind: "site",
    value: "https://www.91rb.com",
    normalizedValue: "www.91rb.com",
    tags: [],
  });

  assert.deepEqual(parseTarget("rb91:91rb.com/latest-updates/"), {
    source: "91rb",
    kind: "site",
    value: "https://91rb.com",
    normalizedValue: "91rb.com",
    tags: [],
  });
});

test("parseTarget understands Bad.news site targets", () => {
  assert.deepEqual(parseTarget("https://bad.news/sort-new/page-1"), {
    source: "badnews",
    kind: "site",
    value: "https://bad.news",
    normalizedValue: "bad.news",
    tags: [],
  });
});

test("parseTarget understands AvGood site targets", () => {
  assert.deepEqual(parseTarget("https://avgood.com/c/664/"), {
    source: "avgood",
    kind: "site",
    value: "https://avgood.com",
    normalizedValue: "avgood.com",
    tags: [],
  });

  assert.deepEqual(parseTarget("avgood:avgood.com/c/664/"), {
    source: "avgood",
    kind: "site",
    value: "https://avgood.com",
    normalizedValue: "avgood.com",
    tags: [],
  });
});

test("parseTarget understands 705hs site targets", () => {
  assert.deepEqual(parseTarget("https://705hs.com/Html/60/index-1.html"), {
    source: "705hs",
    kind: "site",
    value: "https://705hs.com",
    normalizedValue: "705hs.com",
    tags: [],
  });

  assert.deepEqual(parseTarget("992kp:705hs.com/Html/91/50710.html"), {
    source: "705hs",
    kind: "site",
    value: "https://705hs.com",
    normalizedValue: "705hs.com",
    tags: [],
  });
});

test("parseTarget understands xxxtik site targets", () => {
  assert.deepEqual(parseTarget("https://xxxtik.com"), {
    source: "xxxtik",
    kind: "site",
    value: "https://xxxtik.com",
    normalizedValue: "xxxtik.com",
    tags: [],
  });

  assert.deepEqual(parseTarget("xxxtik:xxxtik.com/post/example"), {
    source: "xxxtik",
    kind: "site",
    value: "https://xxxtik.com",
    normalizedValue: "xxxtik.com",
    tags: [],
  });
});

test("parseTarget understands Attach site targets", () => {
  assert.deepEqual(parseTarget("https://attach.bslqmdvk.cc/category/zxcg/"), {
    source: "attach",
    kind: "site",
    value: "https://attach.bslqmdvk.cc/category/zxcg/",
    normalizedValue: "attach.bslqmdvk.cc",
    tags: [],
  });

  assert.deepEqual(parseTarget("hlcgw:hlcgw.com/category/zxcg/"), {
    source: "attach",
    kind: "site",
    value: "https://hlcgw.com/category/zxcg/",
    normalizedValue: "hlcgw.com",
    tags: [],
  });
});

test("parseTarget understands DirtyShip site targets", () => {
  assert.deepEqual(parseTarget("https://dirtyship.com/latest/"), {
    source: "dirtyship",
    kind: "site",
    value: "https://dirtyship.com",
    normalizedValue: "dirtyship.com",
    tags: [],
  });

  assert.deepEqual(parseTarget("dirtyship:dirtyship.com/sample-video/"), {
    source: "dirtyship",
    kind: "site",
    value: "https://dirtyship.com",
    normalizedValue: "dirtyship.com",
    tags: [],
  });
});

test("parseTarget understands InfluencersGoneWild site targets", () => {
  assert.deepEqual(parseTarget("https://influencersgonewild.com"), {
    source: "influencersgonewild",
    kind: "site",
    value: "https://influencersgonewild.com",
    normalizedValue: "influencersgonewild.com",
    tags: [],
  });

  assert.deepEqual(parseTarget("igw:influencersgonewild.com/sample-post/"), {
    source: "influencersgonewild",
    kind: "site",
    value: "https://influencersgonewild.com",
    normalizedValue: "influencersgonewild.com",
    tags: [],
  });
});

test("parseTarget understands MISSAV site targets", () => {
  assert.deepEqual(parseTarget("https://missav.app/vodtype/20/"), {
    source: "missav",
    kind: "site",
    value: "https://missav.app/vodtype/20/",
    normalizedValue: "missav.app",
    tags: [],
  });

  assert.deepEqual(parseTarget("missav:missav.app/vodtype/20/page/2/"), {
    source: "missav",
    kind: "site",
    value: "https://missav.app/vodtype/20/page/2/",
    normalizedValue: "missav.app",
    tags: [],
  });
});

test("parseTarget understands BDRQ site targets", () => {
  assert.deepEqual(parseTarget("https://g3h4i5j6.bdrq45.cc/vodtype/4.html"), {
    source: "bdrq",
    kind: "site",
    value: "https://g3h4i5j6.bdrq45.cc",
    normalizedValue: "g3h4i5j6.bdrq45.cc",
    tags: [],
  });

  assert.deepEqual(parseTarget("bdrq45:g3h4i5j6.bdrq45.cc/vodshow/181-----------.html"), {
    source: "bdrq",
    kind: "site",
    value: "https://g3h4i5j6.bdrq45.cc",
    normalizedValue: "g3h4i5j6.bdrq45.cc",
    tags: [],
  });
});

test("parseTargets deduplicates normalized values", () => {
  const targets = parseTargets(["OpenAI", "openai", "search:AI", "search:ai", "youtube:UCE_M8A5yxnLfW0KghEeajjw"]);
  assert.equal(targets.length, 3);
  assert.equal(formatTarget(targets[0]), "OpenAI");
  assert.equal(formatTarget(targets[1]), "search:AI");
  assert.equal(formatTarget(targets[2]), "youtube:UCE_M8A5yxnLfW0KghEeajjw");
});

test("parseTargets accepts object targets with category and free tags", () => {
  const targets = parseTargets([
    {
      target: "search:AI coding",
      category: "tech",
      tags: ["AI", " 编程 ", "ai", "", "Claude Code"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      kind: "keyword",
      source: "twitter",
      value: "AI coding",
      normalizedValue: "ai coding",
      category: "tech",
      tags: ["AI", "编程", "Claude Code"],
    },
  ]);
});

test("parseTargets accepts explicit YouTube object targets", () => {
  const targets = parseTargets([
    {
      source: "youtube",
      kind: "channel",
      target: "https://www.youtube.com/channel/UCE_M8A5yxnLfW0KghEeajjw",
      category: "tech",
      tags: ["YouTube"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "youtube",
      kind: "channel",
      value: "UCE_M8A5yxnLfW0KghEeajjw",
      normalizedValue: "uce_m8a5yxnlfw0kgheeajjw",
      category: "tech",
      tags: ["YouTube"],
    },
  ]);
});

test("parseTargets normalizes explicit source aliases", () => {
  assert.deepEqual(parseTargets([{ source: "x", kind: "user", target: "OpenAI", category: "tech" }]), [
    {
      source: "twitter",
      kind: "user",
      value: "OpenAI",
      normalizedValue: "openai",
      category: "tech",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "yt", kind: "channel", target: "UCE_M8A5yxnLfW0KghEeajjw", category: "tech" }]), [
    {
      source: "youtube",
      kind: "channel",
      value: "UCE_M8A5yxnLfW0KghEeajjw",
      normalizedValue: "uce_m8a5yxnlfw0kgheeajjw",
      category: "tech",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "91", kind: "site", target: "www.91cg1.com", category: "adult" }]), [
    {
      source: "cg91",
      kind: "site",
      value: "https://www.91cg1.com",
      normalizedValue: "www.91cg1.com",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "51", kind: "site", target: "www.51baoliao01.com", category: "adult" }]), [
    {
      source: "baoliao51",
      kind: "site",
      value: "https://www.51baoliao01.com/category/jrbl/",
      normalizedValue: "www.51baoliao01.com",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "mh18", kind: "site", target: "18mh.net/mv/all", category: "adult" }]), [
    {
      source: "18mh",
      kind: "site",
      value: "https://18mh.net",
      normalizedValue: "18mh.net",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "rouvideo", kind: "site", target: "rou.video/v", category: "adult" }]), [
    {
      source: "rou",
      kind: "site",
      value: "https://rou.video",
      normalizedValue: "rou.video",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "dada", kind: "site", target: "dadaafa.cc/?utm_source=xx&tab=new", category: "adult" }]), [
    {
      source: "dadaafa",
      kind: "site",
      value: "https://dadaafa.cc",
      normalizedValue: "dadaafa.cc",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "j18", kind: "site", target: "18j.tv/show/1/", category: "adult" }]), [
    {
      source: "18j",
      kind: "site",
      value: "https://18j.tv",
      normalizedValue: "18j.tv",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "mtif", kind: "site", target: "1mtif.sbs/type/2", category: "adult" }]), [
    {
      source: "1mtif",
      kind: "site",
      value: "https://1mtif.sbs",
      normalizedValue: "1mtif.sbs",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "tik.porn", kind: "site", target: "tik.porn", category: "adult" }]), [
    {
      source: "tikporn",
      kind: "site",
      value: "https://tik.porn",
      normalizedValue: "tik.porn",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "porna91", kind: "site", target: "91porna.com/comic/index/video?category=new_update", category: "adult" }]), [
    {
      source: "91porna",
      kind: "site",
      value: "https://91porna.com",
      normalizedValue: "91porna.com",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "91porn", kind: "site", target: "91porn.com/v.php?next=watch&page=1", category: "adult" }]), [
    {
      source: "91porn",
      kind: "site",
      value: "https://91porn.com",
      normalizedValue: "91porn.com",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "rb91", kind: "site", target: "www.91rb.com/latest-updates/", category: "adult" }]), [
    {
      source: "91rb",
      kind: "site",
      value: "https://www.91rb.com",
      normalizedValue: "www.91rb.com",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "bad.news", kind: "site", target: "bad.news/sort-new/page-1", category: "adult" }]), [
    {
      source: "badnews",
      kind: "site",
      value: "https://bad.news",
      normalizedValue: "bad.news",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "avgood.com", kind: "site", target: "avgood.com/c/664/", category: "adult" }]), [
    {
      source: "avgood",
      kind: "site",
      value: "https://avgood.com",
      normalizedValue: "avgood.com",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "992kp", kind: "site", target: "705hs.com/Html/60/index-1.html", category: "adult" }]), [
    {
      source: "705hs",
      kind: "site",
      value: "https://705hs.com",
      normalizedValue: "705hs.com",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "bdrq45", kind: "site", target: "g3h4i5j6.bdrq45.cc/vodtype/4.html", category: "adult" }]), [
    {
      source: "bdrq",
      kind: "site",
      value: "https://g3h4i5j6.bdrq45.cc",
      normalizedValue: "g3h4i5j6.bdrq45.cc",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "xxxtik.com", kind: "site", target: "xxxtik.com/post/example", category: "adult" }]), [
    {
      source: "xxxtik",
      kind: "site",
      value: "https://xxxtik.com",
      normalizedValue: "xxxtik.com",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "hlcgw", kind: "site", target: "attach.bslqmdvk.cc/category/zxcg/", category: "adult" }]), [
    {
      source: "attach",
      kind: "site",
      value: "https://attach.bslqmdvk.cc/category/zxcg/",
      normalizedValue: "attach.bslqmdvk.cc",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "dirtyship.com", kind: "site", target: "dirtyship.com/sample-video/", category: "adult" }]), [
    {
      source: "dirtyship",
      kind: "site",
      value: "https://dirtyship.com",
      normalizedValue: "dirtyship.com",
      category: "adult",
      tags: [],
    },
  ]);

  assert.deepEqual(parseTargets([{ source: "igw", kind: "site", target: "influencersgonewild.com/sample-post/", category: "adult" }]), [
    {
      source: "influencersgonewild",
      kind: "site",
      value: "https://influencersgonewild.com",
      normalizedValue: "influencersgonewild.com",
      category: "adult",
      tags: [],
    },
  ]);
});

test("parseTargets accepts explicit YouTube feed URL object targets", () => {
  const targets = parseTargets([
    {
      source: "youtube",
      kind: "channel",
      target: "https://www.youtube.com/feeds/videos.xml?channel_id=UC1QxOK5YpyAyFCN_xiPfgHw",
      category: "tech",
      tags: ["YouTube"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "youtube",
      kind: "channel",
      value: "UC1QxOK5YpyAyFCN_xiPfgHw",
      normalizedValue: "uc1qxok5ypyayfcn_xipfghw",
      category: "tech",
      tags: ["YouTube"],
    },
  ]);
});

test("parseTargets accepts explicit Heiliao object targets", () => {
  const targets = parseTargets([
    {
      source: "heiliao",
      kind: "site",
      target: "among.uvsoskqus.cc",
      category: "adult",
      tags: ["黑料", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "heiliao",
      kind: "site",
      value: "https://among.uvsoskqus.cc",
      normalizedValue: "among.uvsoskqus.cc",
      category: "adult",
      tags: ["黑料", "视频"],
    },
  ]);
});

test("parseTargets accepts explicit 91cg object targets", () => {
  const targets = parseTargets([
    {
      source: "cg91",
      kind: "site",
      target: "www.91cg1.com",
      category: "adult",
      tags: ["91吃瓜", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "cg91",
      kind: "site",
      value: "https://www.91cg1.com",
      normalizedValue: "www.91cg1.com",
      category: "adult",
      tags: ["91吃瓜", "视频"],
    },
  ]);
});

test("parseTargets accepts explicit 51baoliao object targets", () => {
  const targets = parseTargets([
    {
      source: "baoliao51",
      kind: "site",
      target: "www.51baoliao01.com",
      category: "adult",
      tags: ["51爆料", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "baoliao51",
      kind: "site",
      value: "https://www.51baoliao01.com/category/jrbl/",
      normalizedValue: "www.51baoliao01.com",
      category: "adult",
      tags: ["51爆料", "视频"],
    },
  ]);
});

test("parseTargets accepts explicit Douyin object targets", () => {
  const targets = parseTargets([
    {
      source: "douyin",
      kind: "site",
      target: "xygrfrfb3g.b2h7y8w.com",
      category: "adult",
      tags: ["抖阴", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "douyin",
      kind: "site",
      value: "https://xygrfrfb3g.b2h7y8w.com",
      normalizedValue: "xygrfrfb3g.b2h7y8w.com",
      category: "adult",
      tags: ["抖阴", "视频"],
    },
  ]);
});

test("parseTargets accepts explicit 18mh object targets", () => {
  const targets = parseTargets([
    {
      source: "18mh",
      kind: "site",
      target: "https://18mh.net/mv/all",
      category: "adult",
      tags: ["18MH", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "18mh",
      kind: "site",
      value: "https://18mh.net",
      normalizedValue: "18mh.net",
      category: "adult",
      tags: ["18MH", "视频"],
    },
  ]);
});

test("parseTargets accepts explicit RouVideo object targets", () => {
  const targets = parseTargets([
    {
      source: "rou",
      kind: "site",
      target: "https://rou.video/v",
      category: "adult",
      tags: ["肉視頻", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "rou",
      kind: "site",
      value: "https://rou.video",
      normalizedValue: "rou.video",
      category: "adult",
      tags: ["肉視頻", "视频"],
    },
  ]);
});

test("parseTargets accepts explicit DadaAFA object targets", () => {
  const targets = parseTargets([
    {
      source: "dadaafa",
      kind: "site",
      target: "https://dadaafa.cc/?utm_source=xx&tab=new",
      category: "adult",
      tags: ["DadaAFA", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "dadaafa",
      kind: "site",
      value: "https://dadaafa.cc",
      normalizedValue: "dadaafa.cc",
      category: "adult",
      tags: ["DadaAFA", "视频"],
    },
  ]);
});

test("parseTargets accepts explicit 18J.TV object targets", () => {
  const targets = parseTargets([
    {
      source: "18j",
      kind: "site",
      target: "https://18j.tv/show/1/",
      category: "adult",
      tags: ["18J", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "18j",
      kind: "site",
      value: "https://18j.tv",
      normalizedValue: "18j.tv",
      category: "adult",
      tags: ["18J", "视频"],
    },
  ]);
});

test("parseTargets accepts explicit 1mtif object targets", () => {
  const targets = parseTargets([
    {
      source: "1mtif",
      kind: "site",
      target: "https://1mtif.sbs/type/2",
      category: "adult",
      tags: ["蜜桃视频", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "1mtif",
      kind: "site",
      value: "https://1mtif.sbs",
      normalizedValue: "1mtif.sbs",
      category: "adult",
      tags: ["蜜桃视频", "视频"],
    },
  ]);
});

test("parseTargets accepts explicit AvGood object targets", () => {
  const targets = parseTargets([
    {
      source: "avgood",
      kind: "site",
      target: "https://avgood.com/c/664/",
      category: "adult",
      tags: ["AvGood", "video"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "avgood",
      kind: "site",
      value: "https://avgood.com",
      normalizedValue: "avgood.com",
      category: "adult",
      tags: ["AvGood", "video"],
    },
  ]);
});

test("parseTargets accepts explicit Attach object targets", () => {
  const targets = parseTargets([
    {
      source: "attach",
      kind: "site",
      target: "https://attach.bslqmdvk.cc/category/zxcg/",
      category: "adult",
      tags: ["黑料吃瓜网", "视频"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      source: "attach",
      kind: "site",
      value: "https://attach.bslqmdvk.cc/category/zxcg/",
      normalizedValue: "attach.bslqmdvk.cc",
      category: "adult",
      tags: ["黑料吃瓜网", "视频"],
    },
  ]);
});

test("parseTargets rejects invalid target metadata", () => {
  assert.throws(
    () =>
      parseTargets([
        {
          target: "search:AI",
          tags: ["AI"],
        },
      ]),
    /Target category is required/,
  );

  assert.throws(
    () =>
      parseTargets([
        {
          target: "search:AI",
          category: 1,
        },
      ]),
    /Target category must be a string/,
  );

  assert.throws(
    () =>
      parseTargets([
        {
          target: "search:AI",
          category: "tech",
          tags: "AI",
        },
      ]),
    /Target tags must be an array/,
  );
});
