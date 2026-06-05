"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Paperclip,
  Send,
  CheckCheck,
  Pin,
  Filter,
  Smile,
  Image as ImageIcon,
  X,
  Check,
  Plus,
  MessagesSquare,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { highlightText } from "@/lib/highlight";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmojiPicker } from "../../patient/messages/emoji-picker";

// DB-backed thread shape derived from /api/messages/threads. Keeps the same
// field names the old view used so the existing render code below works
// unchanged. Pinning is UI-only (no DB column); attachments are UI-only too
// (no DB rows yet).
interface ClinicianThread {
  id: string;            // otherUserId (patient UUID)
  patient: string;
  initials: string;
  mrn: string;
  role: string;
  preview: string;
  unread: number;
  sentByMe: boolean;
  lastActivity: string;  // ISO
  online: boolean;
  lastActiveAt: string | null;
  pinned?: boolean;
  messages: ClinicianMessage[];
}

interface ClinicianMessage {
  id: string;
  from: "clinician" | "patient";
  body: string;
  at: string;            // ISO
  attachments?: MsgAttachment[];
}

interface MsgAttachment {
  name: string;
  size: number;
  kind: "image" | "file";
  mimeType: string;
  /** data: URL — present for pending (just-attached) AND received attachments. */
  dataUrl: string;
}

interface ApiThread {
  otherUserId: string;
  otherName: string;
  otherInitials: string;
  otherRole: string;
  otherLastActiveAt: string | null;
  otherOnline: boolean;
  lastBody: string;
  lastSentAt: string;
  lastSenderRole: string;
  unread: number;
}

interface ApiMessage {
  id: string;
  senderRole: string;
  fromMe: boolean;
  body: string;
  sentAt: string;
  attachments?: Array<{ name: string; mimeType: string; size: number; dataUrl: string }>;
}

interface PanelPatient {
  id: string;
  name: string;
  initials: string;
  mrn: string;
  role: string | null;
}

// Locale-independent formatters — Node and the browser disagree on AM/PM
// casing on this machine; hardcoding keeps hydration stable.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatClock(date: Date): string {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return formatClock(date);
  const yest = new Date();
  yest.setDate(now.getDate() - 1);
  const isYest =
    date.getFullYear() === yest.getFullYear() &&
    date.getMonth() === yest.getMonth() &&
    date.getDate() === yest.getDate();
  if (isYest) return "Yesterday";
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Local-day key for grouping (YYYY-MM-DD in browser tz). */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today" / "Yesterday" / "Mon, May 30, 2026" — WhatsApp-style day pill. */
function dayLabel(iso: string): string {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yestKey = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  const k = dayKey(iso);
  if (k === todayKey) return "Today";
  if (k === yestKey) return "Yesterday";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function ClinicianMessagesView() {
  const search = useSearchParams();
  const queryThread = search.get("thread");

  const [threads, setThreads] = useState<ClinicianThread[]>([]);
  const [panel, setPanel] = useState<PanelPatient[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ClinicianMessage[]>([]);
  const [tab, setTab] = useState<"inbox" | "pinned" | "all">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MsgAttachment[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  // Local-only pinned set (no DB column).
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // Lookup map: otherUserId → {mrn, role} so the inbox row matches the
  // compose dialog's identity for the same patient.
  const panelById = useMemo(() => {
    const m = new Map<string, { mrn: string; role: string }>();
    for (const p of panel) m.set(p.id, { mrn: p.mrn, role: `Patient${p.role ? ` · ${p.role}` : ""}` });
    return m;
  }, [panel]);

  // Reload thread list + apply panel-derived enrichments.
  const reloadThreads = async (preferOther?: string) => {
    let data: { ok?: boolean; threads?: ApiThread[] } | null = null;
    try {
      const r = await fetch("/api/messages/threads", { cache: "no-store" });
      data = await r.json();
    } catch {
      // Network blip or dev-server restart — leave the existing list visible
      // and try again on the next tick.
      return;
    }
    if (!data?.ok || !Array.isArray(data.threads)) return;
    const shaped: ClinicianThread[] = (data.threads as ApiThread[]).map((t) => {
      const meta = panelById.get(t.otherUserId);
      return {
        id: t.otherUserId,
        patient: t.otherName,
        initials: t.otherInitials,
        mrn: meta?.mrn ?? "",
        role: meta?.role ?? `Patient · ${t.otherRole}`,
        preview: t.lastBody,
        unread: t.unread,
        sentByMe: t.lastSenderRole === "clinician",
        lastActivity: t.lastSentAt,
        online: t.otherOnline,
        lastActiveAt: t.otherLastActiveAt,
        pinned: pinnedIds.has(t.otherUserId),
        messages: [],
      };
    });
    setThreads(shaped);
    if (preferOther) {
      setActiveId(preferOther);
    } else if (!activeId && shaped.length > 0) {
      setActiveId((queryThread && shaped.find((t) => t.id === queryThread)?.id) ?? shaped[0].id);
    }
  };

  // Fetch the patient panel once for MRN/role enrichment + compose dialog.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/clinician/patients", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok || !Array.isArray(data.patients)) return;
        setPanel(
          (data.patients as Array<{ id: string; name: string; initials: string; mrn: string; role: string | null }>).map((p) => ({
            id: p.id,
            name: p.name,
            initials: p.initials,
            mrn: p.mrn,
            role: p.role,
          })),
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void reloadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelById.size]);

  // Load messages whenever active thread changes.
  useEffect(() => {
    if (!activeId) {
      setActiveMessages([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/messages?withUserId=${activeId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok) return;
        const msgs: ClinicianMessage[] = (data.messages as ApiMessage[]).map((m) => ({
          id: m.id,
          from: m.senderRole === "clinician" ? "clinician" : "patient",
          body: m.body,
          at: m.sentAt,
          attachments: (m.attachments ?? []).map((a) => ({
            name: a.name,
            size: a.size,
            mimeType: a.mimeType,
            kind: a.mimeType.startsWith("image/") ? "image" : "file",
            dataUrl: a.dataUrl,
          })),
        }));
        setActiveMessages(msgs);
        // Decrement the unread badge locally; the server already stamped readAt.
        setThreads((curr) => curr.map((t) => (t.id === activeId ? { ...t, unread: 0 } : t)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeId]);

  // Poll every 10s so inbound messages appear without manual refresh.
  useEffect(() => {
    const tick = setInterval(() => {
      void reloadThreads();
      if (activeId) {
        fetch(`/api/messages?withUserId=${activeId}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((data) => {
            if (!data?.ok) return;
            const msgs: ClinicianMessage[] = (data.messages as ApiMessage[]).map((m) => ({
              id: m.id,
              from: m.senderRole === "clinician" ? "clinician" : "patient",
              body: m.body,
              at: m.sentAt,
              attachments: (m.attachments ?? []).map((a) => ({
                name: a.name,
                size: a.size,
                mimeType: a.mimeType,
                kind: a.mimeType.startsWith("image/") ? "image" : "file",
                dataUrl: a.dataUrl,
              })),
            }));
            setActiveMessages(msgs);
          })
          .catch(() => {});
      }
    }, 10_000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, panelById.size]);

  const unreadTotal = threads.filter((t) => t.unread > 0).length;

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return threads.filter((t) => {
      if (tab === "pinned" && !t.pinned) return false;
      if (unreadOnly && t.unread === 0) return false;
      if (!q) return true;
      return (
        t.patient.toLowerCase().includes(q) ||
        t.mrn.toLowerCase().includes(q) ||
        t.role.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q)
      );
    });
  }, [threads, tab, searchQuery, unreadOnly]);

  const active = threads.find((t) => t.id === activeId) ?? visible[0] ?? threads[0];

  function openThread(id: string) {
    setActiveId(id);
  }

  function togglePin(id: string) {
    setPinnedIds((curr) => {
      const next = new Set(curr);
      const pinnedNow = !next.has(id);
      if (pinnedNow) next.add(id);
      else next.delete(id);
      toast.info(pinnedNow ? "Conversation pinned" : "Conversation unpinned");
      return next;
    });
    setThreads((curr) =>
      curr.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
    );
  }

  function noteAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} is over 5 MB — pick a smaller file.`);
        e.target.value = "";
        return;
      }
      const kind: MsgAttachment["kind"] = e.target === imageRef.current ? "image" : "file";
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        if (!dataUrl.startsWith("data:")) {
          toast.error("Could not read the file.");
          return;
        }
        setPendingAttachments((curr) => [
          ...curr,
          { name: f.name, size: f.size, kind, mimeType: f.type || "application/octet-stream", dataUrl },
        ]);
        toast.success("Attachment ready", { description: `${f.name} · sends with your next message` });
      };
      reader.onerror = () => toast.error("Could not read the file.");
      reader.readAsDataURL(f);
    }
    e.target.value = "";
  }

  function removePendingAttachment(name: string) {
    setPendingAttachments((curr) => curr.filter((a) => a.name !== name));
  }

  async function send() {
    if (!active) return;
    const body = draft.trim();
    const atts = pendingAttachments;
    if (!body && atts.length === 0) return;
    const savedBody = draft;
    const savedAtts = atts;
    setDraft("");
    setPendingAttachments([]);
    setEmojiOpen(false);
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: active.id,
          body,
          attachments: atts.map((a) => ({ name: a.name, mimeType: a.mimeType, size: a.size, dataUrl: a.dataUrl })),
        }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        toast.error(data?.error ?? "Could not send message.");
        setDraft(savedBody);
        setPendingAttachments(savedAtts);
        return;
      }
      toast.success("Message sent", { description: `${active.patient} · audit-logged` });
      const optimistic: ClinicianMessage = {
        id: data.message.id,
        from: "clinician",
        body,
        at: data.message.sentAt,
        attachments: atts,
      };
      setActiveMessages((curr) => [...curr, optimistic]);
      await reloadThreads();
    } catch {
      toast.error("Network error.");
      setDraft(savedBody);
      setPendingAttachments(savedAtts);
    }
  }

  async function startThread(recipient: PanelPatient, message: string) {
    const body = message.trim() || "Hello";
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: recipient.id, body }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        toast.error(data?.error ?? "Could not start conversation.");
        return;
      }
      toast.success("Conversation started", { description: `${recipient.name} · audit-logged` });
      setComposeOpen(false);
      await reloadThreads(recipient.id);
    } catch {
      toast.error("Network error.");
    }
  }

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 md:grid-cols-[280px_1fr] xl:grid-cols-[340px_1fr]">
        {/* ---- Thread list ---- */}
        <aside className="hidden flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]/50 backdrop-blur md:flex">
          <div className="border-b border-[var(--color-border)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Messages</h2>
              <Button size="icon-sm" variant="outline" aria-label="New message" onClick={() => setComposeOpen(true)}>
                <Plus />
              </Button>
            </div>
            <Input
              placeholder="Search patient, MRN, message…"
              leadingIcon={<Search />}
              className="h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="mt-3 flex items-center gap-1.5">
              <Button
                variant={tab === "inbox" ? "soft" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => setTab("inbox")}
              >
                Inbox · {unreadTotal}
              </Button>
              <Button
                variant={tab === "pinned" ? "soft" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => setTab("pinned")}
              >
                Pinned
              </Button>
              <Button
                variant={tab === "all" ? "soft" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => setTab("all")}
              >
                All
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={unreadOnly ? "soft" : "ghost"}
                    size="icon-sm"
                    className="ml-auto"
                    aria-label="Filter"
                  >
                    <Filter />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setUnreadOnly((v) => !v)}>
                    <Check className={unreadOnly ? "" : "opacity-0"} /> Unread only
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setUnreadOnly(false);
                      setSearchQuery("");
                    }}
                  >
                    <X /> Clear filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto p-2">
            {visible.length === 0 && (
              <li className="px-3 py-8 text-center text-xs text-[var(--color-muted-foreground)]">
                {threads.length === 0
                  ? "No conversations yet. Click + to message a patient on your panel."
                  : "No conversations match."}
              </li>
            )}
            {visible.map((t) => {
              const isActive = t.id === active?.id;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => openThread(t.id)}
                    className={`group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                      isActive
                        ? "bg-[var(--color-primary-50)]"
                        : "hover:bg-[var(--color-muted)]/50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="size-10">
                        <AvatarFallback>{t.initials}</AvatarFallback>
                      </Avatar>
                      {t.online && (
                        <span
                          className="absolute bottom-0 right-0 block size-2.5 rounded-full bg-[var(--color-success)] ring-2 ring-[var(--color-card)]"
                          aria-label="Online"
                          title="Online"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={`flex items-center gap-1 truncate text-sm ${
                            t.unread > 0 ? "font-semibold" : "font-medium"
                          } ${isActive ? "text-[var(--color-primary-700)]" : ""}`}
                        >
                          {t.pinned && (
                            <Pin className="size-3 shrink-0 text-[var(--color-muted-foreground)]" />
                          )}
                          {t.patient}
                        </p>
                        <span className="text-[10px] text-[var(--color-muted-foreground)]">
                          {relativeTime(t.lastActivity)}
                        </span>
                      </div>
                      {t.mrn && (
                        <p className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                          <span className="font-mono">{t.mrn}</span>
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted-foreground)]">
                        {t.sentByMe && (
                          <span className="mr-1 text-[var(--color-primary-700)]">You:</span>
                        )}
                        {t.preview}
                      </p>
                    </div>
                    {t.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-[10px] font-semibold text-white">
                        {t.unread}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* ---- Thread view ---- */}
        {active ? (
          <ThreadPane
            active={active}
            messages={activeMessages}
            draft={draft}
            setDraft={setDraft}
            onSend={send}
            onTogglePin={() => togglePin(active.id)}
            emojiOpen={emojiOpen}
            setEmojiOpen={setEmojiOpen}
            fileRef={fileRef}
            imageRef={imageRef}
            onAttach={noteAttachment}
            pendingAttachments={pendingAttachments}
            onRemoveAttachment={removePendingAttachment}
          />
        ) : (
          <section className="flex items-center justify-center bg-[var(--color-background)] p-10">
            <div className="text-center">
              <MessagesSquare className="mx-auto size-8 text-[var(--color-muted-foreground)]" />
              <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
                Pick a conversation from the list, or compose a new one.
              </p>
            </div>
          </section>
        )}
      </div>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        panel={panel}
        onStart={startThread}
      />
    </div>
  );
}

function ComposeDialog({
  open,
  onOpenChange,
  panel,
  onStart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  panel: PanelPatient[];
  onStart: (recipient: PanelPatient, message: string) => void;
}) {
  const [recipientIdx, setRecipientIdx] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (recipientIdx >= panel.length) setRecipientIdx(0);
  }, [panel.length, recipientIdx]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (panel.length === 0) return;
    onStart(panel[recipientIdx], message);
    setMessage("");
    setRecipientIdx(0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Start a secure, end-to-end encrypted conversation with a patient on your assigned panel.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 py-2" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="compose-recipient">Recipient</Label>
            {panel.length === 0 ? (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                No patients on your panel yet. Ask your Org Admin to assign patients to you.
              </p>
            ) : (
              <select
                id="compose-recipient"
                value={recipientIdx}
                onChange={(e) => setRecipientIdx(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
              >
                {panel.map((p, i) => (
                  <option key={p.id} value={i}>
                    {p.name} · {p.mrn}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="compose-message">Message</Label>
            <Textarea
              id="compose-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What would you like to say?"
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!message.trim() || panel.length === 0}>
              <Send /> Start conversation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ThreadPane({
  active,
  messages,
  draft,
  setDraft,
  onSend,
  onTogglePin,
  emojiOpen,
  setEmojiOpen,
  fileRef,
  imageRef,
  onAttach,
  pendingAttachments,
  onRemoveAttachment,
}: {
  active: ClinicianThread;
  messages: ClinicianMessage[];
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onTogglePin: () => void;
  emojiOpen: boolean;
  setEmojiOpen: (v: boolean | ((v: boolean) => boolean)) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  imageRef: React.RefObject<HTMLInputElement | null>;
  onAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingAttachments: MsgAttachment[];
  onRemoveAttachment: (name: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // In-conversation full-text search.
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [current, setCurrent] = useState(0);
  const matchIds = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [] as string[];
    return messages.filter((m) => m.body.toLowerCase().includes(needle)).map((m) => m.id);
  }, [q, messages]);

  useEffect(() => {
    setSearchOpen(false);
    setQ("");
    setCurrent(0);
  }, [active.id]);
  useEffect(() => {
    setCurrent(0);
  }, [q]);
  useEffect(() => {
    if (matchIds.length === 0) return;
    const id = matchIds[Math.min(current, matchIds.length - 1)];
    msgRefs.current[id]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current, matchIds]);

  const activeMatchId = matchIds.length > 0 ? matchIds[Math.min(current, matchIds.length - 1)] : null;
  const stepMatch = (dir: 1 | -1) =>
    setCurrent((c) => (matchIds.length === 0 ? 0 : (c + dir + matchIds.length) % matchIds.length));

  // Auto-scroll to bottom whenever the conversation or message count changes
  // (suppressed while searching so the match scroll wins).
  useEffect(() => {
    if (searchOpen) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active.id, messages.length, searchOpen]);
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--color-background)]">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/80 px-5 py-3 backdrop-blur">
        <div className="relative">
          <Avatar className="size-9">
            <AvatarFallback>{active.initials}</AvatarFallback>
          </Avatar>
          {active.online && (
            <span
              className="absolute bottom-0 right-0 block size-2.5 rounded-full bg-[var(--color-success)] ring-2 ring-[var(--color-card)]"
              aria-label="Online"
              title="Online"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{active.patient}</p>
            {active.mrn && (
              <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{active.mrn}</span>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            {active.role} ·{" "}
            {active.online ? (
              <span className="font-medium text-[var(--color-success)]">online</span>
            ) : active.lastActiveAt ? (
              <>last active {relativeTime(active.lastActiveAt)}</>
            ) : (
              <>offline</>
            )}
          </p>
        </div>
        <span
          className="hidden items-center gap-1.5 rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-2.5 py-1 text-[11px] font-medium text-[oklch(0.4_0.12_158)] dark:text-[oklch(0.85_0.12_158)] sm:inline-flex"
          title="Messages are encrypted at rest (AES-256). Every read is audit-logged."
        >
          <ShieldCheck className="size-3.5" /> Encrypted &amp; audited
        </span>
        <Button
          variant={searchOpen ? "soft" : "ghost"}
          size="icon-sm"
          aria-label="Search in conversation"
          onClick={() => setSearchOpen((v) => !v)}
        >
          <Search />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={active.pinned ? "Unpin" : "Pin"}
          onClick={onTogglePin}
        >
          <Pin
            className={
              active.pinned ? "fill-[var(--color-primary)] text-[var(--color-primary)]" : ""
            }
          />
        </Button>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-card)]/60 px-4 py-2">
          <Input
            autoFocus
            placeholder={`Search in conversation with ${active.patient}…`}
            leadingIcon={<Search />}
            className="h-9 flex-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                stepMatch(e.shiftKey ? -1 : 1);
              } else if (e.key === "Escape") {
                setSearchOpen(false);
                setQ("");
              }
            }}
          />
          <span className="min-w-[44px] text-center text-xs tabular-nums text-[var(--color-muted-foreground)]">
            {q.trim() ? `${matchIds.length === 0 ? 0 : Math.min(current, matchIds.length - 1) + 1}/${matchIds.length}` : "0/0"}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Previous match" disabled={matchIds.length === 0} onClick={() => stepMatch(-1)}>
            <ChevronUp />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next match" disabled={matchIds.length === 0} onClick={() => stepMatch(1)}>
            <ChevronDown />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close search" onClick={() => { setSearchOpen(false); setQ(""); }}>
            <X />
          </Button>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="h-px flex-1 bg-[var(--color-border)]" />
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
            End-to-end encrypted
          </span>
          <span className="h-px flex-1 bg-[var(--color-border)]" />
        </div>

        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">
            No messages yet — start the conversation with {active.patient}.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => {
              const prevKey = i > 0 ? dayKey(messages[i - 1].at) : null;
              const thisKey = dayKey(m.at);
              const showDate = prevKey !== thisKey;
              const isActiveMatch = m.id === activeMatchId;
              return (
              <div key={m.id} ref={(el) => { msgRefs.current[m.id] = el; }}>
              {showDate && (
                <div className="my-3 flex items-center justify-center">
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)] shadow-[var(--shadow-soft)]">
                    {dayLabel(m.at)}
                  </span>
                </div>
              )}
              <div className={`flex gap-2.5 ${m.from === "clinician" ? "justify-end" : ""}`}>
                {m.from === "patient" && (
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback>{active.initials}</AvatarFallback>
                  </Avatar>
                )}
                <div className="max-w-[70%] space-y-1">
                  {m.body && (
                    <div
                      className={`relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-[var(--shadow-soft)] ${
                        m.from === "clinician"
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-[var(--color-card)] text-[var(--color-foreground)]"
                      } ${isActiveMatch ? "ring-2 ring-[var(--color-warning)] ring-offset-2 ring-offset-[var(--color-background)]" : ""}`}
                    >
                      {q.trim() ? highlightText(m.body, q) : m.body}
                    </div>
                  )}
                  {m.attachments && m.attachments.length > 0 && (
                    <div className={`flex flex-wrap gap-1.5 ${m.from === "clinician" ? "justify-end" : ""}`}>
                      {m.attachments.map((a) => {
                        const isMine = m.from === "clinician";
                        const Icon = a.kind === "image" ? ImageIcon : Paperclip;
                        if (a.kind === "image" && a.dataUrl) {
                          return (
                            <a
                              key={a.name}
                              href={a.dataUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={a.name}
                              className="block overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-soft)] hover:opacity-90"
                              title={`${a.name} · ${formatSize(a.size)}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={a.dataUrl} alt={a.name} className="max-h-56 max-w-[260px] object-contain" />
                            </a>
                          );
                        }
                        return (
                          <a
                            key={a.name}
                            href={a.dataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={a.name}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium shadow-[var(--shadow-soft)] transition-colors ${
                              isMine
                                ? "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/15 text-[var(--color-primary-700)] hover:bg-[var(--color-primary)]/25"
                                : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]/40"
                            }`}
                          >
                            <Icon className="size-3.5" />
                            <span className="max-w-[180px] truncate">{a.name}</span>
                            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                              {formatSize(a.size)}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)] ${
                      m.from === "clinician" ? "justify-end" : ""
                    }`}
                  >
                    <span>{relativeTime(m.at)}</span>
                    {m.from === "clinician" && (
                      <CheckCheck className="size-3.5 text-[var(--color-primary)]" />
                    )}
                  </div>
                </div>
              </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-card)]/80 px-4 py-3 backdrop-blur sm:px-6">
        {pendingAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pendingAttachments.map((a) => {
              const Icon = a.kind === "image" ? ImageIcon : Paperclip;
              return (
                <span
                  key={a.name}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)] px-2 py-1 text-[11px] font-medium text-[var(--color-primary-700)]"
                >
                  <Icon className="size-3.5" />
                  <span className="max-w-[180px] truncate">{a.name}</span>
                  <span className="font-mono text-[10px] text-[var(--color-primary-700)]/70">
                    {formatSize(a.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(a.name)}
                    aria-label={`Remove ${a.name}`}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--color-primary)]/15"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-2">
          <Textarea
            placeholder={`Reply to ${active.patient}… End-to-end encrypted, audit-logged.`}
            className="min-h-12 resize-none border-0 bg-transparent px-3 py-2 focus:outline-none focus:ring-0"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-2 pt-2">
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" hidden onChange={onAttach} />
              <input ref={imageRef} type="file" accept="image/*" hidden onChange={onAttach} />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Attach file"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Attach image"
                onClick={() => imageRef.current?.click()}
              >
                <ImageIcon />
              </Button>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Emoji"
                  onClick={() => setEmojiOpen((v) => !v)}
                >
                  <Smile />
                </Button>
                {emojiOpen && (
                  <>
                    <button
                      className="fixed inset-0 z-10 cursor-default"
                      aria-hidden
                      onClick={() => setEmojiOpen(false)}
                    />
                    <EmojiPicker onPick={(value) => setDraft(draft + value)} />
                  </>
                )}
              </div>
            </div>
            <Button size="sm" onClick={onSend} disabled={!draft.trim() && pendingAttachments.length === 0}>
              <Send /> Send
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// Used by the dynamic-recipient enrichment map.
// (Badge/Paperclip/X imports kept for the attachment UI even though
// no attachments are persisted yet.)
void Badge;
