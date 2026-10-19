import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/ui/misc";
import { Prose } from "@/components/site/prose";

export const metadata: Metadata = {
  title: "About",
  description: "StudySimplify helps students understand difficult academic topics through clear, structured notes.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <Container className="py-14">
      <PageHeader eyebrow="About" title="Learn difficult topics the easy way" />
      <Prose>
        <p>
          StudySimplify helps students understand difficult academic topics through clear explanations, structured notes,
          diagrams, examples, revision material and practice questions. We start with first-year MBBS subjects and will
          grow into other disciplines.
        </p>
        <h2>How we write notes</h2>
        <ul>
          <li>Every topic is explained from first principles before detail is added.</li>
          <li>Precise scientific definitions sit beside plain-language explanations, and the simple version never changes the meaning.</li>
          <li>Sections are labelled as basic concepts, detailed explanation, advanced detail, exam focus, clinical relevance or common mistakes.</li>
          <li>References point to established textbooks. We do not invent citations.</li>
        </ul>
        <h2>Review and corrections</h2>
        <p>
          Each title shows its version number, last update and review status. If a title has not been independently
          reviewed, we say so. Readers can report errors from any page; corrections are published as a new version and
          purchasers get the update.
        </p>
        <h2>What we do not do</h2>
        <ul>
          <li>We do not claim university endorsement or affiliation.</li>
          <li>We do not show invented testimonials, ratings or student numbers.</li>
          <li>We only publish material we have the rights to publish.</li>
          <li>Our notes are for learning. They are not medical advice or a guide to diagnosis or treatment.</li>
        </ul>
        <p><Link href="/contact">Get in touch</Link> with questions or partnership ideas.</p>
      </Prose>
    </Container>
  );
}
