import { getSql, type QueryChunk } from "@/lib/db";
import { getOpenSearchClient, getOpenSearchItemsIndex } from "@/lib/opensearch";
import { decodeCursor, encodeCursor, normalizeLimit } from "@/lib/pagination";
import { cachedJson } from "@/lib/redis-cache";
import { asRows } from "@/lib/sql-result";
import type { TargetSource } from "@/lib/targets";
import {
  buildVideoFeedNextCursorPayload,
  compactVideoFeedCursorSeenValues,
  selectDiverseVideoItems,
  type VideoFeedItem,
  type VideoFeedQuery,
} from "@/lib/video-feed-service";
import { resolveAuthorPresentation, type AuthorPresentation } from "@/lib/author-presentation";

type OpenSearchJson = Record<string, unknown>;

type VideoFeedCursor = {
  sortTime?: string;
  storedAt?: string;
  id?: string;
  seenIds?: string[];
  seenGuids?: string[];
  seenVideoKeys?: string[];
  lastAuthor?: string | null;
  lastTarget?: string | null;
};

type FeedPreference = {
  categories: string[];
  tags: string[];
};

type OpenSearchFeedSource = {
  id: string;
  guid?: string | null;
  video_url: string;
  playback_headers?: Record<string, string> | null;
  video_key?: string | null;
  cover_url?: string | null;
  title?: string | null;
  caption?: string | null;
  author?: string | null;
  fullname?: string | null;
  display_author?: string | null;
  display_handle?: string | null;
  author_profile_url?: string | null;
  author_profile_platform?: string | null;
  x_url?: string | null;
  link?: string | null;
  published_at?: string | null;
  stored_at: string;
  sort_at?: string | null;
  source: TargetSource;
  target: string;
  target_id?: string | null;
  target_link?: string | null;
  kind: "user" | "keyword" | "channel" | "site";
  category?: string | null;
  tags?: string[];
  expires_at: string;
  video_url_expires_at: string;
  score?: number;
  impressions?: number;
  plays?: number;
  finishes?: number;
  likes?: number;
  dislikes?: number;
  skips?: number;
  shares?: number;
};

type OpenSearchHit = {
  _id: string;
  _source?: OpenSearchFeedSource;
};

type OpenSearchSearchResponse = {
  body?: {
    hits?: {
      hits?: OpenSearchHit[];
    };
  };
  hits?: {
    hits?: OpenSearchHit[];
  };
};

type OpenSearchFeedRow = {
  id: string;
  guid: string;
  videoKey: string;
  videoUrl: string;
  playbackHeaders: Record<string, string> | null;
  coverUrl: string | null;
  title: string | null;
  caption: string | null;
  author: string | null;
  fullname: string | null;
  xUrl: string | null;
  link: string | null;
  publishedAt: string | null;
  storedAt: string;
  sortTime: string;
  source: TargetSource;
  target: string;
  targetLink: string | null;
  kind: "user" | "keyword" | "channel" | "site";
  category: string | null;
  tags: string[];
  expiresAt: string;
  videoUrlExpiresAt: string;
  stats: {
    impressions: number;
    plays: number;
    finishes: number;
    likes: number;
    dislikes: number;
    skips: number;
    shares: number;
    score: number;
  };
} & Partial<AuthorPresentation>;

type VideoKeyRow = {
  videoKey: string | null;
};

function isVideoFeedCursor(value: unknown): value is VideoFeedCursor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<VideoFeedCursor>;
  const hasLegacyBoundary =
    typeof candidate.sortTime === "string" &&
    typeof candidate.storedAt === "string" &&
    typeof candidate.id === "string";

  const hasSeenIds =
    Array.isArray(candidate.seenIds) &&
    candidate.seenIds.every((id) => typeof id === "string") &&
    (candidate.seenGuids === undefined ||
      (Array.isArray(candidate.seenGuids) && candidate.seenGuids.every((guid) => typeof guid === "string"))) &&
    (candidate.seenVideoKeys === undefined ||
      (Array.isArray(candidate.seenVideoKeys) && candidate.seenVideoKeys.every((key) => typeof key === "string"))) &&
    (candidate.lastAuthor === undefined || candidate.lastAuthor === null || typeof candidate.lastAuthor === "string") &&
    (candidate.lastTarget === undefined || candidate.lastTarget === null || typeof candidate.lastTarget === "string");

  return hasLegacyBoundary || hasSeenIds;
}

function videoKeyExpression(alias: "i" | "watched_item"): QueryChunk {
  return {
    text: `
    CASE
      WHEN ${alias}.metadata->>'youtube_video_id' IS NOT NULL THEN 'youtube:' || (${alias}.metadata->>'youtube_video_id')
      WHEN ${alias}.metadata->>'heiliao_video_id' IS NOT NULL THEN 'heiliao:' || (${alias}.metadata->>'heiliao_video_id')
      WHEN ${alias}.metadata->>'cg91_video_id' IS NOT NULL THEN 'cg91:' || (${alias}.metadata->>'cg91_video_id')
      WHEN ${alias}.metadata->>'baoliao51_video_id' IS NOT NULL THEN 'baoliao51:' || (${alias}.metadata->>'baoliao51_video_id')
      WHEN ${alias}.metadata->>'douyin_video_id' IS NOT NULL THEN 'douyin:' || (${alias}.metadata->>'douyin_video_id')
      WHEN ${alias}.metadata->>'mh18_video_id' IS NOT NULL THEN '18mh:' || (${alias}.metadata->>'mh18_video_id')
      WHEN ${alias}.metadata->>'rou_video_id' IS NOT NULL THEN 'rou:' || (${alias}.metadata->>'rou_video_id')
      WHEN ${alias}.metadata->>'dadaafa_video_id' IS NOT NULL THEN 'dadaafa:' || (${alias}.metadata->>'dadaafa_video_id')
      WHEN ${alias}.metadata->>'j18_video_id' IS NOT NULL THEN '18j:' || (${alias}.metadata->>'j18_video_id')
      WHEN ${alias}.metadata->>'mtif_video_id' IS NOT NULL THEN '1mtif:' || (${alias}.metadata->>'mtif_video_id')
      WHEN ${alias}.metadata->>'tikporn_video_id' IS NOT NULL THEN 'tikporn:' || (${alias}.metadata->>'tikporn_video_id')
      WHEN ${alias}.metadata->>'porna91_video_id' IS NOT NULL THEN '91porna:' || (${alias}.metadata->>'porna91_video_id')
      WHEN ${alias}.metadata->>'porn91_video_id' IS NOT NULL THEN '91porn:' || (${alias}.metadata->>'porn91_video_id')
      WHEN ${alias}.metadata->>'rb91_video_id' IS NOT NULL THEN '91rb:' || (${alias}.metadata->>'rb91_video_id')
      WHEN ${alias}.metadata->>'badnews_video_id' IS NOT NULL THEN 'badnews:' || (${alias}.metadata->>'badnews_video_id')
      WHEN ${alias}.metadata->>'bdrq_video_id' IS NOT NULL THEN 'bdrq:' || (${alias}.metadata->>'bdrq_video_id')
      WHEN ${alias}.metadata->>'avgood_video_id' IS NOT NULL THEN 'avgood:' || (${alias}.metadata->>'avgood_video_id')
      WHEN ${alias}.metadata->>'hs705_video_id' IS NOT NULL THEN '705hs:' || (${alias}.metadata->>'hs705_video_id')
      WHEN ${alias}.metadata->>'xxxtik_post_uuid' IS NOT NULL THEN 'xxxtik:' || (${alias}.metadata->>'xxxtik_post_uuid')
      WHEN ${alias}.metadata->>'affair_video_id' IS NOT NULL THEN 'affair:' || (${alias}.metadata->>'affair_video_id')
      WHEN ${alias}.metadata->>'attach_detail_id' IS NOT NULL THEN 'attach:' || (${alias}.metadata->>'attach_detail_id')
      WHEN ${alias}.metadata->>'dirtyship_detail_id' IS NOT NULL THEN 'dirtyship:' || (${alias}.metadata->>'dirtyship_detail_id')
      WHEN ${alias}.metadata->>'influencersgonewild_detail_id' IS NOT NULL THEN 'influencersgonewild:' || (${alias}.metadata->>'influencersgonewild_detail_id')
      WHEN ${alias}.metadata->>'missav_video_id' IS NOT NULL THEN 'missav:' || (${alias}.metadata->>'missav_video_id')
      WHEN ${alias}.guid LIKE 'heiliao:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'cg91:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'baoliao51:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'douyin:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE '18mh:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'rou:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'dadaafa:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE '18j:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE '1mtif:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'tikporn:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE '91porna:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE '91porn:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE '91rb:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'badnews:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'bdrq:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'avgood:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE '705hs:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'xxxtik:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'affair:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'attach:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'dirtyship:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'influencersgonewild:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'missav:%' THEN ${alias}.guid
      WHEN ${alias}.guid LIKE 'yt:video:%' THEN 'youtube:' || replace(${alias}.guid, 'yt:video:', '')
      WHEN ${alias}.video_url LIKE 'https://video.twimg.com/%' THEN split_part(${alias}.video_url, '?', 1)
      ELSE ${alias}.video_url
    END
  `,
    values: [],
  };
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizedUnique(values: Array<string | null | undefined>, max = 200) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = normalizeKey(value);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
    if (result.length >= max) {
      break;
    }
  }
  return result;
}

async function getSubscribedTargetIds(clientId: string) {
  return cachedJson("os-feed-subscriptions", [clientId], 120, async () => {
    const sql = getSql();
    const rows = asRows<{ targetId: string }>(await sql`
      SELECT target_id AS "targetId"
      FROM subscriptions
      WHERE client_id = ${clientId}
    `);
    return rows.map((row) => row.targetId);
  });
}

async function getRecentSeenVideoKeys(clientId: string) {
  return cachedJson("os-feed-seen-video-keys", [clientId], 45, async () => {
    const sql = getSql();
    const watchedVideoKey = videoKeyExpression("watched_item");
    const rows = asRows<VideoKeyRow>(await sql`
      SELECT DISTINCT ${watchedVideoKey} AS "videoKey"
      FROM feed_events fe
      INNER JOIN items watched_item ON watched_item.id = fe.item_id
      WHERE fe.client_id = ${clientId}
        AND fe.event_type IN ('impression', 'play', 'finish', 'dislike')
        AND fe.created_at >= NOW() - INTERVAL '7 days'
      LIMIT 1000
    `);
    return normalizedUnique(rows.map((row) => row.videoKey), 1000);
  });
}

async function getFeedPreference(clientId: string): Promise<FeedPreference> {
  return cachedJson("os-feed-preference", [clientId], 300, async () => {
    const sql = getSql();
    const rows = asRows<{ category: string | null; tag: string | null; weight: number }>(await sql`
      SELECT
        LOWER(COALESCE(tp.category, '')) AS category,
        LOWER(tag_values.name) AS tag,
        SUM(CASE
          WHEN fe.event_type = 'like' THEN 5
          WHEN fe.event_type = 'finish' THEN 3
          WHEN fe.event_type = 'share' THEN 4
          WHEN fe.event_type = 'play' THEN 1
          ELSE 0
        END) AS weight
      FROM feed_events fe
      INNER JOIN items i ON i.id = fe.item_id
      INNER JOIN targets t ON t.id = i.target_id
      LEFT JOIN target_profiles tp ON tp.target_id = t.id
      LEFT JOIN LATERAL (
        SELECT tag.name
        FROM item_tags it
        INNER JOIN tags tag ON tag.id = it.tag_id
        WHERE it.item_id = i.id
        UNION
        SELECT profile_tag.name
        FROM jsonb_array_elements_text(COALESCE(tp.tags, '[]'::jsonb)) AS profile_tag(name)
      ) tag_values ON TRUE
      WHERE fe.client_id = ${clientId}
        AND fe.created_at >= NOW() - INTERVAL '7 days'
        AND fe.event_type IN ('play', 'finish', 'like', 'share')
      GROUP BY LOWER(COALESCE(tp.category, '')), LOWER(tag_values.name)
      ORDER BY weight DESC
      LIMIT 50
    `);
    return {
      categories: normalizedUnique(rows.map((row) => row.category), 8),
      tags: normalizedUnique(rows.map((row) => row.tag), 20),
    };
  });
}

async function normalizeCategoryFilters(categories: string[]) {
  if (categories.length === 0) {
    return [];
  }
  const sql = getSql();
  const categoryRows = asRows<{ slug: string; name: string }>(await sql`
    SELECT slug, name
    FROM categories
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(${JSON.stringify(categories)}::jsonb) AS selected_category(name)
      WHERE LOWER(categories.slug) = selected_category.name
         OR LOWER(categories.name) = selected_category.name
    )
  `);
  return normalizedUnique([
    ...categories,
    ...categoryRows.flatMap((category) => [category.slug, category.name]),
  ]);
}

function terms(field: string, values: string[]) {
  if (values.length === 0) {
    return null;
  }
  return { terms: { [field]: values } };
}

function sourceFilter(source: VideoFeedQuery["source"], subscribedTargetIds: string[]) {
  if (source === "public") {
    return [{ term: { is_public_pool: true } }];
  }

  if (source === "user") {
    if (subscribedTargetIds.length === 0) {
      return [{ term: { target_id: "__no_subscriptions__" } }];
    }
    return [{ terms: { target_id: subscribedTargetIds } }];
  }

  if (subscribedTargetIds.length === 0) {
    return [{ term: { is_public_pool: true } }];
  }

  return [
    {
      bool: {
        should: [{ terms: { target_id: subscribedTargetIds } }, { term: { is_public_pool: true } }],
        minimum_should_match: 1,
      },
    },
  ];
}

function toNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toRow(source: OpenSearchFeedSource): OpenSearchFeedRow | null {
  if (!source.id || !source.video_url || !source.stored_at || !source.expires_at || !source.video_url_expires_at) {
    return null;
  }

  const sortTime = source.sort_at ?? source.published_at ?? source.stored_at;
  return {
    id: source.id,
    guid: source.guid ?? source.id,
    videoKey: source.video_key ?? source.video_url,
    videoUrl: source.video_url,
    playbackHeaders: source.playback_headers ?? null,
    coverUrl: source.cover_url ?? null,
    title: source.title ?? null,
    caption: source.caption ?? null,
    author: source.author ?? null,
    fullname: source.fullname ?? null,
    displayAuthor: source.display_author ?? undefined,
    displayHandle: source.display_handle ?? undefined,
    authorProfileUrl: source.author_profile_url ?? undefined,
    authorProfilePlatform: source.author_profile_platform ?? undefined,
    xUrl: source.x_url ?? null,
    link: source.link ?? null,
    publishedAt: source.published_at ?? null,
    storedAt: source.stored_at,
    sortTime,
    source: source.source,
    target: source.target,
    targetLink: source.target_link ?? null,
    kind: source.kind,
    category: source.category ?? null,
    tags: Array.isArray(source.tags) ? source.tags : [],
    expiresAt: source.expires_at,
    videoUrlExpiresAt: source.video_url_expires_at,
    stats: {
      impressions: toNumber(source.impressions),
      plays: toNumber(source.plays),
      finishes: toNumber(source.finishes),
      likes: toNumber(source.likes),
      dislikes: toNumber(source.dislikes),
      skips: toNumber(source.skips),
      shares: toNumber(source.shares),
      score: toNumber(source.score),
    },
  };
}

function buildFeedQuery(input: {
  size: number;
  source: VideoFeedQuery["source"];
  subscribedTargetIds: string[];
  seenIds: string[];
  seenGuids: string[];
  seenVideoKeys: string[];
  categoryFilters: string[];
  tagFilters: string[];
  preference: FeedPreference;
}) {
  const filter: unknown[] = [
    { term: { has_video: true } },
    { range: { expires_at: { gt: "now" } } },
    {
      bool: {
        should: [
          { bool: { must_not: [{ terms: { source: ["youtube", "heiliao", "cg91", "baoliao51", "douyin", "18mh", "rou", "dadaafa", "18j", "1mtif", "tikporn", "91porna", "91porn", "91rb", "badnews", "bdrq", "avgood", "705hs", "xxxtik", "affair", "attach", "dirtyship", "influencersgonewild", "missav"] } }] } },
          { range: { video_url_expires_at: { gt: "now+10m" } } },
        ],
        minimum_should_match: 1,
      },
    },
    ...sourceFilter(input.source, input.subscribedTargetIds),
  ];

  const tagTerms = terms("tags", input.tagFilters);
  if (tagTerms) {
    filter.push(tagTerms);
  }

  if (input.categoryFilters.length > 0) {
    filter.push({
      bool: {
        should: [
          { terms: { category: input.categoryFilters } },
          { terms: { tags: input.categoryFilters } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  const mustNot: unknown[] = [];
  const seenIdTerms = terms("id", input.seenIds);
  if (seenIdTerms) {
    mustNot.push(seenIdTerms);
  }
  const seenGuidTerms = terms("guid", input.seenGuids);
  if (seenGuidTerms) {
    mustNot.push(seenGuidTerms);
  }
  const seenVideoKeyTerms = terms("video_key", input.seenVideoKeys);
  if (seenVideoKeyTerms) {
    mustNot.push(seenVideoKeyTerms);
  }

  const functions: unknown[] = [
    {
      exp: {
        sort_at: {
          origin: "now",
          scale: "36h",
          decay: 0.5,
        },
      },
      weight: 3,
    },
    {
      field_value_factor: {
        field: "quality_score",
        modifier: "log1p",
        factor: 1.1,
        missing: 0,
      },
      weight: 1.8,
    },
  ];

  if (input.preference.categories.length > 0) {
    functions.push({
      filter: {
        bool: {
          should: [
            { terms: { category: input.preference.categories } },
            { terms: { tags: input.preference.categories } },
          ],
          minimum_should_match: 1,
        },
      },
      weight: 1.4,
    });
  }

  if (input.preference.tags.length > 0) {
    functions.push({
      filter: { terms: { tags: input.preference.tags } },
      weight: 1.25,
    });
  }

  return {
    size: input.size,
    track_total_hits: false,
    query: {
      function_score: {
        query: {
          bool: {
            filter,
            must_not: mustNot,
          },
        },
        functions,
        score_mode: "sum",
        boost_mode: "replace",
      },
    },
    sort: [
      { _score: { order: "desc" } },
      { sort_at: { order: "desc", unmapped_type: "date" } },
      { stored_at: { order: "desc", unmapped_type: "date" } },
      { _id: { order: "desc" } },
    ],
  };
}

function getHits(response: OpenSearchSearchResponse) {
  return response.body?.hits?.hits ?? response.hits?.hits ?? [];
}

export async function listVideoFeedFromOpenSearch(query: VideoFeedQuery) {
  const client = getOpenSearchClient();
  if (!client) {
    throw new Error("OpenSearch is not configured.");
  }

  const limit = normalizeLimit(query.limit, { defaultLimit: 10, maxLimit: 20 });
  const cursor = decodeCursor(query.cursor, isVideoFeedCursor);
  const normalizedTags = normalizedUnique([...(query.tags ?? []), query.tag]);
  const normalizedCategories = normalizedUnique([...(query.categories ?? []), query.category]);
  const source = query.source ?? "mixed";
  const seenIds = compactVideoFeedCursorSeenValues(cursor?.seenIds ?? []);
  const seenGuids = compactVideoFeedCursorSeenValues(cursor?.seenGuids ?? []);
  const cursorSeenVideoKeys = compactVideoFeedCursorSeenValues(cursor?.seenVideoKeys ?? []);

  const [subscribedTargetIds, recentSeenVideoKeys, preference, categoryFilters] = await Promise.all([
    getSubscribedTargetIds(query.clientId),
    getRecentSeenVideoKeys(query.clientId),
    getFeedPreference(query.clientId),
    normalizeCategoryFilters(normalizedCategories),
  ]);
  const seenVideoKeys = compactVideoFeedCursorSeenValues([...recentSeenVideoKeys, ...cursorSeenVideoKeys]);

  const size = Math.max(limit * 8, 80);
  const body = buildFeedQuery({
    size,
    source,
    subscribedTargetIds,
    seenIds,
    seenGuids,
    seenVideoKeys,
    categoryFilters,
    tagFilters: normalizedTags,
    preference,
  });

  const searchParams = {
    index: getOpenSearchItemsIndex(),
    body,
  } as unknown as Parameters<typeof client.search>[0];
  const response = (await client.search(searchParams)) as unknown as OpenSearchSearchResponse;
  const candidates = getHits(response)
    .map((hit) => (hit._source ? toRow(hit._source) : null))
    .filter((row): row is OpenSearchFeedRow => row !== null);

  const selected = selectDiverseVideoItems({
    candidates,
    limit,
    previousLastAuthor: cursor?.lastAuthor,
    previousLastTarget: cursor?.lastTarget,
    enforceLimits: false,
    enforceConsecutive: true,
  });
  const items = selected.slice(0, limit);
  const nextCursorPayload = buildVideoFeedNextCursorPayload({
    seenIds,
    seenGuids,
    seenVideoKeys: cursorSeenVideoKeys,
    items,
  });
  const nextCursor = nextCursorPayload ? encodeCursor(nextCursorPayload) : null;

  return {
    items: items.map(({ guid: _guid, sortTime: _sortTime, ...item }) => ({
      ...item,
      ...resolveAuthorPresentation(item),
    })) as VideoFeedItem[],
    pagination: {
      limit,
      nextCursor,
      hasMore: items.length === limit,
    },
  };
}
