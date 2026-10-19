import Link from "next/link";
import { BookOpenCheck, Eye, FileCheck2, Layers, LockKeyhole, PenLine, RefreshCcw, ShieldCheck } from "lucide-react";
import { getHomeCollections, listSubjects } from "@/lib/data/catalog";
import { getReadableContent } from "@/lib/access/content";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { SectionRow } from "@/components/site/section-row";
import { ReaderPreview } from "@/components/site/reader-preview";
import { paletteFor } from "@/components/site/cover";

const STEPS = [
  { title: "Choose a subject", body: "Start from a subject or search for the topic you are stuck on.", Icon: Layers },
  { title: "Preview the notes", body: "Every paid title has a free preview, so you know the style before you buy.", Icon: Eye },
  { title: "Purchase or read free", body: "Free notes open instantly. Paid notes unlock after a verified payment.", Icon: LockKeyhole },
  { title: "Read online or download", body: "Use the distraction-free reader, or download the PDF where it is offered.", Icon: BookOpenCheck },
  { title: "Revise and practise", body: "Finish with summaries, high-yield points, MCQs and viva questions.", Icon: PenLine },
];

const TRUST = [
  {
    title: "Content quality standards",
    body: "Notes follow a consistent structure: first principles, precise definitions beside simplified explanations, and references to established textbooks.",
    Icon: FileCheck2,
  },
  {
    title: "Educational review process",
    body: "Each title shows whether it has been reviewed and by whom. We never display a reviewer or endorsement that has not happened.",
    Icon: ShieldCheck,
  },
  {
    title: "Secure payments",
    body: "Payments are processed by our payment provider. Access is granted only after the provider confirms the payment to our server.",
    Icon: LockKeyhole,
  },
  {
    title: "Access to what you buy",
    body: "Purchased titles stay in your library, including updates to the edition you bought, as described in our terms.",
    Icon: BookOpenCheck,
  },
  {
    title: "Corrections policy",
    body: "Spotted an error? Report it from any section. Corrections are reviewed, and fixes are published as a new version.",
    Icon: RefreshCcw,
  },
];

export default async function HomePage() {
  const [collections, subjects] = await Promise.all([getHomeCollections(), listSubjects()]);
  const sample = collections.free[0] ?? null;
  const sampleContent = sample ? await getReadableContent(sample) : null;
  const sampleSection = sampleContent?.content?.sections[0] ?? null;
  // With a small catalogue, avoid repeating a row that shows only titles already shown above.
  const seen = new Set<string>();
  const fresh = (items: typeof collections.featured) => {
    const show = items.some((i) => !seen.has(i.id));
    items.forEach((i) => seen.add(i.id));
    return show ? items : [];
  };
  const rows = {
    featured: fresh(collections.featured),
    popular: fresh(collections.popular),
    free: fresh(collections.free),
    beginner: fresh(collections.beginner),
    recent: fresh(collections.recent),
    bundles: fresh(collections.bundles),
  };

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-surface to-background">
        <Container className="grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-6">
            <p className="text-sm font-medium text-accent">Study notes for medical students</p>
            <h1 className="text-[44px] leading-[1.04] font-semibold tracking-[-0.025em] text-balance sm:text-6xl">
              Big concepts. Simple explanations.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Understand difficult subjects with beautifully structured notes, visual explanations, exam-focused
              revision, and practical questions.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/explore">Explore Study Notes</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/explore?price=free">Browse Free Notes</Link>
              </Button>
            </div>
          </div>
          {sample && sampleSection ? <ReaderPreview item={sample} section={sampleSection} /> : null}
        </Container>
      </section>

      <Container>
        <SectionRow title="Featured" description="Titles we recommend starting with." href="/explore" items={rows.featured} />
        <SectionRow title="Popular" description="Most read and purchased recently." href="/explore" items={rows.popular} />
        <SectionRow title="Free learning resources" description="Complete notes, free to read." href="/explore?price=free" items={rows.free} />
        <SectionRow title="Recommended for beginners" href="/explore?difficulty=beginner" items={rows.beginner} />
        <SectionRow title="Recently published" href="/explore?sort=newest" items={rows.recent} />
        <SectionRow title="Best-value bundles" description="Related titles together, for less." href="/explore?type=bundle" items={rows.bundles} />

        <section className="py-12" aria-labelledby="subjects-heading">
          <div className="mb-7 flex items-end justify-between">
            <h2 id="subjects-heading" className="text-2xl font-semibold tracking-tight">Subject collections</h2>
            <Link href="/subjects" className="text-sm text-accent hover:underline">All subjects</Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {subjects.map((s) => {
              const p = paletteFor(s.slug);
              return (
                <li key={s.id}>
                  <Link
                    href={`/subjects/${s.slug}`}
                    className="flex h-full flex-col gap-1 rounded-[var(--radius-lg)] border p-5 transition-shadow hover:shadow-md"
                    style={{ background: p.bg, borderColor: p.line, color: p.ink }}
                  >
                    <span className="text-[17px] font-semibold">{s.name}</span>
                    <span className="line-clamp-2 text-[13px] opacity-80">{s.description}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </Container>

      <section className="mt-12 border-y border-border bg-surface py-20" aria-labelledby="how-heading">
        <Container>
          <h2 id="how-heading" className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-background p-6 shadow-sm">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <s.Icon className="size-4" aria-hidden />
                </span>
                <h3 className="font-semibold">
                  <span className="text-muted-foreground">{i + 1}. </span>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="py-20" aria-labelledby="trust-heading">
        <Container>
          <div className="max-w-2xl">
            <h2 id="trust-heading" className="text-3xl font-semibold tracking-tight">Built on trust, not claims</h2>
            <p className="mt-3 text-[17px] text-muted-foreground">
              We do not show invented testimonials, ratings or sales figures. Ratings appear only when real readers
              have left reviews.
            </p>
          </div>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((t) => (
              <div key={t.title} className="flex gap-4">
                <t.Icon className="mt-1 size-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
