import Link from "next/link";
import { Logo } from "@/components/site/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex flex-1 flex-col items-center bg-surface px-4 py-12 sm:py-20">
      <Logo className="mb-8" />
      <div className="w-full max-w-[420px] rounded-[var(--radius-xl)] border border-border bg-background p-6 shadow-sm sm:p-8">
        {children}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:underline">Privacy</Link> · <Link href="/terms" className="hover:underline">Terms</Link>
      </p>
    </main>
  );
}
