import { requirePermission } from "@/lib/auth/session";
import { listAdminSubjects } from "@/lib/data/admin";
import { AdminHeader } from "@/components/admin/ui";
import { BulkUpload } from "@/components/admin/bulk-upload";

export const metadata = { title: "Bulk PDF upload" };

export default async function BulkUploadPage() {
  await requirePermission("content.edit");
  const subjects = await listAdminSubjects();
  return (
    <>
      <AdminHeader title="Bulk PDF upload" description="Create draft items from existing PDFs. Every upload is validated and stays a draft until someone reviews and publishes it." />
      <BulkUpload subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />
    </>
  );
}
