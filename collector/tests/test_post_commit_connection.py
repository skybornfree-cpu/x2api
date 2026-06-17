from __future__ import annotations

import unittest

from collector.post_commit_connection import PostCommitOpenSearchConnection


class FakeConnection:
    def __init__(self):
        self.events: list[str] = []

    def commit(self):
        self.events.append("pg_commit")

    def rollback(self):
        self.events.append("pg_rollback")

    def close(self):
        self.events.append("close")


class PostCommitConnectionTest(unittest.TestCase):
    def test_commit_runs_deferred_callbacks_after_pg_commit(self):
        inner = FakeConnection()
        conn = PostCommitOpenSearchConnection(inner)

        conn.defer_opensearch_operation(lambda _conn: inner.events.append("os_index"))

        self.assertEqual(inner.events, [])
        conn.commit()
        self.assertEqual(inner.events, ["pg_commit", "os_index", "pg_commit"])

    def test_rollback_discards_deferred_callbacks(self):
        inner = FakeConnection()
        conn = PostCommitOpenSearchConnection(inner)

        conn.defer_opensearch_operation(lambda _conn: inner.events.append("os_index"))
        conn.rollback()

        self.assertEqual(inner.events, ["pg_rollback"])


if __name__ == "__main__":
    unittest.main()
