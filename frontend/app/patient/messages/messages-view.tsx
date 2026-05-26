"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Paperclip,
  Send,
  Lock,
  Check,
  CheckCheck,
  Pin,
  Plus,
  Filter,
  Smile,
  Image as ImageIcon,
  X,
  MessagesSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input, Textarea, Label } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmojiPicker } from "./emoji-picker";
import { usePatientStore, type MessageThread } from "@/lib/patient-store";

const CARE_TEAM = [
  { name: "Dr. Priya Shah", role: "Cardiology", initials: "PS" },
  { name: "Dr. Rohan Iyer", role: "General Medicine", initials: "RI" },
  { name: "Dr. Meera Nair", role: "Endocrinology", initials: "MN" },
  { name: "Care coordinator", role: "Care Team", initials: "CC" },
  { name: "Radiology Dept.", role: "Imaging", initials: "RD" },
  { name: "Pharmacy", role: "Medication", initials: "PH" },
] as const;

function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s*/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yest = new Date();
  yest.setDate(now.getDate() - 1);
  const isYest =
    date.getFullYear() === yest.getFullYear() &&
    date.getMonth() === yest.getMonth() &&
    date.getDate() === yest.getDate();
  if (isYest) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MessagesView({ initialThreadId }: { initialThreadId?: string } = {}) {
  const { state, sendMessage, createThread, markThreadRead, togglePinThread } = usePatientStore();
  const search = useSearchParams();
  const queryThread = search.get("thread") ?? initialThreadId ?? null;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"inbox" | "pinned" | "all">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  // Pick an initial active thread once hydrated.
  useEffect(() => {
    if (!state.hydrated) return;
    if (activeId && state.threads.some((t) => t.id === activeId)) return;
    const target =
      (queryThread && state.threads.find((t) => t.id === queryThread)?.id) ??
      state.threads[0]?.id ??
      null;
    setActiveId(target);
    if (target) markThreadRead(target);
  }, [state.hydrated, state.threads, queryThread, activeId, markThreadRead]);

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  if (state.threads.length === 0) return <EmptyInbox onCompose={() => setComposeOpen(true)} composeOpen={composeOpen} setComposeOpen={setComposeOpen} onStart={start} />;

  const active = state.threads.find((t) => t.id === activeId) ?? state.threads[0];
  const unreadTotal = state.threads.filter((t) => t.unread).length;

  const visible = state.threads.filter((t) => {
    if (tab === "pinned" && !t.pinned) return false;
    if (unreadOnly && !t.unread) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const last = t.messages[t.messages.length - 1]?.body ?? "";
    return (
      t.with.toLowerCase().includes(q) ||
      t.withRole.toLowerCase().includes(q) ||
      last.toLowerCase().includes(q)
    );
  });

  function openThread(id: string) {
    setActiveId(id);
    markThreadRead(id);
  }

  function send() {
    if (!draft.trim() || !active) return;
    sendMessage(active.id, draft.trim());
    setDraft("");
    setEmojiOpen(false);
  }

  function start(recipient: (typeof CARE_TEAM)[number], message: string) {
    const thread = createThread({
      with: recipient.name,
      withRole: recipient.role,
      subject: message.trim().slice(0, 40) || `New conversation with ${recipient.name}`,
      initialBody: message.trim() || "Hello",
    });
    setActiveId(thread.id);
    setComposeOpen(false);
    toast.success("Conversation started", { description: `New message to ${recipient.name}` });
  }

  function noteAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) toast.success("Attachment ready", { description: `${f.name} · scanned · clean (demo build · not persisted)` });
    e.target.value = "";
  }

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 md:grid-cols-[340px_1fr]">
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
              placeholder="Search messages"
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
                  <Button variant={unreadOnly ? "soft" : "ghost"} size="icon-sm" className="ml-auto" aria-label="Filter">
                    <Filter />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setUnreadOnly((v) => !v)}>
                    <Check className={unreadOnly ? "" : "opacity-0"} /> Unread only
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { setUnreadOnly(false); setSearchQuery(""); }}>
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
              return (
                <li key={t.id}>
                  <button
                    onClick={() => openThread(t.id)}
                    className={`group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                      isActive ? "bg-[var(--color-primary-50)]" : "hover:bg-[var(--color-muted)]/50"
                    }`}
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback>{initials(t.with)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`flex items-center gap-1 truncate text-sm ${t.unread ? "font-semibold" : "font-medium"} ${isActive ? "text-[var(--color-primary-700)]" : ""}`}>
                          {t.pinned && <Pin className="size-3 shrink-0 text-[var(--color-muted-foreground)]" />}
                          {t.with}
                        </p>
                        <span className="text-[10px] text-[var(--color-muted-foreground)]">{relativeTime(t.lastActivity)}</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">{t.withRole}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted-foreground)]">
                        {last?.body ?? "No messages yet"}
                      </p>
                    </div>
                    {t.unread && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-[10px] font-semibold text-white">
                        new
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
          <ThreadView
            active={active}
            draft={draft}
            setDraft={setDraft}
            onSend={send}
            onTogglePin={() => {
              togglePinThread(active.id);
              toast.info(active.pinned ? "Conversation unpinned" : "Conversation pinned");
            }}
            emojiOpen={emojiOpen}
            setEmojiOpen={setEmojiOpen}
            fileRef={fileRef}
            imageRef={imageRef}
            onAttach={noteAttachment}
          />
        ) : (
          <section className="flex items-center justify-center bg-[var(--color-background)] p-10">
            <p className="text-sm text-[var(--color-muted-foreground)]">Pick a conversation from the list.</p>
          </section>
        )}
      </div>

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} onStart={start} />
    </div>
  );
}

function ThreadView({
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
}: {
  active: MessageThread;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onTogglePin: () => void;
  emojiOpen: boolean;
  setEmojiOpen: (v: boolean | ((v: boolean) => boolean)) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  imageRef: React.RefObject<HTMLInputElement | null>;
  onAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const messages = active.messages;
  return (
    <section className="flex min-w-0 flex-col bg-[var(--color-background)]">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/80 px-5 py-3 backdrop-blur">
        <Avatar className="size-9">
          <AvatarFallback>{initials(active.with)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{active.with}</p>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">{active.withRole} · last active {relativeTime(active.lastActivity)}</p>
        </div>
        <SecurityBadge variant="encrypted" className="hidden sm:inline-flex" />
        <SecurityBadge variant="audited" className="hidden md:inline-flex" />
        <Button variant="ghost" size="icon-sm" aria-label={active.pinned ? "Unpin" : "Pin"} onClick={onTogglePin}>
          <Pin className={active.pinned ? "fill-[var(--color-primary)] text-[var(--color-primary)]" : ""} />
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
            No messages yet — say hello to {active.with}.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2.5 ${m.from === "patient" ? "justify-end" : ""}`}>
                {m.from === "clinician" && (
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback>{initials(active.with)}</AvatarFallback>
                  </Avatar>
                )}
                <div className="max-w-[70%] space-y-1">
                  <div
                    className={`relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-[var(--shadow-soft)] ${
                      m.from === "patient"
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-card)] text-[var(--color-foreground)]"
                    }`}
                  >
                    {m.body}
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)] ${m.from === "patient" ? "justify-end" : ""}`}>
                    <span>{relativeTime(m.at)}</span>
                    {m.from === "patient" && <CheckCheck className="size-3.5 text-[var(--color-primary)]" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-card)]/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-2">
          <Textarea
            placeholder="Write a message… End-to-end encrypted, scanned for attachments."
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
              <Button variant="ghost" size="icon-sm" aria-label="Attach file" onClick={() => fileRef.current?.click()}>
                <Paperclip />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Attach image" onClick={() => imageRef.current?.click()}>
                <ImageIcon />
              </Button>
              <div className="relative">
                <Button variant="ghost" size="icon-sm" aria-label="Emoji" onClick={() => setEmojiOpen((v) => !v)}>
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
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
                <Lock className="size-3" /> Encrypted
              </span>
              <Button size="sm" onClick={onSend} disabled={!draft.trim()}>
                <Send /> Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComposeDialog({
  open,
  onOpenChange,
  onStart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStart: (recipient: (typeof CARE_TEAM)[number], message: string) => void;
}) {
  const [recipientIdx, setRecipientIdx] = useState(0);
  const [message, setMessage] = useState("");
  const recipients = useMemo(() => CARE_TEAM, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Start a secure, end-to-end encrypted conversation with your care team.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            onStart(recipients[recipientIdx], message);
            setMessage("");
            setRecipientIdx(0);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="recipient">Recipient</Label>
            <select
              id="recipient"
              value={recipientIdx}
              onChange={(e) => setRecipientIdx(Number(e.target.value))}
              className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
            >
              {recipients.map((c, i) => (
                <option key={c.name} value={i}>
                  {c.name} · {c.role}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="first-message">Message</Label>
            <Textarea
              id="first-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What would you like to ask?"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">
              <Send /> Start conversation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmptyInbox({
  onCompose,
  composeOpen,
  setComposeOpen,
  onStart,
}: {
  onCompose: () => void;
  composeOpen: boolean;
  setComposeOpen: (v: boolean) => void;
  onStart: (recipient: (typeof CARE_TEAM)[number], message: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
          <MessagesSquare className="size-6" />
        </div>
        <p className="text-sm font-semibold">No conversations yet</p>
        <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
          Send a secure, encrypted message to anyone on your care team — clinicians, care coordinators, or your pharmacy.
        </p>
        <Button onClick={onCompose} className="mt-1"><Plus /> Start a conversation</Button>
      </div>
      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} onStart={onStart} />
    </>
  );
}
