import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  // Only production is indexable; preview and development deployments are not.
  if (publicEnv.appEnv !== "production") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin", "/api/", "/auth/", "/reader/", "/preview/", "/checkout/", "/dashboard", "/library",
          "/bookmarks", "/highlights", "/progress", "/orders", "/account", "/subscription", "/search", "/dev/",
        ],
      },
    ],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
