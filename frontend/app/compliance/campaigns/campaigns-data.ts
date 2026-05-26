/**
 * Mock re-consent campaigns. A campaign is created when a consent policy
 * version is activated; existing patients on the prior version are marked
 * "stale" and asked to re-consent through email, in-app banner, and SMS.
 */

export type CampaignStatus = "active" | "completed";

export type Channel = "email" | "in_app" | "sms";

export interface DayProgress {
  day: number;
  date: string;
  reconsented: number;
  cumulative: number;
}

export interface RemainingBucket {
  label: string;
  count: number;
  hint: string;
}

export interface Campaign {
  id: string;
  policyVersion: string;
  policySlug: string;
  status: CampaignStatus;
  startedAt: string;
  targetCount: number;
  channels: Channel[];
  template: string;
  reminderSchedule: string[];
  daily: DayProgress[];
  remainingBuckets: RemainingBucket[];
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: "camp-v2-4",
    policyVersion: "v2.4",
    policySlug: "v2-4",
    status: "active",
    startedAt: "May 1, 2026",
    targetCount: 1284,
    channels: ["email", "in_app", "sms"],
    template:
      "Dear {{patient_name}}, City General has updated its privacy policy ({{policy_version}}) effective {{effective_date}}. Please review the changes and re-grant your consent so we can keep providing safe, continuous care. — City General Compliance Team",
    reminderSchedule: ["Initial · day 0", "Reminder · day 3", "Final · day 7"],
    daily: [
      { day: 0, date: "May 1", reconsented: 287, cumulative: 287 },
      { day: 1, date: "May 2", reconsented: 142, cumulative: 429 },
      { day: 2, date: "May 3", reconsented: 91, cumulative: 520 },
      { day: 3, date: "May 4", reconsented: 198, cumulative: 718 },
      { day: 4, date: "May 5", reconsented: 122, cumulative: 840 },
      { day: 5, date: "May 6", reconsented: 88, cumulative: 928 },
      { day: 6, date: "May 7", reconsented: 64, cumulative: 992 },
      { day: 7, date: "May 8", reconsented: 87, cumulative: 1079 },
      { day: 14, date: "May 15", reconsented: 41, cumulative: 1166 },
      { day: 21, date: "May 22", reconsented: 18, cumulative: 1208 },
      { day: 25, date: "May 26", reconsented: 4, cumulative: 1212 },
    ],
    remainingBuckets: [
      {
        label: "Not signed in recently",
        count: 48,
        hint: "Last sign-in > 30 days ago. SMS reminder dispatched.",
      },
      {
        label: "Email bounced",
        count: 14,
        hint: "Bounced or unsubscribed. Switch to SMS-only outreach.",
      },
      {
        label: "Deactivated account",
        count: 10,
        hint: "No action needed; consent will be re-asked at next login.",
      },
    ],
  },
  {
    id: "camp-v2-3",
    policyVersion: "v2.3",
    policySlug: "v2-3",
    status: "completed",
    startedAt: "Feb 12, 2026",
    targetCount: 1140,
    channels: ["email", "in_app"],
    template:
      "Dear {{patient_name}}, City General has updated its privacy policy ({{policy_version}}). Please re-confirm consent.",
    reminderSchedule: ["Initial · day 0", "Reminder · day 3"],
    daily: [
      { day: 0, date: "Feb 12", reconsented: 320, cumulative: 320 },
      { day: 3, date: "Feb 15", reconsented: 410, cumulative: 730 },
      { day: 7, date: "Feb 19", reconsented: 250, cumulative: 980 },
      { day: 14, date: "Feb 26", reconsented: 120, cumulative: 1100 },
      { day: 30, date: "Mar 14", reconsented: 40, cumulative: 1140 },
    ],
    remainingBuckets: [],
  },
];

export function getCampaign(id: string): Campaign | undefined {
  return CAMPAIGNS.find((c) => c.id === id);
}

export function campaignProgress(c: Campaign): {
  reconsented: number;
  pct: number;
  remaining: number;
} {
  const reconsented = c.daily.length > 0 ? c.daily[c.daily.length - 1].cumulative : 0;
  const pct = Math.round((reconsented / c.targetCount) * 100);
  return { reconsented, pct, remaining: c.targetCount - reconsented };
}
