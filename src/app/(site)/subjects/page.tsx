import type { Metadata } from "next";
import Link from "next/link";
import { getSubjectCounts, listSubjects } from "@/lib/data/catalog";
import { Container, PageHeader } from "@/components/ui/misc";
import { paletteFor } from "@/components/site/cover";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Subjects",
  description: "Study notes organised by subject: anatomy, histology, biochemistry, physiology and more.",
  alternates: { canonical: "/subjects" },
};

export default async function SubjectsPage() {
  const [subjects, counts] = await Promise.all([listSubjects(), getSubjectCounts()]);
  return (
    <Container className="py-14">
      <PageHeader eyebrow="Subjects" title="Choose a subject" description="Start with the subject, then follow a learning path from basics to exam focus." />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s) => {
          const p = paletteFor(s.slug);
          const n = counts.get(s.id) ?? 0;
          return (
            <li key={s.id}>
              <Link
                href={`/subjects/${s.slug}`}
                className="flex h-full flex-col gap-2 rounded-[var(--radius-lg)] border p-6 transition-shadow hover:shadow-md"
                style={{ background: p.bg, borderColor: p.line, color: p.ink }}
              >
                <span className="text-xl font-semibold tracking-tight">{s.name}</span>
                <span className="text-sm leading-relaxed opacity-85">{s.description}</span>
                <span className="mt-auto pt-3 text-xs font-medium opacity-75">
                  {n ? pluralize(n, "title") : "Notes in preparation"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
