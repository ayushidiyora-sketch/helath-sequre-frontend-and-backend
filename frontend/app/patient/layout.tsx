import { PatientSidebar } from "@/components/patient/sidebar";
import { PatientHeader } from "@/components/patient/header";
import { IdleTimeout } from "@/components/shared/idle-timeout";
import { PatientStoreProvider } from "@/lib/patient-store";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PatientStoreProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
        <IdleTimeout />
        <PatientSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <PatientHeader />
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto space-y-6 animate-[fade-in_0.3s_ease-out]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </PatientStoreProvider>
  );
}
