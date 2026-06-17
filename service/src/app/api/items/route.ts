import { requireClient } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listItems } from "@/lib/item-service";
import { PaginationInputError } from "@/lib/pagination";
import { parseStringListParam } from "@/lib/query-params";

function parsePositiveInt(raw: string | null, field: string) {
  if (raw === null) {
    return undefined;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid ${field}. Expected a positive integer.`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Invalid ${field}. Expected a positive integer.`);
  }

  return value;
}

function parseSince(raw: string | null) {
  if (raw === null) {
    return undefined;
  }

  const since = new Date(raw);
  if (Number.isNaN(since.getTime())) {
    throw new Error("Invalid since. Expected an ISO8601 datetime string.");
  }

  return raw;
}

function parseSourceScope(raw: string | null) {
  if (raw === null || raw === "") {
    return undefined;
  }
  if (raw === "user" || raw === "public" || raw === "all") {
    return raw;
  }
  throw new Error("Invalid sourceScope. Expected user, public, or all.");
}

export async function GET(request: Request) {
  try {
    const client = await requireClient();
    const { searchParams } = new URL(request.url);
    const result = await listItems({
      clientId: client.id,
      limit: parsePositiveInt(searchParams.get("limit"), "limit"),
      cursor: searchParams.get("cursor"),
      keyword: searchParams.get("keyword"),
      target: searchParams.get("target"),
      tags: parseStringListParam(searchParams, "tag"),
      categories: parseStringListParam(searchParams, "category"),
      since: parseSince(searchParams.get("since")),
      sourceScope: parseSourceScope(searchParams.get("sourceScope")),
    });

    return jsonOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query items.";
    if (message === "Missing API key." || message === "Invalid API key.") {
      return jsonError(message, 401);
    }
    if (error instanceof PaginationInputError || message.startsWith("Invalid ")) {
      return jsonError(message, 400);
    }
    return jsonError(message, 500);
  }
}
