import Link from "next/link";
import { Search } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { MobileNav, UserMenu } from "./header-client";

export const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/subjects", label: "Subjects" },
  { href: "/explore?price=free", label: "Free Notes" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Search">
            <Link href="/search">
              <Search />
            </Link>
          </Button>
          {user ? (
            <UserMenu
              name={user.displayName || user.email || "Account"}
              email={user.email}
              showAdmin={isStaff(user.roles)}
            />
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/register">Get Started</Link>
              </Button>
            </div>
          )}
          <MobileNav links={NAV_LINKS} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
