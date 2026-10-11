"use client";

import {
  ArrowCounterClockwiseIcon,
  BarbellIcon,
  BedIcon,
  BookOpenIcon,
  ChatsCircleIcon,
  CheckIcon,
  ClockIcon,
  CoffeeIcon,
  CubeIcon,
  FishIcon,
  FrameCornersIcon,
  GameControllerIcon,
  type Icon,
  LampIcon,
  LightbulbIcon,
  MoonIcon,
  PhoneIcon,
  PlantIcon,
  RugIcon,
  SignpostIcon,
  SparkleIcon,
  SunHorizonIcon,
  SunIcon,
  TreeIcon,
} from "@phosphor-icons/react";
import { type ReactNode, useId, useState } from "react";
import { type Key, useI18n } from "@/lib/i18n";
import {
  ACCENT_COLORS,
  ACCENTS,
  BREAKS,
  DECOR_ITEMS,
  type DecorItem,
  DESK_COLORS,
  DESK_FINISHES,
  FLOOR_STYLES,
  FLOOR_SWATCH,
  LIGHTING,
  type Lighting,
  resetOfficeCustom,
  setOfficeCustom,
  SIGN_MAX,
  useOfficeCustom,
} from "@/lib/office-custom";
import { SPOT_CATS, type SpotCat } from "./office-nav";

const ITEM_ICON: Record<DecorItem, Icon> = {
  plants: PlantIcon,
  rugs: RugIcon,
  art: FrameCornersIcon,
  lamps: LampIcon,
  deskItems: CubeIcon,
  aquarium: FishIcon,
  stringLights: SparkleIcon,
  sign: SignpostIcon,
};

const CAT_ICON: Record<SpotCat, Icon> = {
  food: CoffeeIcon,
  chat: ChatsCircleIcon,
  games: GameControllerIcon,
  rest: BedIcon,
  reading: BookOpenIcon,
  exercise: BarbellIcon,
  calls: PhoneIcon,
  nature: TreeIcon,
  ideas: LightbulbIcon,
};

const LIGHT_ICON: Record<Lighting, Icon> = { auto: ClockIcon, day: SunIcon, sunset: SunHorizonIcon, night: MoonIcon };

/** Labelled group of single-choice options. */
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id} className="flex flex-col gap-2">
      <span id={id} className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Swatch({
  selected,
  onSelect,
  color,
  label,
  round,
}: {
  selected: boolean;
  onSelect: () => void;
  color: string;
  label: string;
  round?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`press flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
        selected ? "border-accent bg-accent/10 text-ink" : "border-line bg-surface/40 text-muted hover:text-ink"
      }`}
    >
      <span
        aria-hidden
        className={`relative grid size-6 place-items-center ring-1 ring-black/15 ${round ? "rounded-full" : "rounded-md"}`}
        style={{ background: color }}
      >
        {selected && <CheckIcon size={14} weight="bold" className="text-black/70" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function Segment<T extends string>({
  value,
  options,
  onChange,
  label,
  icon,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: (v: T) => string;
  icon?: (v: T) => Icon;
}) {
  return (
    <div className={`grid gap-1 rounded-xl bg-surface/40 p-1 ${options.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
      {options.map((o) => {
        const I = icon?.(o);
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            className={`press inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors ${
              on ? "bg-primary text-on-primary" : "text-muted hover:text-ink"
            }`}
          >
            {I && <I size={16} weight={on ? "fill" : "regular"} aria-hidden />}
            <span className="truncate">{label(o)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  on,
  onToggle,
  icon: I,
  label,
  hint,
}: {
  on: boolean;
  onToggle: () => void;
  icon: Icon;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`press flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        on ? "border-accent/60 bg-accent/10 text-ink" : "border-line bg-surface/40 text-muted"
      }`}
    >
      <I size={18} weight={on ? "duotone" : "regular"} aria-hidden className={on ? "text-accent" : ""} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{label}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
          on ? "border-accent bg-accent text-on-accent" : "border-line"
        }`}
      >
        {on && <CheckIcon size={12} weight="bold" />}
      </span>
    </button>
  );
}

/** Decor and break settings for the 3D office; changes show up in the scene right away. */
export function CustomizePanel() {
  const { t } = useI18n();
  const custom = useOfficeCustom();
  const [tab, setTab] = useState<"decor" | "activities">("decor");
  const base = useId();
  const signId = useId();
  const eventsId = useId();
  const tabs = [
    ["decor", t("custom.tab.decor")],
    ["activities", t("custom.tab.activities")],
  ] as const;
  const noneOn = SPOT_CATS.every((c) => !custom.activities[c]);

  return (
    <section aria-label={t("custom.title")} className="enter-drop mb-4 flex flex-col gap-4 rounded-xl bg-well p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t("custom.title")} className="grid grid-cols-2 gap-1 rounded-xl bg-surface/40 p-1">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              id={`${base}-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`${base}-panel`}
              onClick={() => setTab(id)}
              className={`press min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${
                tab === id ? "bg-primary text-on-primary" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetOfficeCustom}
          className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-muted hover:text-ink"
        >
          <ArrowCounterClockwiseIcon size={14} weight="bold" aria-hidden />
          {t("custom.reset")}
        </button>
      </div>

      {tab === "decor" ? (
        <div key="decor" id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-decor`} className="enter-fade grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Field label={t("custom.floor")}>
              <div className="grid grid-cols-4 gap-2">
                {FLOOR_STYLES.map((f) => (
                  <Swatch
                    key={f}
                    selected={custom.floor === f}
                    onSelect={() => setOfficeCustom({ floor: f })}
                    color={FLOOR_SWATCH[f]}
                    label={t(`decor.floor.${f}` as Key)}
                  />
                ))}
              </div>
            </Field>
            <Field label={t("custom.desks")}>
              <div className="grid grid-cols-4 gap-2">
                {DESK_FINISHES.map((d) => (
                  <Swatch
                    key={d}
                    selected={custom.desk === d}
                    onSelect={() => setOfficeCustom({ desk: d })}
                    color={DESK_COLORS[d].top}
                    label={t(`decor.desk.${d}` as Key)}
                  />
                ))}
              </div>
            </Field>
            <Field label={t("custom.accent")}>
              <div className="grid grid-cols-5 gap-2">
                {ACCENTS.map((a) => (
                  <Swatch
                    key={a}
                    round
                    selected={custom.accent === a}
                    onSelect={() => setOfficeCustom({ accent: a })}
                    color={ACCENT_COLORS[a]}
                    label={t(`decor.accent.${a}` as Key)}
                  />
                ))}
              </div>
            </Field>
            <Field label={t("custom.lighting")} hint={t("custom.lightingHint")}>
              <Segment
                value={custom.lighting}
                options={LIGHTING}
                onChange={(lighting) => setOfficeCustom({ lighting })}
                label={(l) => t(`light.${l}` as Key)}
                icon={(l) => LIGHT_ICON[l]}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor={signId} className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("custom.sign")}
              </label>
              <input
                id={signId}
                value={custom.sign}
                maxLength={SIGN_MAX}
                onChange={(e) => setOfficeCustom({ sign: e.target.value })}
                placeholder={t("custom.signPh")}
                className="min-h-10 rounded-lg border border-line bg-surface/40 px-3 text-ink transition-colors placeholder:text-muted/80 focus:border-accent/60"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t("custom.items")}</span>
              <div className="grid grid-cols-2 gap-2">
                {DECOR_ITEMS.map((item) => (
                  <Toggle
                    key={item}
                    on={custom.items[item]}
                    onToggle={() => setOfficeCustom({ items: { ...custom.items, [item]: !custom.items[item] } })}
                    icon={ITEM_ICON[item]}
                    label={t(`decor.${item}` as Key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div key="activities" id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-activities`} className="enter-fade flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">{t("custom.activitiesHint")}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SPOT_CATS.map((c) => (
                <Toggle
                  key={c}
                  on={custom.activities[c]}
                  onToggle={() => setOfficeCustom({ activities: { ...custom.activities, [c]: !custom.activities[c] } })}
                  icon={CAT_ICON[c]}
                  label={t(`cat.${c}` as Key)}
                  hint={t(`cat.${c}.hint` as Key)}
                />
              ))}
            </div>
            {noneOn && (
              <p role="status" className="text-xs font-semibold text-accent">
                {t("custom.none")}
              </p>
            )}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label={t("custom.breaks")}>
              <Segment
                value={custom.breaks}
                options={BREAKS}
                onChange={(breaks) => setOfficeCustom({ breaks })}
                label={(b) => t(`breaks.${b}` as Key)}
              />
            </Field>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span id={eventsId} className="block text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("custom.events")}
                </span>
                <span className="mt-1 block text-xs text-muted">{t("custom.eventsHint")}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={custom.events}
                aria-labelledby={eventsId}
                onClick={() => setOfficeCustom({ events: !custom.events })}
                className={`press relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                  custom.events ? "border-accent bg-accent" : "border-line bg-surface/60"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute size-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    custom.events ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
