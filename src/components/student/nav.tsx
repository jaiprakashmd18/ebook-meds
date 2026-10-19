"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/library", label: "Library" },
  { href: "/progress", label: "Progress" },
  { href: "/bookmarks", label: "Bookmarks" },
  { href: "/highlights", label: "Highlights & notes" },
  { href: "/orders", label: "Orders" },
  { href: "/subscription", label: "Subscription" },
  { href: "/account", label: "Account" },
];

export function StudentNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Your account" className="lg:w-52 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-20 lg:flex-col lg:pb-0">
        {ITEMS.map((i) => {
          const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn("block shrink-0 rounded-lg px-3 py-2 text-sm whitespace-nowrap", active ? "bg-surface font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
