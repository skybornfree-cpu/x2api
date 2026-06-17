import { getSql, type SqlFunction } from "@/lib/db";
import { asRows } from "@/lib/sql-result";

export async function filterExistingItemIds(itemIds: string[], sqlClient?: SqlFunction) {
  const normalized = [...new Set(itemIds.map((itemId) => itemId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    return new Set<string>();
  }

  const sql = sqlClient ?? getSql();
  const rows = asRows<{ id: string }>(await sql`
    SELECT id::text AS id
    FROM items
    WHERE id = ANY(${normalized}::uuid[])
      AND expires_at > NOW()
  `);
  return new Set(rows.map((row) => row.id));
}
