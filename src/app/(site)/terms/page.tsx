import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/ui/misc";
import { LegalNotice, Prose } from "@/components/site/prose";

export const metadata: Metadata = { title: "Terms of service", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <Container className="py-14">
      <PageHeader title="Terms of service" description="Last updated: [date]" />
      <Prose>
        <LegalNotice />
        <h2>The service</h2>
        <p>StudySimplify provides educational notes and ebooks. Content is for learning and revision only and is not medical advice.</p>
        <h2>Accounts</h2>
        <p>You must provide accurate information and keep your password secure. Accounts are personal and may not be shared.</p>
        <h2>Purchases and licence</h2>
        <ul>
          <li>Buying a title gives you a personal, non-transferable licence to read it online and, where offered, download it for personal study.</li>
          <li>You get updates to a purchased title (corrections and new versions of the same title) at no extra cost.</li>
          <li>You may not resell, redistribute or publicly share purchased content.</li>
          <li>Downloaded files can technically be copied; we rely on this licence, not on copy protection.</li>
        </ul>
        <h2>Subscriptions</h2>
        <p>If offered, a subscription gives access to eligible titles while it is active. It renews automatically until cancelled. When it ends, access to titles you did not buy separately ends at the close of the paid period.</p>
        <h2>Refunds</h2>
        <p>See our <Link href="/refund-policy">refund policy</Link>.</p>
        <h2>Accuracy</h2>
        <p>We work to keep content accurate and correct errors promptly, but we do not guarantee that content is free of errors or suitable for any particular examination.</p>
        <h2>Contact</h2>
        <p>[Business legal name], [address], [contact email].</p>
      </Prose>
    </Container>
  );
}
