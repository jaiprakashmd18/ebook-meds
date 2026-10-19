import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/misc";
import { LegalNotice, Prose } from "@/components/site/prose";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <Container className="py-14">
      <PageHeader title="Privacy policy" description="Last updated: [date]" />
      <Prose>
        <LegalNotice />
        <p>This policy explains what personal data [Business legal name] (“StudySimplify”, “we”) collects and why.</p>
        <h2>Data we collect</h2>
        <ul>
          <li><strong>Account data:</strong> email address, optional display name, and an encrypted password managed by our authentication provider.</li>
          <li><strong>Learning data:</strong> bookmarks, highlights, private notes, sections you complete and your reading position. Only you can see these.</li>
          <li><strong>Purchase data:</strong> orders, amounts, currency and the payment provider’s reference. We do not receive or store your full card details.</li>
          <li><strong>Search history:</strong> stored only if you switch it on in Account → Preferences. Separately we keep an anonymous count of search terms (no account attached) to improve the catalogue.</li>
          <li><strong>Aggregate usage:</strong> daily counts of product views, previews and reader opens per title, without user identifiers.</li>
          <li><strong>Feedback:</strong> reviews, error reports and feedback you choose to send.</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>To provide your account, library and purchases.</li>
          <li>To send transactional emails such as receipts and password resets.</li>
          <li>To send product announcements only if you opt in.</li>
          <li>To fix errors in our content and improve the service.</li>
        </ul>
        <h2>Processors</h2>
        <p>We use [Supabase] for hosting the database and authentication, [Vercel] for hosting the website, [payment provider] for payments and [email provider] for email. They process data on our behalf.</p>
        <h2>Watermarks</h2>
        <p>Downloaded PDFs may carry a small licence line with a shortened form of your email address and order reference. It is not visible to anyone you do not share the file with.</p>
        <h2>Retention and deletion</h2>
        <p>You can request account deletion from Account settings. We delete learning data and profile information; we keep order records for as long as tax and accounting law requires, without your profile.</p>
        <h2>Your rights</h2>
        <p>You may access, correct or delete your data, and object to processing, as provided by applicable law. Contact us at [contact email].</p>
      </Prose>
    </Container>
  );
}
