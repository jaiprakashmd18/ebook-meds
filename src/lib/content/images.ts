import { publicEnv } from "@/lib/env";

/** Resolve a stored image reference ("storage:path" or absolute/relative URL) to a URL. */
export function resolveImageSrc(src: string): string {
  if (src.startsWith("storage:")) {
    const path = src.slice("storage:".length).replace(/^\/+/, "");
    return `${publicEnv.supabaseUrl}/storage/v1/object/public/content-images/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }
  return src;
}

export function publicCoverUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/covers/${path.split("/").map(encodeURIComponent).join("/")}`;
}
