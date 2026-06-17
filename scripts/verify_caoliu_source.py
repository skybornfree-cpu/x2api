from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from collector.caoliu_source import CAOLIU_DEFAULT_BASE_URL, monitor_site  # noqa: E402


def main() -> int:
    stats = monitor_site(
        None,
        base_url=CAOLIU_DEFAULT_BASE_URL,
        max_pages=5,
        retention_hours=24 * 3650,
        public_pool=False,
        dry_run=True,
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2, default=str))
    if int(stats.get("parsed_posts") or 0) <= 0:
        raise SystemExit("verify_caoliu_source failed: parsed_posts=0")
    if int(stats.get("skipped_detail_errors") or 0) >= int(stats.get("parsed_posts") or 0) and int(stats.get("parsed_posts") or 0) > 0:
        raise SystemExit("verify_caoliu_source failed: all parsed posts errored")
    if not stats.get("samples"):
        raise SystemExit("verify_caoliu_source failed: no samples")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
