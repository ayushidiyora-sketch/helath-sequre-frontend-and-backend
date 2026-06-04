"use client";

import { useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, ScanLine } from "lucide-react";
import type { ImagingImage } from "@/app/patient/records/records-data";

/**
 * Imaging render surface — a lightweight DICOM-style viewer. Shows a study's
 * images in a dark viewport with zoom (buttons + wheel) and click-drag pan, a
 * thumbnail series strip to switch frames, and a metadata overlay (modality,
 * body part, frame index). When an image has no `src`, a scan placeholder is
 * drawn so the viewer surface is fully functional without real DICOM assets.
 */
export function ImagingViewer({
  images,
  modality,
  bodyPart,
  studyDate,
}: {
  images: ImagingImage[];
  modality?: string;
  bodyPart?: string;
  studyDate?: string;
}) {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const safeIndex = Math.min(index, images.length - 1);
  const current = images[safeIndex];

  const clampScale = (s: number) => Math.max(1, Math.min(4, s));
  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const zoom = (delta: number) => {
    setScale((s) => {
      const next = clampScale(s + delta);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };
  const select = (i: number) => {
    setIndex(i);
    reset();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Viewport */}
      <div
        className="relative aspect-[4/3] w-full select-none overflow-hidden bg-[oklch(0.18_0.01_250)]"
        style={{ cursor: scale > 1 ? (drag.current ? "grabbing" : "grab") : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={(e) => zoom(e.deltaY < 0 ? 0.2 : -0.2)}
      >
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
          {current?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.src} alt={current.label} className="max-h-full max-w-full object-contain" draggable={false} />
          ) : (
            <ScanPlaceholder index={safeIndex} label={current?.label ?? ""} />
          )}
        </div>

        {/* Metadata overlay */}
        <div className="pointer-events-none absolute left-3 top-3 space-y-0.5 font-mono text-[10px] leading-tight text-white/70">
          {modality && <p>{modality}</p>}
          {bodyPart && <p>{bodyPart}</p>}
          {studyDate && <p>{studyDate}</p>}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] text-white/70">
          {safeIndex + 1} / {images.length}
          {current?.label ? ` · ${current.label}` : ""}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] text-white/70">
          <ScanLine className="size-3" /> {Math.round(scale * 100)}%
        </div>

        {/* Prev / next frame */}
        {images.length > 1 && (
          <>
            <ViewportButton side="left" onClick={() => select((safeIndex - 1 + images.length) % images.length)}>
              <ChevronLeft className="size-4" />
            </ViewportButton>
            <ViewportButton side="right" onClick={() => select((safeIndex + 1) % images.length)}>
              <ChevronRight className="size-4" />
            </ViewportButton>
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-3 py-2">
        <p className="text-[11px] text-[var(--color-muted-foreground)]">
          Scroll to zoom · drag to pan when zoomed
        </p>
        <div className="flex items-center gap-1">
          <ToolButton label="Zoom out" onClick={() => zoom(-0.2)} disabled={scale <= 1}>
            <ZoomOut className="size-4" />
          </ToolButton>
          <ToolButton label="Zoom in" onClick={() => zoom(0.2)} disabled={scale >= 4}>
            <ZoomIn className="size-4" />
          </ToolButton>
          <ToolButton label="Reset view" onClick={reset} disabled={scale === 1 && offset.x === 0 && offset.y === 0}>
            <Maximize2 className="size-4" />
          </ToolButton>
        </div>
      </div>

      {/* Series thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-[var(--color-border)] p-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => select(i)}
              className={`group relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === safeIndex
                  ? "border-[var(--color-primary)]"
                  : "border-transparent hover:border-[var(--color-border)]"
              }`}
              aria-label={`View ${img.label}`}
            >
              <div className="absolute inset-0 bg-[oklch(0.18_0.01_250)]">
                {img.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.src} alt={img.label} className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <ScanPlaceholder index={i} label="" compact />
                )}
              </div>
              <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[9px] text-white/80">
                {img.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewportButton({
  side,
  onClick,
  children,
}: {
  side: "left" | "right";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-2" : "right-2"} flex size-8 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white`}
    >
      {children}
    </button>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * Grayscale radiograph stand-in drawn with SVG so the viewer surface works
 * without real DICOM files. Two slightly different silhouettes distinguish
 * frames (e.g. PA vs lateral).
 */
function ScanPlaceholder({ index, label, compact }: { index: number; label: string; compact?: boolean }) {
  const lateral = index % 2 === 1;
  return (
    <svg viewBox="0 0 200 150" className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={label || "Scan image"}>
      <defs>
        <radialGradient id={`glow-${index}`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="oklch(0.42 0.01 250)" />
          <stop offset="100%" stopColor="oklch(0.16 0.01 250)" />
        </radialGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#glow-${index})`} />
      {lateral ? (
        <g fill="none" stroke="oklch(0.78 0.01 250)" strokeOpacity="0.5" strokeWidth="1.4">
          <path d="M70 25 q40 0 44 50 q4 50 -30 55" />
          <path d="M74 40 q26 8 26 35" strokeOpacity="0.3" />
          <path d="M74 60 q30 6 28 30" strokeOpacity="0.3" />
          <line x1="92" y1="22" x2="92" y2="128" strokeOpacity="0.4" />
        </g>
      ) : (
        <g fill="none" stroke="oklch(0.78 0.01 250)" strokeOpacity="0.5" strokeWidth="1.4">
          {/* ribcage-ish arcs */}
          <path d="M100 24 v104" strokeOpacity="0.45" />
          <path d="M100 30 q-42 6 -52 48" />
          <path d="M100 30 q42 6 52 48" />
          <path d="M100 48 q-34 6 -42 40" strokeOpacity="0.35" />
          <path d="M100 48 q34 6 42 40" strokeOpacity="0.35" />
          <path d="M100 66 q-26 6 -32 30" strokeOpacity="0.28" />
          <path d="M100 66 q26 6 32 30" strokeOpacity="0.28" />
          <ellipse cx="100" cy="110" rx="20" ry="12" strokeOpacity="0.3" />
        </g>
      )}
      {!compact && (
        <text x="100" y="143" textAnchor="middle" fill="oklch(0.78 0.01 250)" fillOpacity="0.45" fontSize="7" fontFamily="monospace">
          DEMO RENDER · NOT DIAGNOSTIC
        </text>
      )}
    </svg>
  );
}
