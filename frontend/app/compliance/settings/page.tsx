"use client";

import * as React from "react";
import { toast } from "sonner";
import { Sliders, Bell, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionButton } from "@/components/shared/action-button";

type Thresholds = {
  offStart: string;
  offEnd: string;
  bulk: string;
  mfa: string;
};

const initialThresholds: Thresholds = {
  offStart: "00:00 IST",
  offEnd: "05:00 IST",
  bulk: "20 docs in 5 min",
  mfa: "3 in 90 s",
};

const ALERT_LABELS = [
  "High-severity anomalies",
  "Medium-severity anomalies",
  "MFA failures",
  "Consent revocations on the same day as access",
  "Bulk downloads",
] as const;

type AlertKey = (typeof ALERT_LABELS)[number];
type AlertState = Record<AlertKey, boolean>;

const initialAlerts: AlertState = ALERT_LABELS.reduce(
  (acc, label) => ({ ...acc, [label]: true }),
  {} as AlertState,
);

export default function ComplianceSettings() {
  const [thresholds, setThresholds] = React.useState<Thresholds>(initialThresholds);
  const [savedThresholds, setSavedThresholds] = React.useState<Thresholds>(initialThresholds);

  const [alerts, setAlerts] = React.useState<AlertState>(initialAlerts);
  const [savedAlerts, setSavedAlerts] = React.useState<AlertState>(initialAlerts);

  return (
    <>
      <PageHeader eyebrow="Settings" title="Compliance Manager preferences" description="Detector thresholds, alerts, and access security." />
      <Tabs defaultValue="detectors">
        <TabsList>
          <TabsTrigger value="detectors"><Sliders /> Detectors</TabsTrigger>
          <TabsTrigger value="alerts"><Bell /> Alerts</TabsTrigger>
          <TabsTrigger value="security"><KeyRound /> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="detectors">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
            <h3 className="text-sm font-semibold">Anomaly thresholds</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Off-hours window start</Label>
                <Input
                  value={thresholds.offStart}
                  onChange={(e) => setThresholds((t) => ({ ...t, offStart: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Off-hours window end</Label>
                <Input
                  value={thresholds.offEnd}
                  onChange={(e) => setThresholds((t) => ({ ...t, offEnd: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bulk download trigger</Label>
                <Input
                  value={thresholds.bulk}
                  onChange={(e) => setThresholds((t) => ({ ...t, bulk: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Failed MFA threshold</Label>
                <Input
                  value={thresholds.mfa}
                  onChange={(e) => setThresholds((t) => ({ ...t, mfa: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setThresholds(savedThresholds);
                  toast.info("Changes discarded");
                }}
              >
                Discard
              </Button>
              <Button
                onClick={() => {
                  setSavedThresholds(thresholds);
                  toast.success("Detector thresholds saved");
                }}
              >
                Save changes
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-3">
            {ALERT_LABELS.map((a) => (
              <div key={a} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-4">
                <div>
                  <p className="text-sm font-medium">{a}</p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">In-app + email</p>
                </div>
                <Switch
                  checked={alerts[a]}
                  onCheckedChange={(v) => setAlerts((s) => ({ ...s, [a]: v }))}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAlerts(savedAlerts);
                  toast.info("Changes discarded");
                }}
              >
                Discard
              </Button>
              <Button
                onClick={() => {
                  setSavedAlerts(alerts);
                  toast.success("Alert preferences saved");
                }}
              >
                Save changes
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-3">
            <p className="text-sm">MFA · TOTP active. IP allowlist enforced (3 ranges).</p>
            <ActionButton variant="outline" size="sm" toastMessage="IP allowlist editor opened" toastVariant="info">
              Manage IP allowlist
            </ActionButton>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
