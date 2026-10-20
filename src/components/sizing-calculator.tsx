'use client';

/**
 * Calculateur de puissance.
 *
 * Le calcul lui-même vit dans `lib/sizing.ts` — fonction pure, testée. Ce
 * composant n'est que l'interface. Les modèles candidats arrivent en
 * propriété, déjà localisés et déjà formatés par le serveur : un composant
 * client n'a pas à connaître le dictionnaire ni les règles de prix.
 *
 * Choix d'interface : le résultat s'affiche en continu, sans bouton
 * « Calculer ». Rien n'est envoyé au serveur, donc rien ne justifie de faire
 * attendre, et voir la fourchette bouger quand on change l'isolation est la
 * meilleure façon de comprendre que ce paramètre compte plus que la surface.
 */

import { useMemo, useState } from 'react';
import {
  computeSizing,
  fitsRange,
  SIZING_LIMITS,
  climateZones,
  insulationLevels,
  type ClimateZone,
  type InsulationLevel,
} from '@/lib/sizing';

export interface SizingCandidate {
  id: string;
  name: string;
  href: string;
  category: string;
  powerMinKw: number | null;
  powerMaxKw: number;
  /** Prix déjà formaté dans la langue courante. */
  price: string;
}

interface Props {
  candidates: readonly SizingCandidate[];
  locale: string;
  labels: {
    area: string;
    areaUnit: string;
    height: string;
    heightUnit: string;
    insulation: string;
    insulationOptions: Record<InsulationLevel, string>;
    climate: string;
    climateOptions: Record<ClimateZone, string>;
    resultTitle: string;
    resultRange: string;
    resultExplain: string;
    resultModels: string;
    resultNone: string;
    volume: string;
  };
}

export function SizingCalculator({ candidates, locale, labels }: Props) {
  const [area, setArea] = useState(80);
  const [height, setHeight] = useState(2.5);
  const [insulation, setInsulation] = useState<InsulationLevel>('average');
  const [climate, setClimate] = useState<ClimateZone>('temperate');

  const result = useMemo(
    () => computeSizing({ areaM2: area, heightM: height, insulation, climate }),
    [area, height, insulation, climate],
  );

  const matches = useMemo(
    () => candidates.filter((candidate) => fitsRange(candidate.powerMaxKw, result)),
    [candidates, result],
  );

  const format = (value: number, digits = 1) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-12">
      <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
        <div>
          <label htmlFor="sizing-area" className="mb-2 block text-sm font-semibold text-ink">
            {labels.area}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="sizing-area"
              type="range"
              min={SIZING_LIMITS.areaMin}
              max={300}
              step={5}
              value={area}
              onChange={(event) => setArea(Number(event.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[var(--color-ember)]"
            />
            <output className="tabular w-20 shrink-0 rounded-lg border border-line bg-cream px-2 py-1 text-center text-sm font-semibold">
              {format(area, 0)} {labels.areaUnit}
            </output>
          </div>
        </div>

        <div>
          <label htmlFor="sizing-height" className="mb-2 block text-sm font-semibold text-ink">
            {labels.height}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="sizing-height"
              type="range"
              min={SIZING_LIMITS.heightMin}
              max={4.5}
              step={0.1}
              value={height}
              onChange={(event) => setHeight(Number(event.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[var(--color-ember)]"
            />
            <output className="tabular w-20 shrink-0 rounded-lg border border-line bg-cream px-2 py-1 text-center text-sm font-semibold">
              {format(height)} {labels.heightUnit}
            </output>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">{labels.insulation}</legend>
          <div className="space-y-1.5">
            {insulationLevels.map((level) => (
              <label
                key={level}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  insulation === level ? 'border-ink bg-cream' : 'border-line hover:border-ink-soft'
                }`}
              >
                <input
                  type="radio"
                  name="insulation"
                  checked={insulation === level}
                  onChange={() => setInsulation(level)}
                  className="mt-1 accent-[var(--color-ember)]"
                />
                <span className="text-ink-soft">{labels.insulationOptions[level]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">{labels.climate}</legend>
          <div className="space-y-1.5">
            {climateZones.map((zone) => (
              <label
                key={zone}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  climate === zone ? 'border-ink bg-cream' : 'border-line hover:border-ink-soft'
                }`}
              >
                <input
                  type="radio"
                  name="climate"
                  checked={climate === zone}
                  onChange={() => setClimate(zone)}
                  className="mt-1 accent-[var(--color-ember)]"
                />
                <span className="text-ink-soft">{labels.climateOptions[zone]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>

      <div>
        <div className="ember-glow on-night rounded-xl p-7 text-white">
          <p className="eyebrow-light">{labels.resultTitle}</p>
          <p className="tabular mt-3 font-display text-5xl font-semibold leading-none">
            {format(result.minKw)} – {format(result.maxKw)}
            <span className="ml-2 text-2xl font-normal opacity-80">kW</span>
          </p>
          <p className="mt-2.5 text-sm text-white/60">
            {labels.resultRange} · {labels.volume} {format(result.volumeM3, 0)} m³
          </p>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/80">{labels.resultExplain}</p>
        </div>

        <div className="mt-8">
          <h3 className="text-lg">{labels.resultModels}</h3>

          {matches.length === 0 ? (
            <p className="mt-3 rounded-xl border border-line bg-cream p-5 text-sm text-ink-soft">
              {labels.resultNone}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {matches.map((candidate) => (
                <li key={candidate.id}>
                  <a
                    href={candidate.href}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-cream"
                  >
                    <span>
                      <span className="block font-semibold text-ink">{candidate.name}</span>
                      <span className="text-xs text-muted">{candidate.category}</span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="tabular text-sm text-ink-soft">
                        {candidate.powerMinKw === null
                          ? format(candidate.powerMaxKw)
                          : `${format(candidate.powerMinKw)} – ${format(candidate.powerMaxKw)}`}{' '}
                        kW
                      </span>
                      <span className="tabular text-sm font-semibold text-ink">{candidate.price}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
