import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--color-background)] antialiased">
        {children}
        <Toaster
          position="bottom-right"
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
