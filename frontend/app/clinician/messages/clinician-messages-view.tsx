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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SecurityBadge } from "@/components/shared/security-badge";
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
import {
  THREADS,
  FLAG_META,
  type ClinicianThread,
  type ClinicianMessage,
  type MsgAttachment,
} from "./clinician-messages-data";

// Assigned panel — recipients available when composing a new thread.
const PATIENT_PANEL = [
  { name: "Aarav Mehta", initials: "AM", mrn: "MRN-44118", role: "Patient · Cardiology panel" },
  { name: "Riya Mehta", initials: "RM", mrn: "MRN-44119", role: "Patient · Endocrinology panel" },
  { name: "Tarun Mehta", initials: "TM", mrn: "MRN-44120", role: "Patient · Cardiology panel" },
  { name: "Aanya Verma", initials: "AV", mrn: "MRN-44211", role: "Patient · Internal Medicine panel" },
  { name: "Kabir Joshi", initials: "KJ", mrn: "MRN-44309", role: "Patient · Radiology referral" },
  { name: "Meera Singh", initials: "MS", mrn: "MRN-44402", role: "Patient · Cardiology panel" },
  { name: "Ramesh Patel", initials: "RP", mrn: "CITY-001234", role: "Patient · Cardiology panel" },
  { name: "Sai Iyer", initials: "SI", mrn: "MRN-44501", role: "Patient · Cardiology panel" },
];

// Locale-independent formatters so server and client agree byte-for-byte
// during hydration. Node's default LC_ALL on this machine emits "PM" while
// the browser emits "pm" — that mismatch broke hydration on /clinician/messages.
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

export function ClinicianMessagesView({ initialThreadId }: { initialThreadId?: string } = {}) {
  const search = useSearchParams();
  const queryThread = search.get("thread") ?? initialThreadId ?? null;

  // Local mutable copy so pinning/unread/messages persist across the session.
  const [threads, setThreads] = useState<ClinicianThread[]>(() =>
    THREADS.map((t) => ({ ...t, messages: [...t.messages] })),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"inbox" | "pinned" | "all">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MsgAttachment[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  // Pick an initial active thread.
  useEffect(() => {
    if (activeId && threads.some((t) => t.id === activeId)) return;
    const target =
      (queryThread && threads.find((t) => t.id === queryThread)?.id) ??
      threads[0]?.id ??
      null;
    setActiveId(target);
    if (target) markRead(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadTotal = threads.filter((t) => t.unread > 0).length;

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return threads.filter((t) => {
      if (tab === "pinned" && !t.pinned) return false;
      if (unreadOnly && t.unread === 0) return false;
      if (!q) return true;
      const last = t.messages[t.messages.length - 1]?.body ?? "";
      return (
        t.patient.toLowerCase().includes(q) ||
        t.mrn.toLowerCase().includes(q) ||
        t.role.toLowerCase().includes(q) ||
        last.toLowerCase().includes(q)
      );
    });
  }, [threads, tab, searchQuery, unreadOnly]);

  const active = threads.find((t) => t.id === activeId) ?? visible[0] ?? threads[0];

  function openThread(id: string) {
    setActiveId(id);
    markRead(id);
  }

  function markRead(id: string) {
    setThreads((curr) =>
      curr.map((t) => (t.id === id ? { ...t, unread: 0, read: true } : t)),
    );
  }

  function togglePin(id: string) {
    let pinnedNow = false;
    setThreads((curr) =>
      curr.map((t) => {
        if (t.id !== id) return t;
        pinnedNow = !t.pinned;
        return { ...t, pinned: pinnedNow };
      }),
    );
    toast.info(pinnedNow ? "Conversation pinned" : "Conversation unpinned");
  }

  function noteAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      const kind: MsgAttachment["kind"] = e.target === imageRef.current ? "image" : "file";
      setPendingAttachments((curr) => [...curr, { name: f.name, size: f.size, kind }]);
      toast.success("Attachment ready", {
        description: `${f.name} · scanned · clean · will send with your next message`,
      });
    }
    e.target.value = "";
  }

  function removePendingAttachment(name: string) {
    setPendingAttachments((curr) => curr.filter((a) => a.name !== name));
  }

  function send() {
    if (!active) return;
    const body = draft.trim();
    const hasAtt = pendingAttachments.length > 0;
    if (!body && !hasAtt) return;
    const now = new Date().toISOString();
    const msg: ClinicianMessage = {
      id: `m-${Date.now()}`,
      from: "clinician",
      body,
      at: now,
      attachments: hasAtt ? pendingAttachments : undefined,
    };
    setThreads((curr) =>
      curr.map((t) =>
        t.id === active.id
          ? { ...t, messages: [...t.messages, msg], lastActivity: now, sentByMe: true, read: true }
          : t,
      ),
    );
    setDraft("");
    setPendingAttachments([]);
    setEmojiOpen(false);
    toast.success("Message sent", { description: `${active.patient} · audit-logged` });
  }

  function startThread(recipient: (typeof PATIENT_PANEL)[number], message: string) {
    const body = message.trim() || "Hello";
    const now = new Date().toISOString();
    const id = `t-new-${Date.now()}`;
    const thread: ClinicianThread = {
      id,
      patient: recipient.name,
      initials: recipient.initials,
      mrn: recipient.mrn,
      role: recipient.role,
      preview: body,
      time: "Just now",
      unread: 0,
      sentByMe: true,
      read: true,
      lastActivity: now,
      messages: [
        {
          id: `m-${Date.now()}`,
          from: "clinician",
          body,
          at: now,
        },
      ],
    };
    setThreads((curr) => [thread, ...curr]);
    setActiveId(id);
    setComposeOpen(false);
    toast.success("Conversation started", { description: `${recipient.name} · audit-logged` });
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
                No conversations match.
              </li>
            )}
            {visible.map((t) => {
              const last = t.messages[t.messages.length - 1];
              const isActive = t.id === active?.id;
              const flagMeta = t.flag ? FLAG_META[t.flag] : null;
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
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback>{t.initials}</AvatarFallback>
                    </Avatar>
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
                      <p className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                        <span className="font-mono">{t.mrn}</span>
                        {flagMeta && (
                          <Badge variant={flagMeta.variant} size="sm" dot>
                            {flagMeta.label}
                          </Badge>
                        )}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted-foreground)]">
                        {t.sentByMe && (
                          <span className="mr-1 text-[var(--color-primary-700)]">You:</span>
                        )}
                        {last?.body ?? "No messages yet"}
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
                Pick a conversation from the list.
              </p>
            </div>
          </section>
        )}
      </div>

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} onStart={startThread} />
    </div>
  );
}

function ComposeDialog({
  open,
  onOpenChange,
  onStart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStart: (recipient: (typeof PATIENT_PANEL)[number], message: string) => void;
}) {
  const [recipientIdx, setRecipientIdx] = useState(0);
  const [message, setMessage] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onStart(PATIENT_PANEL[recipientIdx], message);
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
            <select
              id="compose-recipient"
              value={recipientIdx}
              onChange={(e) => setRecipientIdx(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
            >
              {PATIENT_PANEL.map((p, i) => (
                <option key={p.mrn} value={i}>
                  {p.name} · {p.mrn}
                </option>
              ))}
            </select>
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
            <Button type="submit" disabled={!message.trim()}>
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
  const messages = active.messages;
  const flagMeta = active.flag ? FLAG_META[active.flag] : null;

  return (
    <section className="flex min-w-0 flex-col bg-[var(--color-background)]">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/80 px-5 py-3 backdrop-blur">
        <Avatar className="size-9">
          <AvatarFallback>{active.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{active.patient}</p>
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{active.mrn}</span>
            {flagMeta && (
              <Badge variant={flagMeta.variant} size="sm" dot>
                {flagMeta.label}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            {active.role} · last active {relativeTime(active.lastActivity)}
          </p>
        </div>
        <SecurityBadge variant="encrypted" className="hidden sm:inline-flex" />
        <SecurityBadge variant="audited" className="hidden md:inline-flex" />
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

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
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
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2.5 ${m.from === "clinician" ? "justify-end" : ""}`}>
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
                      }`}
                    >
                      {m.body}
                    </div>
                  )}
                  {m.attachments && m.attachments.length > 0 && (
                    <div className={`flex flex-wrap gap-1.5 ${m.from === "clinician" ? "justify-end" : ""}`}>
                      {m.attachments.map((a) => {
                        const isMine = m.from === "clinician";
                        const Icon = a.kind === "image" ? ImageIcon : Paperclip;
                        return (
                          <span
                            key={a.name}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium shadow-[var(--shadow-soft)] ${
                              isMine
                                ? "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/15 text-[var(--color-primary-700)]"
                                : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)]"
                            }`}
                          >
                            <Icon className="size-3.5" />
                            <span className="max-w-[180px] truncate">{a.name}</span>
                            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                              {formatSize(a.size)}
                            </span>
                          </span>
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
            ))}
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
