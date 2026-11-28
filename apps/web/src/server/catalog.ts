import "server-only";
import { randomUUID } from "node:crypto";
import { CatalogService } from "@encore/core";
import {
  SupabaseCatalogRepository,
  SupabaseMediaStorage,
  SupabaseRightsRepository,
  sha256,
  mp3Inspector,
} from "@encore/infrastructure";
export function catalog() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure Supabase");
  const repo = new SupabaseCatalogRepository(url, key),
    storage = new SupabaseMediaStorage(url, key);
  return {
    repo,
    rights: new SupabaseRightsRepository(url, key),
    storage,
    service: new CatalogService(
      repo,
      storage,
      sha256,
      mp3Inspector,
      randomUUID,
    ),
  };
}
