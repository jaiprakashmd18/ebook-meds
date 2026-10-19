import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/misc";
import { LegalNotice, Prose } from "@/components/site/prose";

export const metadata: Metadata = { title: "Refund policy", alternates: { canonical: "/refund-policy" } };

export default function RefundPolicyPage() {
  return (
    <Container className="py-14">
      <PageHeader title="Digital product refund policy" description="Last updated: [date]" />
      <Prose>
        <LegalNotice />
        <p>Because our products are digital and available immediately, please use the free preview before buying.</p>
        <h2>When you can get a refund</h2>
        <ul>
          <li>You were charged twice for the same order, or charged for an order that did not unlock.</li>
          <li>The title is materially different from its description, or has errors we cannot correct within [14] days of your report.</li>
          <li>You request a refund within [7] days of purchase and have not downloaded the PDF.</li>
        </ul>
        <h2>What happens to access</h2>
        <ul>
          <li><strong>Full refund:</strong> access to the refunded title (or every title in a refunded bundle) is removed.</li>
          <li><strong>Partial refund</strong> (for example, compensation for an error): you keep access.</li>
        </ul>
        <h2>Subscriptions</h2>
        <p>You can cancel any time. You keep access until the end of the period you paid for. We do not refund partial periods unless required by law.</p>
        <h2>How to ask</h2>
        <p>Email [contact email] with your order number. Refunds go back to the original payment method through our payment provider; timing depends on your bank.</p>
      </Prose>
    </Container>
  );
}
