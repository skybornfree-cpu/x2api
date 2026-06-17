from __future__ import annotations

from collections.abc import Callable
from typing import Any


PostCommitCallback = Callable[[Any], None]


class PostCommitOpenSearchConnection:
    def __init__(self, conn: Any):
        self._conn = conn
        self._after_commit: list[PostCommitCallback] = []

    def defer_opensearch_operation(self, callback: PostCommitCallback) -> None:
        self._after_commit.append(callback)

    def _run_after_commit(self) -> None:
        if not self._after_commit:
            return

        callbacks = self._after_commit
        self._after_commit = []
        try:
            for callback in callbacks:
                callback(self._conn)
            self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

    def commit(self) -> None:
        self._conn.commit()
        self._run_after_commit()

    def rollback(self) -> None:
        self._after_commit = []
        self._conn.rollback()

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def close(self) -> None:
        self._conn.close()

    def __enter__(self):
        self._conn.__enter__()
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        try:
            if exc_type is not None:
                self.rollback()
            else:
                self.commit()
        finally:
            self.close()
        return False

    def __getattr__(self, name: str):
        return getattr(self._conn, name)
