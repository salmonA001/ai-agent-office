"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { ChromePointer } from "@/components/chrome";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ChromePointer />
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
