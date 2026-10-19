import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 10.5c0-.8.7-1.5 1.5-1.5H15v14h-4.5c-.8 0-1.5-.7-1.5-1.5v-11Z" fill="#fff" opacity=".95" />
      <path d="M17 9h4.5c.8 0 1.5.7 1.5 1.5v11c0 .8-.7 1.5-1.5 1.5H17V9Z" fill="#fff" opacity=".7" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)} aria-label="StudySimplify home">
      <LogoMark />
      <span className="text-[17px]">StudySimplify</span>
    </Link>
  );
}
