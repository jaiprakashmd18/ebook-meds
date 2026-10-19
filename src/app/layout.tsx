import type { Metadata, Viewport } from "next";
import { publicEnv } from "@/lib/env";
import { EnvironmentBanner } from "@/components/site/demo-banner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "StudySimplify — Learn difficult topics the easy way",
    template: "%s · StudySimplify",
  },
  description:
    "Clear, structured study notes and ebooks for medical students: explanations from first principles, diagrams, exam-focused revision and practice questions.",
  applicationName: "StudySimplify",
  openGraph: {
    type: "website",
    siteName: "StudySimplify",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
  robots: publicEnv.appEnv === "production" ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-foreground px-4 py-2 text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <EnvironmentBanner />
        {children}
      </body>
    </html>
  );
}
