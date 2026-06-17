from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from psycopg import connect

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from collector.opensearch_items import delete_items as delete_opensearch_items  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean video feed data with tiered retention for small PostgreSQL plans.")
    parser.add_argument("--apply", action="store_true", help="Delete rows. Without this flag, only report counts.")
    parser.add_argument("--event-days", type=int, default=7, help="Detailed feed event retention days.")
    parser.add_argument("--non-video-days", type=int, default=14, help="Non-video item retention days.")
    parser.add_argument("--low-score-video-days", type=int, default=7, help="Retention days for low-score videos.")
    parser.add_argument("--video-days", type=int, default=30, help="Default video item retention days.")
    parser.add_argument("--public-video-days", type=int, default=60, help="Public pool video retention days.")
    parser.add_argument("--high-score-video-days", type=int, default=90, help="High-score video retention days.")
    parser.add_argument("--high-score-threshold", type=int, default=20, help="Score threshold for high-score videos.")
    parser.add_argument("--low-score-threshold", type=int, default=-5, help="Score threshold for low-score videos.")
    return parser.parse_args()


def interval_param(days: int) -> tuple[int]:
    return (max(days, 1),)


def main() -> int:
    args = parse_args()
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("Missing DATABASE_URL environment variable.")

    statements = [
        (
            "feed_events",
            "DELETE FROM feed_events WHERE created_at < NOW() - (%s || ' days')::interval",
            "SELECT COUNT(*) FROM feed_events WHERE created_at < NOW() - (%s || ' days')::interval",
            interval_param(args.event_days),
            False,
        ),
        (
            "low_score_video_items",
            """
            DELETE FROM items i
            USING video_stats vs
            WHERE vs.item_id = i.id
              AND i.item_role = 'video_variant'
              AND i.stored_at < NOW() - (%s || ' days')::interval
              AND vs.score <= %s
            """,
            """
            SELECT COUNT(*)
            FROM items i
            INNER JOIN video_stats vs ON vs.item_id = i.id
            WHERE i.item_role = 'video_variant'
              AND i.stored_at < NOW() - (%s || ' days')::interval
              AND vs.score <= %s
            """,
            (max(args.low_score_video_days, 1), args.low_score_threshold),
            True,
        ),
        (
            "non_video_items",
            """
            DELETE FROM items
            WHERE item_role <> 'video_variant'
              AND stored_at < NOW() - (%s || ' days')::interval
            """,
            """
            SELECT COUNT(*) FROM items
            WHERE item_role <> 'video_variant'
              AND stored_at < NOW() - (%s || ' days')::interval
            """,
            interval_param(args.non_video_days),
            True,
        ),
        (
            "regular_video_items",
            """
            DELETE FROM items i
            WHERE i.item_role = 'video_variant'
              AND i.stored_at < NOW() - (%s || ' days')::interval
              AND COALESCE((SELECT vs.score FROM video_stats vs WHERE vs.item_id = i.id), 0) < %s
              AND NOT EXISTS (
                SELECT 1
                FROM target_profiles tp
                WHERE tp.target_id = i.target_id
                  AND tp.is_public_pool = TRUE
              )
            """,
            """
            SELECT COUNT(*) FROM items i
            WHERE i.item_role = 'video_variant'
              AND i.stored_at < NOW() - (%s || ' days')::interval
              AND COALESCE((SELECT vs.score FROM video_stats vs WHERE vs.item_id = i.id), 0) < %s
              AND NOT EXISTS (
                SELECT 1
                FROM target_profiles tp
                WHERE tp.target_id = i.target_id
                  AND tp.is_public_pool = TRUE
              )
            """,
            (max(args.video_days, 1), args.high_score_threshold),
            True,
        ),
        (
            "public_video_items",
            """
            DELETE FROM items i
            WHERE i.item_role = 'video_variant'
              AND i.stored_at < NOW() - (%s || ' days')::interval
              AND COALESCE((SELECT vs.score FROM video_stats vs WHERE vs.item_id = i.id), 0) < %s
              AND EXISTS (
                SELECT 1
                FROM target_profiles tp
                WHERE tp.target_id = i.target_id
                  AND tp.is_public_pool = TRUE
              )
            """,
            """
            SELECT COUNT(*) FROM items i
            WHERE i.item_role = 'video_variant'
              AND i.stored_at < NOW() - (%s || ' days')::interval
              AND COALESCE((SELECT vs.score FROM video_stats vs WHERE vs.item_id = i.id), 0) < %s
              AND EXISTS (
                SELECT 1
                FROM target_profiles tp
                WHERE tp.target_id = i.target_id
                  AND tp.is_public_pool = TRUE
              )
            """,
            (max(args.public_video_days, 1), args.high_score_threshold),
            True,
        ),
        (
            "high_score_video_items",
            """
            DELETE FROM items i
            USING video_stats vs
            WHERE vs.item_id = i.id
              AND i.item_role = 'video_variant'
              AND i.stored_at < NOW() - (%s || ' days')::interval
              AND vs.score >= %s
            """,
            """
            SELECT COUNT(*)
            FROM items i
            INNER JOIN video_stats vs ON vs.item_id = i.id
            WHERE i.item_role = 'video_variant'
              AND i.stored_at < NOW() - (%s || ' days')::interval
              AND vs.score >= %s
            """,
            (max(args.high_score_video_days, 1), args.high_score_threshold),
            True,
        ),
    ]

    result: dict[str, int] = {}
    deleted_item_ids: list[str] = []
    with connect(database_url, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            for name, delete_sql, count_sql, params, deletes_items in statements:
                if args.apply:
                    if deletes_items:
                        cur.execute(f"{delete_sql.rstrip()}\nRETURNING id::text AS id", params)
                        rows = cur.fetchall()
                        result[name] = len(rows)
                        deleted_item_ids.extend(str(row[0] if not isinstance(row, dict) else row["id"]) for row in rows)
                    else:
                        cur.execute(delete_sql, params)
                        result[name] = cur.rowcount
                else:
                    cur.execute(count_sql, params)
                    result[name] = cur.fetchone()[0]
        if args.apply:
            conn.commit()
            if deleted_item_ids:
                delete_opensearch_items(deleted_item_ids)
        else:
            conn.rollback()

    print({"apply": args.apply, "deleted": result, "opensearch_deleted": len(set(deleted_item_ids)) if args.apply else 0})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
