"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, CreditCard, LayoutDashboard, LogOut, Menu, Settings, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";

export function UserMenu({ name, email, showAdmin }: { name: string; email: string | null; showAdmin: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 items-center justify-center rounded-full bg-foreground text-[13px] font-semibold text-background"
        aria-label="Open account menu"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{name}</span>
          {email && email !== name ? <span className="block truncate">{email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard"><LayoutDashboard /> Dashboard</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/library"><BookOpen /> Library</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/orders"><CreditCard /> Orders</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account"><Settings /> Account</Link>
        </DropdownMenuItem>
        {showAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin"><Shield /> Admin</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut /> Sign out</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileNav({ links, signedIn }: { links: { href: string; label: string }[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X /> : <Menu />}
      </Button>
      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="absolute inset-x-0 top-14 border-b border-border bg-background px-4 pt-2 pb-6 shadow-md"
        >
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg px-2 py-3 text-[17px]">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {!signedIn ? (
            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/auth/register">Get Started</Link>
              </Button>
            </div>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
