import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { listAdminSubjects } from "@/lib/data/admin";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { DeleteButton, SubjectForm, TopicForm } from "@/components/admin/forms";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const user = await requirePermission("categories.manage");
  const subjects = await listAdminSubjects();
  const canDelete = can(user.roles, "settings.manage");
  return (
    <>
      <AdminHeader title="Subjects and topics" description="Hidden subjects are not shown to students. Subjects with content cannot be deleted." />
      <div className="flex flex-col gap-4">
        <Panel title="New subject"><SubjectForm /></Panel>
        {subjects.map((s) => (
          <Panel key={s.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{s.name}</h2>
              {canDelete ? <DeleteButton kind="subject" id={s.id} label={`subject ${s.name}`} /> : null}
            </div>
            <SubjectForm subject={s} />
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium">Topics</p>
              <ul className="mb-3 flex flex-wrap gap-2">
                {s.topics.map((t) => (
                  <li key={t.id} className="flex items-center gap-1 rounded-full bg-surface py-0.5 pr-1 pl-3 text-sm">
                    {t.name} <DeleteButton kind="topic" id={t.id} label={`topic ${t.name}`} />
                  </li>
                ))}
                {!s.topics.length ? <li className="text-sm text-muted-foreground">No topics yet.</li> : null}
              </ul>
              <TopicForm subjectId={s.id} />
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
