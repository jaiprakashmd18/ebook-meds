import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { getServerEnv } from "@/lib/env";
import { Container, PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  const email = getServerEnv().CONTACT_EMAIL;
  return (
    <Container className="py-14">
      <PageHeader eyebrow="Contact" title="We would like to hear from you" description="Questions about an order, a correction to the notes, or anything else." />
      <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border border-border p-6">
          <Mail className="size-5 text-accent" aria-hidden />
          <h2 className="mt-3 font-semibold">Email</h2>
          {email ? (
            <a href={`mailto:${email}`} className="mt-1 block text-accent hover:underline">{email}</a>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">A contact address has not been configured yet (CONTACT_EMAIL).</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">For order questions, include your order number from the Orders page.</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border p-6">
          <h2 className="font-semibold">Found an error in the notes?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use “Report an error” on the title’s page or inside the reader. Reports go straight to our editors with the
            exact section and version.
          </p>
        </div>
      </div>
      <Alert className="mt-8 max-w-3xl" tone="info" title="Medical emergencies">
        StudySimplify cannot give medical advice. If you or someone else needs urgent care, contact local emergency services.
      </Alert>
    </Container>
  );
}
