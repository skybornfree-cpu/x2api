from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from html import unescape as html_unescape
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from psycopg.types.json import Jsonb

try:
    from collector.opensearch_items import upsert_item_record as upsert_item_record_with_opensearch
except ModuleNotFoundError:
    from opensearch_items import upsert_item_record as upsert_item_record_with_opensearch


CAOLIU_SITE_NAME = "草榴社区"
CAOLIU_SOURCE = "caoliu"
CAOLIU_KIND = "site"
CAOLIU_DEFAULT_BASE_URL = os.environ.get("CAOLIU_BASE_URL", "https://t66y.com/thread0806.php?fid=16").strip() or "https://t66y.com/thread0806.php?fid=16"
CAOLIU_RETENTION_HOURS = int(os.environ.get("CAOLIU_RETENTION_HOURS", "720"))
CAOLIU_REQUEST_TIMEOUT_SECONDS = int(os.environ.get("CAOLIU_REQUEST_TIMEOUT_SECONDS", "20"))
CAOLIU_LOCAL_TIMEZONE = timezone(timedelta(hours=8))
DIRECT_VIDEO_EXTENSIONS = (".mp4", ".m4v", ".mov", ".webm", ".m3u8")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def non_empty(value) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def clean_text(value: str | None) -> str | None:
    text = non_empty(value)
    if not text:
        return None
    return re.sub(r"\s+", " ", html_unescape(text)).strip() or None


def normalize_asset_url(base_url: str, value: str | None) -> str | None:
    raw = non_empty(value)
    if not raw or raw.startswith("data:"):
        return None
    if raw.startswith("//"):
        raw = f"https:{raw}"
    normalized = urljoin(base_url, html_unescape(raw).replace("\\/", "/"))
    return urlunparse(urlparse(normalized)._replace(fragment=""))


def normalize_caoliu_target_key(value: str) -> str:
    parsed = urlparse(value)
    params = parse_qs(parsed.query, keep_blank_values=False)
    fid = non_empty((params.get("fid") or [None])[0]) or "16"
    return f"{parsed.netloc.lower()}:{fid}"


def parse_forum_datetime(value: str | None) -> datetime | None:
    raw = clean_text(value)
    if not raw:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y/%m/%d %H:%M:%S"):
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.replace(tzinfo=CAOLIU_LOCAL_TIMEZONE).astimezone(timezone.utc)
        except ValueError:
            pass
    return None


def parse_timestamp_attr(value: str | None) -> datetime | None:
    raw = non_empty(value)
    if not raw:
        return None
    raw = raw.rstrip("s")
    try:
        return datetime.fromtimestamp(int(raw), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def headers(referer: str | None = None) -> dict[str, str]:
    result = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    if referer:
        result["Referer"] = referer
    return result


def request_with_proxy_fallback(url: str, *, referer: str | None = None, stream: bool = False) -> requests.Response:
    last_error: Exception | None = None
    for trust_env in (True, False):
        session = requests.Session()
        session.trust_env = trust_env
        try:
            response = session.get(
                url,
                headers=headers(referer),
                timeout=CAOLIU_REQUEST_TIMEOUT_SECONDS,
                stream=stream,
                allow_redirects=True,
            )
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_error = exc
    raise last_error or ValueError("Caoliu request failed.")


def fetch_html(url: str, referer: str | None = None) -> str:
    response = request_with_proxy_fallback(url, referer=referer)
    return response.content.decode(response.encoding or "utf-8", "replace")


def normalize_caoliu_target_value(raw: str) -> str:
    value = (raw or CAOLIU_DEFAULT_BASE_URL).strip()
    parsed = urlparse(value if "://" in value else f"https://{value}")
    if not parsed.netloc:
        raise ValueError("Caoliu target must be a URL or host.")
    query = parse_qs(parsed.query, keep_blank_values=False)
    fid = non_empty((query.get("fid") or [None])[0]) or "16"
    base_query = urlencode({"fid": fid})
    return urlunparse((parsed.scheme or "https", parsed.netloc.lower(), "/thread0806.php", "", base_query, ""))


def is_caoliu_target_url(raw: str) -> bool:
    value = raw.strip()
    if not value:
        return False
    try:
        parsed = urlparse(value if "://" in value else f"https://{value}")
    except Exception:
        return False
    return parsed.netloc.lower() in {"t66y.com", "www.t66y.com"}


def format_target_row(target_row: dict) -> str:
    return f"caoliu:{target_row['value']}"


def build_list_page_url(base_url: str, page: int) -> str:
    parsed = urlparse(normalize_caoliu_target_value(base_url))
    params = parse_qs(parsed.query, keep_blank_values=False)
    params["fid"] = [params.get("fid", ["16"])[0]]
    if page > 1:
        params["page"] = [str(page)]
    else:
        params.pop("page", None)
    query = urlencode([(key, value) for key, values in params.items() for value in values])
    return urlunparse(parsed._replace(query=query))


def detail_id_from_url(url: str) -> str | None:
    parsed = urlparse(url)
    match = re.search(r"/(\d+)\.html$", parsed.path)
    return match.group(1) if match else None


def infer_video_type(url: str) -> str | None:
    path = urlparse(url).path.lower()
    if path.endswith(".m3u8"):
        return "hls"
    if path.endswith((".mp4", ".m4v", ".mov", ".webm")):
        return "direct"
    return None


def decode_redir_url(url: str | None) -> str | None:
    raw = normalize_asset_url(CAOLIU_DEFAULT_BASE_URL, url)
    if not raw:
        return None
    parsed = urlparse(raw)
    if not parsed.netloc.lower().endswith("redircdn.com"):
        return raw
    candidate = non_empty(parsed.query.split("&", 1)[0])
    if not candidate:
        return raw
    if candidate.startswith(("http://", "https://")):
        return candidate.replace("______", ".")
    return raw


def parse_list_page(base_url: str, page: int) -> list[dict]:
    page_url = build_list_page_url(base_url, page)
    html = fetch_html(page_url, build_list_page_url(base_url, 1))
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict] = []
    seen: set[str] = set()
    for row in soup.select("#ajaxtable tr.tr3.t_one.tac"):
        heading = row.select_one("h3 a[href]")
        author_el = row.select_one("td:nth-of-type(3) a.bl")
        author_meta = row.select_one("td:nth-of-type(3) span[data-timestamp], td:nth-of-type(3) span[title]")
        if not heading:
            continue
        detail_url = normalize_asset_url(page_url, heading.get("href"))
        detail_id = non_empty((heading.get("id") or "").lstrip("t")) or detail_id_from_url(detail_url or "")
        if not detail_url or "/htm_data/" not in urlparse(detail_url).path or not detail_id or detail_id in seen:
            continue
        seen.add(detail_id)
        items.append(
            {
                "guid": f"{CAOLIU_SOURCE}:{detail_id}",
                "detail_id": detail_id,
                "url": detail_url,
                "title": clean_text(heading.get_text(" ", strip=True)) or f"{CAOLIU_SITE_NAME} 帖子 {detail_id}",
                "author": clean_text(author_el.get_text(" ", strip=True) if author_el else None),
                "published_at": parse_timestamp_attr(author_meta.get("data-timestamp") if author_meta else None)
                or parse_forum_datetime(author_meta.get("title") if author_meta else None),
                "page": page,
            }
        )
    return items


def first_post_container(soup: BeautifulSoup):
    return soup.select_one("#conttpc")


def first_post_author_name(soup: BeautifulSoup) -> str | None:
    author_el = soup.select_one("div.t.t2 th[rowspan='2'] > b")
    return clean_text(author_el.get_text(" ", strip=True) if author_el else None)


def first_post_author_profile_url(soup: BeautifulSoup, detail_url: str) -> str | None:
    link = soup.select_one("div.t.t2 .tiptop a[href*='show.php?uid=']")
    return normalize_asset_url(detail_url, link.get("href") if link else None)


def detail_title(soup: BeautifulSoup) -> str | None:
    heading = soup.select_one("h4.f16, h4, title")
    text = heading.get_text(" ", strip=True) if heading else None
    cleaned = clean_text(text)
    if cleaned and " - 達蓋爾的旗幟" in cleaned:
        cleaned = clean_text(cleaned.split(" - 達蓋爾的旗幟", 1)[0])
    return cleaned


def extract_modified_at(html: str) -> datetime | None:
    match = re.search(r"(?:重新編輯|重新编辑|重新編輯：|重新编辑：)\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2})", html)
    if match:
        return parse_forum_datetime(match.group(1))
    return None


def extract_image_urls(content_node, detail_url: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for image in content_node.select("img"):
        candidates = [
            image.get("ess-data"),
            image.get("data-src"),
            image.get("src"),
        ]
        for candidate in candidates:
            url = normalize_asset_url(detail_url, candidate)
            if not url:
                continue
            if url == "http://a.d/adblo_ck.jpg" or url.endswith("/adblo_ck.jpg"):
                continue
            if url not in seen:
                urls.append(url)
                seen.add(url)
            break
    return urls


def extract_outbound_links(content_node, detail_url: str) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for anchor in content_node.select("a[href]"):
        href = decode_redir_url(anchor.get("href"))
        url = normalize_asset_url(detail_url, href)
        if not url:
            continue
        if urlparse(url).netloc.lower().endswith("redircdn.com"):
            continue
        if url not in seen:
            links.append(url)
            seen.add(url)
    return links


def extract_video_candidates(content_node, detail_url: str) -> list[dict]:
    candidates: list[dict] = []
    seen: set[str] = set()
    selectors = [
        ("a[href]", "href"),
        ("video[src]", "src"),
        ("video source[src]", "src"),
        ("iframe[src]", "src"),
    ]
    for selector, attr in selectors:
        for node in content_node.select(selector):
            raw = decode_redir_url(node.get(attr))
            url = normalize_asset_url(detail_url, raw)
            video_type = infer_video_type(url or "")
            if not url or not video_type or url in seen:
                continue
            seen.add(url)
            candidates.append({"url": url, "video_type": video_type})
    return candidates


def build_video_variants(detail: dict) -> list[dict]:
    variants: list[dict] = []
    seen: set[str] = set()
    for index, candidate in enumerate(detail.get("video_candidates") or [], start=1):
        url = normalize_asset_url(detail["url"], candidate.get("url") if isinstance(candidate, dict) else None)
        video_type = clean_text(candidate.get("video_type") if isinstance(candidate, dict) else None) or infer_video_type(url or "")
        if not url or not video_type or url in seen:
            continue
        seen.add(url)
        variants.append(
            {
                "guid": f"{detail['guid']}#video:{index}",
                "variant_key": url,
                "variant_index": index,
                "video_url": url,
                "video_type": video_type,
            }
        )
    return variants


def parse_detail_page(detail_url: str, list_item: dict | None = None) -> dict:
    html = fetch_html(detail_url, (list_item or {}).get("url") or build_list_page_url(CAOLIU_DEFAULT_BASE_URL, 1))
    soup = BeautifulSoup(html, "html.parser")
    content_node = first_post_container(soup)
    if content_node is None:
        raise ValueError("Caoliu detail page is missing first-post content.")

    content_soup = BeautifulSoup(str(content_node), "html.parser")
    for node in content_soup.select("script, .tips"):
        node.decompose()

    title = detail_title(soup) or (list_item or {}).get("title") or CAOLIU_SITE_NAME
    text_content = clean_text(content_soup.get_text("\n", strip=True)) or title
    images = extract_image_urls(content_soup, detail_url)
    video_candidates = extract_video_candidates(content_soup, detail_url)
    outbound_links = extract_outbound_links(content_soup, detail_url)
    detail_id = (list_item or {}).get("detail_id") or detail_id_from_url(detail_url)
    if not detail_id:
        raise ValueError("Caoliu detail page is missing detail id.")

    first_post_time = soup.select_one("div.t.t2 .tipad span[data-timestamp]")
    published_at = parse_timestamp_attr(first_post_time.get("data-timestamp") if first_post_time else None) or (list_item or {}).get("published_at") or now_utc()
    author_name = first_post_author_name(soup) or (list_item or {}).get("author") or CAOLIU_SITE_NAME
    author_profile_url = first_post_author_profile_url(soup, detail_url)

    variants = build_video_variants(
        {
            "guid": f"{CAOLIU_SOURCE}:{detail_id}",
            "url": detail_url,
            "video_candidates": video_candidates,
        }
    )
    return {
        "guid": f"{CAOLIU_SOURCE}:{detail_id}",
        "detail_id": detail_id,
        "url": detail_url,
        "title": title,
        "description": text_content,
        "content": text_content,
        "author": author_name,
        "author_profile_url": author_profile_url,
        "image": images[0] if images else None,
        "images": images,
        "outbound_links": outbound_links,
        "video_candidates": video_candidates,
        "video_variants": variants,
        "video_url": variants[0]["video_url"] if variants else None,
        "video_type": variants[0]["video_type"] if variants else None,
        "published_at": published_at,
        "modified_at": extract_modified_at(html),
    }


def upsert_target(conn, base_url: str) -> dict:
    value = normalize_caoliu_target_value(base_url)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO targets (source, kind, value, normalized_value)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (source, kind, normalized_value)
            DO UPDATE SET value = EXCLUDED.value
            RETURNING id, source, kind, value, normalized_value
            """,
            (CAOLIU_SOURCE, CAOLIU_KIND, value, normalize_caoliu_target_key(value)),
        )
        return cur.fetchone()


def ensure_target(conn, base_url: str, *, public_pool: bool = True) -> dict:
    target_row = upsert_target(conn, base_url)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO target_profiles (target_id, scope, tags, category, weight, is_public_pool)
            VALUES (%s, 'system', %s, 'adult', 45, %s)
            ON CONFLICT (target_id) DO UPDATE SET
                scope = EXCLUDED.scope,
                tags = EXCLUDED.tags,
                category = EXCLUDED.category,
                weight = EXCLUDED.weight,
                is_public_pool = EXCLUDED.is_public_pool,
                updated_at = NOW()
            """,
            (target_row["id"], Jsonb([CAOLIU_SITE_NAME, "成人", "达盖尔的旗帜", "草榴"]), public_pool),
        )
    return target_row


def item_exists_for_guid(conn, target_id: str, guid: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM items WHERE target_id = %s AND (guid = %s OR group_key = %s) LIMIT 1",
            (target_id, guid, guid),
        )
        return cur.fetchone() is not None


def upsert_crawl_state(conn, target_id: str, *, last_guid: str | None, last_error: str | None, success: bool) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO crawl_state (target_id, last_guid, last_checked_at, last_success_at, last_error)
            VALUES (%s, %s, NOW(), CASE WHEN %s THEN NOW() ELSE NULL END, %s)
            ON CONFLICT (target_id) DO UPDATE SET
                last_guid = COALESCE(EXCLUDED.last_guid, crawl_state.last_guid),
                last_checked_at = EXCLUDED.last_checked_at,
                last_success_at = CASE WHEN %s THEN EXCLUDED.last_checked_at ELSE crawl_state.last_success_at END,
                last_error = EXCLUDED.last_error,
                updated_at = NOW()
            """,
            (target_id, last_guid, success, last_error, success),
        )


def build_author_presentation(detail: dict) -> dict[str, str | None]:
    return {
        "display_author": detail.get("author") or CAOLIU_SITE_NAME,
        "display_handle": None,
        "author_profile_url": detail.get("author_profile_url") or detail.get("url"),
        "author_profile_platform": CAOLIU_SITE_NAME,
    }


def upsert_forum_item(conn, target_row: dict, detail: dict) -> bool:
    published_at = detail.get("published_at") or now_utc()
    stored_at = now_utc()
    expires_at = published_at + timedelta(days=3650)
    presentation = build_author_presentation(detail)
    images = detail.get("images") or []
    variants = detail.get("video_variants") or []
    metadata = {
        "target": format_target_row(target_row),
        "target_type": CAOLIU_KIND,
        "target_value": target_row["value"],
        "site_name": CAOLIU_SITE_NAME,
        "source_url": detail["url"],
        "detail_id": detail["detail_id"],
        "caoliu_thread_id": detail["detail_id"],
        "group_key": detail["guid"],
        "author_name": detail.get("author"),
        "author_profile_url": detail.get("author_profile_url"),
        "image_count": len(images),
        "outbound_links": detail.get("outbound_links") or [],
        "video_candidates": detail.get("video_candidates") or [],
        "video_variants": variants,
        "video_count": len(variants),
        "date_modified": detail.get("modified_at").isoformat() if detail.get("modified_at") else None,
        "resolver": "caoliu-op-first-floor",
        "resolved_at": now_iso(),
    }
    inserted_any = False
    if not variants:
        _item_id, inserted = upsert_item_record_with_opensearch(
            conn,
            target_id=str(target_row["id"]),
            guid=detail["guid"],
            display_author=presentation["display_author"],
            display_handle=presentation["display_handle"],
            author_profile_url=presentation["author_profile_url"],
            author_profile_platform=presentation["author_profile_platform"],
            video_url=None,
            expires_at=expires_at,
            video_url_expires_at=stored_at + timedelta(days=3650),
            published_at=published_at,
            stored_at=stored_at,
            is_retweet=False,
            metadata=metadata,
            cover_url=detail.get("image"),
            title=detail.get("title"),
            caption=detail.get("description"),
            content=detail.get("content"),
            author=detail.get("author"),
            fullname=detail.get("author"),
            x_url=None,
            link=detail["url"],
            images=images,
        )
        return inserted

    for variant in variants:
        variant_metadata = {
            **metadata,
            "variant_key": variant["variant_key"],
            "variant_index": variant["variant_index"],
            "video_type": variant["video_type"],
        }
        _item_id, inserted = upsert_item_record_with_opensearch(
            conn,
            target_id=str(target_row["id"]),
            guid=variant["guid"],
            display_author=presentation["display_author"],
            display_handle=presentation["display_handle"],
            author_profile_url=presentation["author_profile_url"],
            author_profile_platform=presentation["author_profile_platform"],
            video_url=variant["video_url"],
            expires_at=expires_at,
            video_url_expires_at=stored_at + timedelta(days=3650),
            published_at=published_at,
            stored_at=stored_at,
            is_retweet=False,
            metadata=variant_metadata,
            cover_url=detail.get("image"),
            title=detail.get("title"),
            caption=detail.get("description"),
            content=detail.get("content"),
            author=detail.get("author"),
            fullname=detail.get("author"),
            x_url=None,
            link=detail["url"],
            images=images,
        )
        inserted_any = inserted_any or inserted
    return inserted_any


def monitor_site(conn, *, base_url: str, max_pages: int, retention_hours: int, public_pool: bool, dry_run: bool = False) -> dict:
    base_url = normalize_caoliu_target_value(base_url)
    target_row = None if dry_run else ensure_target(conn, base_url, public_pool=public_pool)
    cutoff = now_utc() - timedelta(hours=retention_hours)
    inserted = updated = parsed_posts = pages = skipped_existing = skipped_old = skipped_no_media = skipped_detail_errors = 0
    samples = []
    latest_guid = None

    for page in range(1, max_pages + 1):
        pages += 1
        list_items = parse_list_page(base_url, page)
        page_inserted = page_existing = page_old = page_no_media = page_errors = page_parsed = 0
        print(f"[caoliu] page={page} list_items={len(list_items)}")
        if not list_items:
            print(f"[caoliu] page={page} empty_list stop=true")
            break
        for list_item in list_items:
            latest_guid = latest_guid or list_item["guid"]
            if list_item.get("published_at") and list_item["published_at"] < cutoff:
                skipped_old += 1
                page_old += 1
                continue
            if target_row and item_exists_for_guid(conn, str(target_row["id"]), list_item["guid"]):
                skipped_existing += 1
                page_existing += 1
                continue
            try:
                detail = parse_detail_page(list_item["url"], list_item)
                parsed_posts += 1
                page_parsed += 1
            except Exception as exc:
                skipped_detail_errors += 1
                page_errors += 1
                print(f"[caoliu] detail_error guid={list_item['guid']} error={exc}")
                continue

            if not detail.get("images"):
                skipped_no_media += 1
                page_no_media += 1
                continue

            sample = {
                "guid": detail["guid"],
                "title": detail.get("title"),
                "url": detail.get("url"),
                "author": detail.get("author"),
                "image_count": len(detail.get("images") or []),
                "video_url": detail.get("video_url"),
                "published_at": detail.get("published_at"),
            }
            if len(samples) < 8:
                samples.append(sample)

            if dry_run:
                updated += 1
                page_inserted += 1
                continue

            if upsert_forum_item(conn, target_row, detail):
                inserted += 1
                page_inserted += 1
            else:
                updated += 1
        print(
            f"[caoliu] page={page} parsed={page_parsed} inserted={page_inserted} "
            f"existing={page_existing} old={page_old} no_media={page_no_media} detail_errors={page_errors}"
        )

    if target_row and not dry_run:
        upsert_crawl_state(conn, str(target_row["id"]), last_guid=latest_guid, last_error=None, success=True)

    return {
        "source": CAOLIU_SOURCE,
        "target": format_target_row(target_row) if target_row else f"caoliu:{base_url}",
        "base_url": base_url,
        "pages": pages,
        "parsed_posts": parsed_posts,
        "inserted": inserted,
        "updated": updated,
        "skipped_existing": skipped_existing,
        "skipped_old": skipped_old,
        "skipped_no_media": skipped_no_media,
        "skipped_detail_errors": skipped_detail_errors,
        "latest_guid": latest_guid,
        "samples": samples,
    }
