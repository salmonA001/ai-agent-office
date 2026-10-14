"use client";

import { CloudCheckIcon, CloudSlashIcon, CloudArrowUpIcon, SignInIcon, SignOutIcon, UserPlusIcon } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { signIn, signOut, signUp, useAccount } from "@/lib/cloud-sync";
import { type Key, useI18n } from "@/lib/i18n";
import { HoverPill, SegmentThumb } from "./chrome";

type Mode = "in" | "up";

/** Supabase's error messages, in the app's words (and languages). */
function friendly(message: string): Key | null {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "auth.badLogin";
  if (m.includes("not confirmed")) return "auth.notConfirmed";
  if (m.includes("already registered") || m.includes("already been registered")) return "auth.exists";
  if (m.includes("rate limit") || m.includes("too many")) return "auth.slowDown";
  if (m.includes("invalid api key") || m.includes("no api key")) return "auth.badKey";
  if (m.includes("password")) return "auth.passwordHint";
  return null;
}

/** A message carried back by the confirmation email's link (?account=...). */
function linkMessage(): Key | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("account");
  return p === "confirmed" ? "auth.confirmed" : p === "signin" ? "auth.signinAfterConfirm" : null;
}

/**
 * Sign in, create an account, or (when signed in) see that the office is saved to the account.
 * Accounts are optional: everything works as a guest, saved in this browser.
 */
export function AccountCard() {
  const uid = useId();
  const { t } = useI18n();
  const account = useAccount();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(() => {
    const key = linkMessage();
    return key ? t(key) : null;
  });

  // tidy the address bar once the confirmation message has been read
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("account")) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (!account.ready) {
    return (
      <section className="enter rounded-2xl border border-line bg-well p-4 text-sm text-muted" aria-busy="true">
        {t("auth.checking")}
      </section>
    );
  }
  if (!account.enabled) return null;

  if (account.user) {
    const status =
      account.sync === "syncing"
        ? t("auth.syncing")
        : account.sync === "saving"
          ? t("auth.saving")
          : account.sync === "error"
            ? t("auth.saveError")
            : account.savedAt
              ? t("auth.saved", { time: new Date(account.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
              : t("auth.savedIdle");
    const Icon = account.sync === "error" ? CloudSlashIcon : account.sync === "saving" || account.sync === "syncing" ? CloudArrowUpIcon : CloudCheckIcon;
    return (
      <section className="enter rounded-2xl border border-line bg-well p-4" aria-labelledby={`${uid}-title`}>
        <h3 id={`${uid}-title`} className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("auth.title")}
        </h3>
        {info && (
          <p role="status" className="enter-fade mb-3 rounded-lg bg-accent/10 px-3 py-2 text-xs">
            {info}
          </p>
        )}
        <div className="flex items-center gap-3">
          <span aria-hidden className="metal grid size-10 shrink-0 place-items-center rounded-xl text-base font-black">
            {(account.user.email || "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted">{t("auth.signedInAs")}</p>
            <p className="truncate text-sm font-semibold" title={account.user.email}>
              {account.user.email}
            </p>
          </div>
        </div>
        <p className={`mt-3 flex items-center gap-1.5 text-xs ${account.sync === "error" ? "text-error" : "text-muted"}`} aria-live="polite">
          <Icon size={16} weight="duotone" aria-hidden className="shrink-0" />
          {status}
        </p>
        <button
          type="button"
          onClick={() => {
            setBusy(true);
            void signOut();
          }}
          disabled={busy}
          className="press mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-semibold hover:border-accent/60 disabled:opacity-50"
        >
          <SignOutIcon size={16} weight="bold" aria-hidden />
          {t("auth.signOut")}
        </button>
        <p className="mt-1.5 text-[11px] text-muted">{t("auth.signOutHint")}</p>
      </section>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === "in") {
      const r = await signIn(email.trim(), password);
      if (r.error) {
        const key = friendly(r.error);
        setError(key ? t(key) : r.error);
      }
    } else {
      const r = await signUp(email.trim(), password);
      if (r.error) {
        const key = friendly(r.error);
        setError(key ? t(key) : r.error);
      } else if (r.confirm) {
        setInfo(t("auth.checkEmail", { email: email.trim() }));
        setMode("in");
        setPassword("");
      }
    }
    setBusy(false);
  };

  const modes: { id: Mode; label: Key }[] = [
    { id: "in", label: "auth.signIn" },
    { id: "up", label: "auth.signUp" },
  ];
  const field = "min-h-11 rounded-lg border border-line bg-surface/40 px-3 text-sm text-ink transition-colors focus:border-accent/60";

  return (
    <section className="enter rounded-2xl border border-line bg-well p-4" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`} className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("auth.title")}
      </h3>
      <p className="mb-3 text-xs text-muted">{t("auth.why")}</p>
      <div role="radiogroup" aria-label={t("auth.title")} className="relative mb-3 grid grid-cols-2 gap-1 rounded-lg bg-surface/40 p-1">
        <HoverPill />
        <SegmentThumb index={mode === "in" ? 0 : 1} count={2} />
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => {
              setMode(m.id);
              setError(null);
            }}
            className={`press relative z-10 min-h-9 rounded-md text-xs font-semibold ${mode === m.id ? "text-on-accent" : "text-muted hover:text-ink"}`}
          >
            {t(m.label)}
          </button>
        ))}
      </div>
      {info && (
        <p role="status" className="enter-fade mb-3 rounded-lg bg-accent/10 px-3 py-2 text-xs">
          {info}
        </p>
      )}
      <form className="flex flex-col gap-2.5" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          {t("auth.email")}
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          {t("auth.password")}
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={mode === "up" ? `${uid}-pw` : undefined}
            className={field}
          />
        </label>
        {mode === "up" && (
          <p id={`${uid}-pw`} className="-mt-1 text-[11px] text-muted">
            {t("auth.passwordHint")}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="press mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {mode === "in" ? <SignInIcon size={16} weight="bold" aria-hidden /> : <UserPlusIcon size={16} weight="bold" aria-hidden />}
          {busy ? t("auth.wait") : mode === "in" ? t("auth.submitIn") : t("auth.submitUp")}
        </button>
      </form>
    </section>
  );
}
