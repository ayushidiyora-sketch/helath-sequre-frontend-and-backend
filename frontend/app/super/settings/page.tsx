"use client";

import * as React from "react";
import { toast } from "sonner";
import { KeyRound, Globe, Bell, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AddRangeDialog } from "./add-range-dialog";
import { NotificationPreferences } from "@/components/shared/notification-preferences";
import { LoginOtpToggle } from "@/components/shared/login-otp-toggle";

export default function SuperSettings() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Super Admin · account" description="Highest-privilege account · enforced IP allowlist + short session." />
      <Tabs defaultValue="security">
        <TabsList>
          <TabsTrigger value="security"><KeyRound /> Security</TabsTrigger>
          <TabsTrigger value="ip"><Globe /> IP allowlist</TabsTrigger>
          <TabsTrigger value="alerts"><Bell /> Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="security">
          <div className="mb-4">
            <LoginOtpToggle />
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-4">
              <KeyRound className="size-5 text-[var(--color-primary-700)]" />
              <div className="flex-1">
                <p className="text-sm font-medium">TOTP active · re-enroll every 90 days</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">Next re-enrollment: Jul 12, 2026</p>
              </div>
              <Badge variant="success" size="sm" dot>Active</Badge>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-4">
              <ShieldAlert className="size-5 text-[var(--color-danger)]" />
              <div className="flex-1">
                <p className="text-sm font-medium">Re-MFA for break-glass</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">Required at session start + every 15 min</p>
              </div>
              <Switch defaultChecked disabled />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ip">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
            <p className="text-sm font-semibold">Mandatory IP allowlist</p>
            <div className="space-y-2">
              {[
                { range: "203.0.113.0/24", note: "Sensussoft Mumbai office", current: true },
                { range: "198.51.100.16/29", note: "Sensussoft VPN exit", current: false },
              ].map((i) => (
                <div key={i.range} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-4">
                  <Globe className="size-4 text-[var(--color-muted-foreground)]" />
                  <div className="flex-1 font-mono text-sm">{i.range}</div>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">{i.note}</p>
                  {i.current && <Badge variant="success" size="sm" dot>You</Badge>}
                </div>
              ))}
            </div>
            <AddRangeDialog />
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <NotificationPreferences role="super" />
        </TabsContent>
      </Tabs>
    </>
  );
}
