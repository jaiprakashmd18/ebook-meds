import { requirePermission } from "@/lib/auth/session";
import { listAdminSubjects, listBundleCandidates } from "@/lib/data/admin";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { ContentDetailsForm } from "@/components/admin/content-details-form";

export const metadata = { title: "New content" };

export default async function NewContentPage() {
  await requirePermission("content.edit");
  const [subjects, bundleCandidates] = await Promise.all([listAdminSubjects(), listBundleCandidates()]);
  return (
    <>
      <AdminHeader title="New content item" description="Creates a draft. Nothing is visible to students until you publish it." />
      <Panel>
        <ContentDetailsForm
          mode="create"
          subjects={subjects}
          bundleCandidates={bundleCandidates}
          defaults={{
            title: "",
            slug: "",
            subtitle: "",
            description: "",
            subjectId: subjects[0]?.id ?? "",
            topicId: "",
            contentType: "study_note",
            difficulty: "beginner",
            isFree: false,
            price: "",
            currency: "INR",
            subscriptionEligible: false,
            byline: "",
            learningObjectives: "",
            tags: "",
            pdfDownloadable: false,
            featured: false,
            bundleItemIds: [],
          }}
        />
      </Panel>
    </>
  );
}
