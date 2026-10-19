import Link from "next/link";
import { getServerEnv } from "@/lib/env";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Learn",
    links: [
      { href: "/explore", label: "Explore" },
      { href: "/subjects", label: "Subjects" },
      { href: "/explore?price=free", label: "Free notes" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    title: "StudySimplify",
    links: [
      { href: "/about", label: "About" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/refund-policy", label: "Refund policy" },
    ],
  },
];

export function SiteFooter() {
  const contact = getServerEnv().CONTACT_EMAIL;
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">Learn difficult topics the easy way.</p>
          {contact ? (
            <a href={`mailto:${contact}`} className="text-sm text-accent hover:underline">
              {contact}
            </a>
          ) : null}
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-xs font-semibold tracking-wide text-foreground uppercase">{col.title}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} StudySimplify. All rights reserved.</p>
          <p>Educational content only. Not a substitute for professional medical advice.</p>
        </div>
      </div>
    </footer>
  );
}
