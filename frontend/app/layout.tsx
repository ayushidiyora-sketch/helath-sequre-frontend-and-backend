import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { BrandingThemeProvider } from "@/components/shared/branding-theme";
import "./globals.css";

// Self-host the fonts via next/font so we don't make third-party requests
// to fonts.googleapis.com from the user's browser. Better privacy + faster
// first paint + CSP-friendly. Variables are wired to the same names the CSS
// already references in globals.css (--font-sans, --font-mono).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans-loaded",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono-loaded",
});

export const metadata: Metadata = {
  title: {
    default: "HealthSecure Portal — HIPAA-Ready Patient Portal",
    template: "%s · HealthSecure Portal",
  },
  description:
    "A HIPAA-ready patient portal for secure access to medical records, appointments, prescriptions, and encrypted communication with your care team.",
  authors: [{ name: "Sensussoft Software Pvt Ltd" }],
  applicationName: "HealthSecure Portal",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfdfd" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1318" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[var(--color-background)] antialiased">
        <BrandingThemeProvider>{children}</BrandingThemeProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "!rounded-xl !border !border-[var(--color-border)] !bg-[var(--color-card)] !text-[var(--color-foreground)] !shadow-[var(--shadow-lift)]",
            },
          }}
        />
      </body>
    </html>
  );
}
