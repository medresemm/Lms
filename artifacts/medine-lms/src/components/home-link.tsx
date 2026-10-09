import { BookOpenText, Home } from 'lucide-react';
import { Link } from 'wouter';

const linkClass = (dark: boolean, compact: boolean) => `focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${
  dark
    ? 'border-transparent text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
    : compact
      ? 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent)/.35)]'
      : 'border-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--primary))]'
}`;

export function HomeLink({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <Link href="/" aria-label="Ana səhifə" className={linkClass(dark, compact)} data-testid="link-home">
      <Home size={15} />
      <span className={compact ? 'hidden sm:inline' : undefined}>Ana səhifə</span>
    </Link>
  );
}

export function ArticlesLink({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <Link href="/articles" aria-label="Məqalələr" className={linkClass(dark, compact)} data-testid="link-articles">
      <BookOpenText size={15} />
      <span className={compact ? 'hidden sm:inline' : undefined}>Məqalələr</span>
    </Link>
  );
}
