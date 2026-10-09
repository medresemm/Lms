import { BookOpenText, Home } from 'lucide-react';
import { Link } from 'wouter';

export function HomeLink({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Ana səhifə"
      className={`focus-ring inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold transition sm:px-3 ${
        dark
          ? 'text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--primary))]'
      }`}
      data-testid="link-home"
    >
      <Home size={15} />
      <span className={compact ? 'hidden sm:inline' : undefined}>Ana səhifə</span>
    </Link>
  );
}

export function ArticlesLink({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <Link
      href="/articles"
      aria-label="Məqalələr"
      className={`focus-ring inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold transition sm:px-3 ${
        dark
          ? 'text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--primary))]'
      }`}
      data-testid="link-articles"
    >
      <BookOpenText size={15} />
      <span className={compact ? 'hidden sm:inline' : undefined}>Məqalələr</span>
    </Link>
  );
}