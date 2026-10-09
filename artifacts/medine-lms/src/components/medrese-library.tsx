import { Library } from 'lucide-react';

export function MedreseLibrary({ canManage = false }: { canManage?: boolean }) {
  return (
    <section className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] px-5 py-12 text-center" data-testid="section-medrese-library">
      <Library className="mx-auto text-[hsl(var(--primary))]" size={28} />
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{canManage ? 'Kitabxana idarəsi' : 'Kitabxana'}</p>
      <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Mədrəsə Kitabxanası</h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-[hsl(var(--muted-foreground))]">Hələ kitab əlavə edilməyib.</p>
    </section>
  );
}
