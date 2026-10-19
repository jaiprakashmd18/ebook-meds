import { NextResponse, type NextRequest } from "next/server";
import { getItemBySlug } from "@/lib/data/catalog";
import { resolveAccess } from "@/lib/access/content";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { getServerEnv, isDemoMode } from "@/lib/env";
import { watermarkPdf } from "@/lib/pdf/watermark";
import { slugify } from "@/lib/utils";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

/**
 * Authorised PDF download. The access decision is made here on the server for
 * the verified session user; the file itself lives in a private bucket and is
 * served via a 60-second signed URL (or streamed with a buyer watermark).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (isDemoMode() || !isAdminClientConfigured()) {
    return NextResponse.json({ error: "Downloads are not available on this environment." }, { status: 503, headers: NO_STORE });
  }
  const item = await getItemBySlug(slug);
  if (!item || !item.pdf_downloadable || !item.has_pdf) {
    return NextResponse.json({ error: "No PDF is available for this title." }, { status: 404, headers: NO_STORE });
  }
  const user = await getCurrentUser();
  if (!item.is_free && !user) {
    const login = new URL(`/auth/login?next=${encodeURIComponent(`/notes/${item.slug}`)}`, request.nextUrl.origin);
    return NextResponse.redirect(login, { headers: NO_STORE });
  }
  const access = await resolveAccess(item);
  if (!access.granted) {
    return NextResponse.json({ error: "You do not have access to this file." }, { status: 403, headers: NO_STORE });
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin.from("content_items").select("current_version_id").eq("id", item.id).single();
  const { data: version } = await admin
    .from("content_versions")
    .select("version_number, pdf_storage_path, pdf_checked_at")
    .eq("id", row?.current_version_id ?? "")
    .maybeSingle();
  if (!version?.pdf_storage_path || !version.pdf_checked_at) {
    return NextResponse.json({ error: "The PDF for the current version is being prepared." }, { status: 404, headers: NO_STORE });
  }
  const filename = `${slugify(item.title)}-v${version.version_number}.pdf`;

  if (getServerEnv().PDF_WATERMARK && user && !item.is_free) {
    const { data: blob, error } = await admin.storage.from("ebooks").download(version.pdf_storage_path);
    if (error || !blob) return NextResponse.json({ error: "Download failed. Please try again." }, { status: 502, headers: NO_STORE });
    const stamped = await watermarkPdf(new Uint8Array(await blob.arrayBuffer()), {
      email: user.email,
      reference: user.id.slice(0, 8).toUpperCase(),
    });
    return new NextResponse(Buffer.from(stamped), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const { data: signed, error } = await admin.storage.from("ebooks").createSignedUrl(version.pdf_storage_path, 60, { download: filename });
  if (error || !signed) return NextResponse.json({ error: "Download failed. Please try again." }, { status: 502, headers: NO_STORE });
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: NO_STORE });
}
