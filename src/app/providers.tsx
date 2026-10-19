"use client";

import { type ReactNode, useEffect } from "react";
import { watchForStaleBuild } from "@/lib/stale-build";
import { UpdateBar } from "@/components/UpdateBar";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { ChromePointer } from "@/components/chrome";

/** Notices when this tab runs an older build than the one deployed (see stale-build.ts). */
function StaleBuildWatch() {
  useEffect(() => watchForStaleBuild(), []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ChromePointer />
      <StaleBuildWatch />
      <I18nProvider>
        {children}
        <UpdateBar />
      </I18nProvider>
    </ThemeProvider>
  );
}
