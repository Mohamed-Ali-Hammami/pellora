'use client';

/**
 * Filtres de la boutique.
 *
 * Le filtrage lui-même est fait CÔTÉ SERVEUR, à partir des paramètres d'URL.
 * Ce composant ne fait que réécrire l'URL. Trois raisons : la page reste
 * indexable et partageable avec ses filtres, elle fonctionne sans JavaScript
 * via le bouton de repli, et les cartes produit restent des composants
 * serveur — un composant client ne peut pas en rendre.
 */

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  basePath: string;
  current: { category: string; power: string; sort: string };
  options: {
    category: readonly FilterOption[];
    power: readonly FilterOption[];
    sort: readonly FilterOption[];
  };
  labels: { category: string; power: string; sort: string; reset: string; apply: string };
  resultCount: number;
  resultLabel: string;
}

export function ShopFilters({ basePath, current, options, labels, resultCount, resultLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams({ ...current });
    if (value === '' || value === 'all') params.delete(key);
    else params.set(key, value);

    const query = params.toString();
    startTransition(() => router.push(query ? `${basePath}?${query}` : basePath, { scroll: false }));
  }

  const hasFilters = current.category !== 'all' || current.power !== 'all' || current.sort !== 'power-asc';

  return (
    // `method="get"` : sans JavaScript, le bouton de repli soumet le formulaire
    // et le serveur reçoit les mêmes paramètres.
    <form
      method="get"
      action={basePath}
      className="flex flex-wrap items-end gap-4 rounded-xl border border-line bg-cream p-4"
    >
      <Select
        name="category"
        label={labels.category}
        value={current.category}
        options={options.category}
        onChange={(value) => update('category', value)}
      />
      <Select
        name="power"
        label={labels.power}
        value={current.power}
        options={options.power}
        onChange={(value) => update('power', value)}
      />
      <Select
        name="sort"
        label={labels.sort}
        value={current.sort}
        options={options.sort}
        onChange={(value) => update('sort', value)}
      />

      <noscript>
        <button type="submit" className="btn-secondary px-4 py-2 text-sm">
          {labels.apply}
        </button>
      </noscript>

      <p
        className="ml-auto text-sm text-muted"
        aria-live="polite"
        data-pending={pending ? 'true' : undefined}
      >
        {resultCount} {resultLabel}
        {hasFilters ? (
          <>
            {' · '}
            <a href={basePath} className="underline underline-offset-4 hover:text-ink">
              {labels.reset}
            </a>
          </>
        ) : null}
      </p>
    </form>
  );
}

function Select({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className="mb-1.5 block text-xs font-semibold text-muted">
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
