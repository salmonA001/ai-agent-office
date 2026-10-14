"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { useOutdated } from "@/lib/stale-build";

/** Shown when this tab is still running an older build of the app: one click loads the new one. */
export function UpdateBar() {
  const { t } = useI18n();
  const outdated = useOutdated();
  if (!outdated) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div className="glass-strong enter-drop pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm">
        <span className="min-w-0">{t("update.ready")}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 font-semibold text-on-primary"
        >
          <ArrowClockwiseIcon size={16} weight="bold" aria-hidden />
          {t("update.reload")}
        </button>
      </div>
    </div>
  );
}
