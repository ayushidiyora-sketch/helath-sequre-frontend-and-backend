"use client";

import { useState } from "react";

/* ------------------------------------------------------------ emoji data */

interface EmojiCategory {
  id: string;
  label: string;
  tab: string; // representative emoji used as the category tab
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys & People",
    tab: "😀",
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 😐 😶 😏 😒 🙄 😬 😴 😷 🤒 🤕 🤧 🥳 😎 🤓 🧐 😕 😟 😢 😭 😤 😠 🥹 👶 🧑 👩 👨 👵 👴 👋 🙏 👍 👎 👌 ✌️ 🤞 💪".split(" "),
  },
  {
    id: "animals",
    label: "Animals & Nature",
    tab: "🐶",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🐠 🐬 🐳 🦈 🌸 🌷 🌹 🌻 🌼 🌲 🌳 🌵 🍀 🍁 🍂 🌍 ⭐ 🌙 ☀️ ⛅ 🌈 🔥 💧 ❄️".split(" "),
  },
  {
    id: "food",
    label: "Food & Drink",
    tab: "🍔",
    emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥦 🌽 🥕 🥔 🍞 🧀 🥚 🍗 🍖 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍣 🍤 🍱 🍜 🍙 🍚 🍦 🍩 🍪 🎂 🍰 🍫 🍬 🍭 ☕ 🍵 🧃 🥤 🍺 🍷 🍹".split(" "),
  },
  {
    id: "travel",
    label: "Travel & Places",
    tab: "✈️",
    emojis: "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🏍️ 🚲 ✈️ 🚀 🚁 ⛵ 🚤 🚢 ⚓ 🚉 🚦 🗺️ 🏔️ ⛰️ 🌋 🏕️ 🏖️ 🏝️ 🏠 🏡 🏥 🏨 🏦 🏫 🏪 🏰 🗼 🗽 ⛲ 🌅 🌄 🌃 🌆 🌉".split(" "),
  },
  {
    id: "activities",
    label: "Activities",
    tab: "⚽",
    emojis: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🏏 ⛳ 🏹 🎣 🥊 🥋 🎽 ⛸️ 🎿 🛷 🏂 🪂 🏋️ 🤸 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🚴 🎯 🎲 🎮 🎸 🎺 🎻 🥁 🎨 🎬 🎤 🎧 🎼".split(" "),
  },
  {
    id: "objects",
    label: "Objects",
    tab: "💡",
    emojis: "⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 📷 📸 📹 🎥 📞 ☎️ 📠 📺 📻 🔋 🔌 💡 🔦 🕯️ 🧯 💸 💵 💳 🔧 🔨 ⚙️ 🔩 ⚗️ 🔬 🔭 📡 💊 🩺 🌡️ 🚪 🛏️ 🧹 🔑 🔒 📦 📬 📋 📎 ✏️ 📝 📚".split(" "),
  },
  {
    id: "symbols",
    label: "Symbols",
    tab: "❤️",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💝 ✨ ⭐ 🌟 💫 ✅ ❌ ❓ ❗ ⚠️ ♻️ 🔔 🔕 🎵 🎶 ➕ ➖ ✖️ ➗ 💯 🆗 🆕 🔆 🚫 ⛔ 📛 🔰 ⚡ 💥 🔅 🕐".split(" "),
  },
  {
    id: "flags",
    label: "Flags",
    tab: "🏳️",
    emojis: "🏳️ 🏴 🏁 🚩 🏳️‍🌈 🇮🇳 🇺🇸 🇬🇧 🇨🇦 🇦🇺 🇩🇪 🇫🇷 🇯🇵 🇨🇳 🇧🇷 🇿🇦 🇸🇬 🇦🇪 🇮🇹 🇪🇸 🇷🇺 🇰🇷 🇲🇽 🇳🇱 🇸🇪 🇨🇭 🇮🇩 🇸🇦 🇹🇷 🇪🇬 🇳🇿 🇮🇪".split(" "),
  },
];

/* ---------------------------------------------------------------- stickers */

const STICKER_GROUPS: { label: string; items: string[] }[] = [
  { label: "Funny stickers", items: ["😂", "🤣", "😜", "🤪", "🙃", "😅", "🥴", "🤡", "👻", "🙈", "🤓", "😎"] },
  { label: "Festival stickers", items: ["🎉", "🎊", "🎈", "🎁", "🎂", "🪔", "🎆", "🎇", "🧨", "🎄", "🕎", "✨"] },
  { label: "Love stickers", items: ["❤️", "😍", "🥰", "😘", "💕", "💖", "💘", "💝", "💞", "💓", "🌹", "💌"] },
];

/* -------------------------------------------------------------------- gifs */

const GIF_GROUPS: { label: string; items: { emoji: string; caption: string }[] }[] = [
  {
    label: "Funny GIF",
    items: [
      { emoji: "😂", caption: "Laughing" },
      { emoji: "🤦", caption: "Facepalm" },
      { emoji: "🕺", caption: "Dancing" },
      { emoji: "🙀", caption: "Cat fail" },
      { emoji: "😬", caption: "Oops" },
      { emoji: "🤣", caption: "LOL" },
    ],
  },
  {
    label: "Reaction GIF",
    items: [
      { emoji: "👍", caption: "Thumbs up" },
      { emoji: "🤯", caption: "Mind blown" },
      { emoji: "🙄", caption: "Eye roll" },
      { emoji: "🤷", caption: "Shrug" },
      { emoji: "👏", caption: "Clapping" },
      { emoji: "😮", caption: "Wow" },
    ],
  },
  {
    label: "Movie GIF",
    items: [
      { emoji: "🎬", caption: "Dramatic" },
      { emoji: "👏", caption: "Slow clap" },
      { emoji: "🎤", caption: "Mic drop" },
      { emoji: "🎞️", caption: "The end" },
      { emoji: "🌀", caption: "Plot twist" },
      { emoji: "💥", caption: "Action" },
    ],
  },
  {
    label: "Meme GIF",
    items: [
      { emoji: "🔥", caption: "This is fine" },
      { emoji: "📈", caption: "Stonks" },
      { emoji: "👀", caption: "Distracted" },
      { emoji: "😲", caption: "Surprised" },
      { emoji: "🧠", caption: "Big brain" },
      { emoji: "🐕", caption: "Doge" },
    ],
  },
];

const GIF_GRADIENTS = [
  "from-[oklch(0.7_0.15_25)] to-[oklch(0.55_0.14_350)]",
  "from-[oklch(0.7_0.14_200)] to-[oklch(0.55_0.13_255)]",
  "from-[oklch(0.74_0.15_95)] to-[oklch(0.6_0.14_45)]",
  "from-[oklch(0.7_0.15_150)] to-[oklch(0.55_0.13_200)]",
  "from-[oklch(0.68_0.16_300)] to-[oklch(0.55_0.14_265)]",
  "from-[oklch(0.72_0.15_55)] to-[oklch(0.58_0.15_20)]",
];

/* ------------------------------------------------------------- component */

type Mode = "emoji" | "gif" | "sticker";

export function EmojiPicker({ onPick }: { onPick: (value: string) => void }) {
  const [mode, setMode] = useState<Mode>("emoji");
  const [catIdx, setCatIdx] = useState(0);
  const [gifIdx, setGifIdx] = useState(0);
  const [stickerIdx, setStickerIdx] = useState(0);

  const cat = EMOJI_CATEGORIES[catIdx];
  const gifGroup = GIF_GROUPS[gifIdx];
  const stickerGroup = STICKER_GROUPS[stickerIdx];

  return (
    <div className="fixed inset-x-2 bottom-2 z-30 mx-auto w-auto max-w-[20rem] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-lift)] sm:absolute sm:inset-x-auto sm:bottom-10 sm:left-0 sm:right-auto sm:mx-0 sm:w-80">
      {/* Mode tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {(["emoji", "gif", "sticker"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors ${
              mode === m
                ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary-700)]"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {m === "emoji" ? "Emoji" : m === "gif" ? "GIF" : "Stickers"}
          </button>
        ))}
      </div>

      {/* EMOJI */}
      {mode === "emoji" && (
        <>
          <div className="border-b border-[var(--color-border)] px-2 pt-2">
            <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              {cat.label}
            </p>
            <div className="flex gap-0.5">
              {EMOJI_CATEGORIES.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => setCatIdx(i)}
                  className={`flex-1 rounded-md py-1 text-base transition-colors ${
                    i === catIdx ? "bg-[var(--color-primary-50)]" : "hover:bg-[var(--color-muted)]"
                  }`}
                >
                  {c.tab}
                </button>
              ))}
            </div>
          </div>
          <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-2">
            {cat.emojis.map((emo, i) => (
              <button
                key={`${emo}-${i}`}
                type="button"
                className="rounded p-1 text-lg hover:bg-[var(--color-muted)]"
                onClick={() => onPick(emo)}
              >
                {emo}
              </button>
            ))}
          </div>
        </>
      )}

      {/* GIF */}
      {mode === "gif" && (
        <>
          <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] p-2">
            {GIF_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setGifIdx(i)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  i === gifIdx
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto p-2">
            {gifGroup.items.map((g, i) => (
              <button
                key={g.caption}
                type="button"
                onClick={() => onPick(g.emoji)}
                className={`relative flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br ${
                  GIF_GRADIENTS[i % GIF_GRADIENTS.length]
                } text-3xl transition-transform hover:scale-[1.03]`}
              >
                {g.emoji}
                <span className="absolute bottom-1 left-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-medium text-white">
                  {g.caption}
                </span>
                <span className="absolute right-1.5 top-1.5 rounded bg-black/45 px-1 py-0.5 text-[8px] font-bold text-white">
                  GIF
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* STICKERS */}
      {mode === "sticker" && (
        <>
          <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] p-2">
            {STICKER_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setStickerIdx(i)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  i === stickerIdx
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="grid max-h-52 grid-cols-4 gap-2 overflow-y-auto p-3">
            {stickerGroup.items.map((s, i) => (
              <button
                key={`${s}-${i}`}
                type="button"
                onClick={() => onPick(s)}
                className="flex aspect-square items-center justify-center rounded-xl bg-[var(--color-muted)]/60 text-3xl transition-transform hover:scale-110 hover:bg-[var(--color-primary-50)]"
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
