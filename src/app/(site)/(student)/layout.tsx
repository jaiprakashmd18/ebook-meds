import { requireUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { Container } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { StudentNav } from "@/components/student/nav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  if (isDemoMode()) {
    return (
      <Container className="py-20">
        <Alert tone="warning" title="Accounts need Supabase">
          Your dashboard, library and progress are stored in the database, so they are unavailable in demo mode.
        </Alert>
      </Container>
    );
  }
  const user = await requireUser();
  return (
    <Container className="py-10">
      {!user.emailConfirmed ? (
        <Alert tone="warning" className="mb-6" title="Please verify your email">Check your inbox for the verification link.</Alert>
      ) : null}
      <div className="flex flex-col gap-8 lg:flex-row">
        <StudentNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </Container>
  );
}
