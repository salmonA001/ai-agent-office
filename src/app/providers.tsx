"use client";

import { type ReactNode, useEffect } from "react";
import { startCloudSync } from "@/lib/cloud-sync";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { ChromePointer } from "@/components/chrome";

/** Signs the saved session back in and keeps the office synced to the account (if Supabase is set up). */
function CloudSync() {
  useEffect(() => startCloudSync(), []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ChromePointer />
      <CloudSync />
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
