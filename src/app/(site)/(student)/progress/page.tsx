import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProgress } from "@/lib/data/student";
import { ProgressList } from "@/components/student/progress-list";
import { EmptyState, Stat } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireUser("/progress");
  const rows = await getProgress(user);
  const finished = rows.filter((r) => r.completion_percentage === 100).length;
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Learning progress</h1>
        <p className="mt-1 text-muted-foreground">Progress counts sections you marked as complete. Go at whatever pace works for you.</p>
      </header>
      {rows.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Titles started" value={rows.length} />
            <Stat label="Titles completed" value={finished} />
            <Stat label="In progress" value={rows.length - finished} />
          </div>
          <ProgressList rows={rows} />
        </>
      ) : (
        <EmptyState icon={<TrendingUp />} title="No progress yet" description="Open any note and use “Mark section as complete” to track what you have covered." action={<Button asChild><Link href="/explore?price=free">Start with a free note</Link></Button>} />
      )}
    </div>
  );
}
