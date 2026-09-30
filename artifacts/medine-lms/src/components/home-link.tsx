import { BookOpenText, Home } from 'lucide-react';
import { Link } from 'wouter';

export function HomeLink({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`focus-ring inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
        dark
          ? 'text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--primary))]'
      }`}
      data-testid="link-home"
    >
      <Home size={15} />
      Ana səhifə
    </Link>
  );
}

export function ArticlesLink({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/articles"
      className={`focus-ring inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
        dark
          ? 'text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--primary))]'
      }`}
      data-testid="link-articles"
    >
      <BookOpenText size={15} />
      Məqalələr
    </Link>
  );
}