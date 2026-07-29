"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Modal,
  ProgressBar,
  Skeleton,
  Spinner,
  LoadingState,
  TextField,
  TextArea,
  TypingDots,
} from "@/components/ui";

/* ════════════════════════════════════════════════════════════════════
 * /style-guide — the design handoff surface.
 *
 * Every design token and every component in components/ui/ rendered on
 * one page, so a design tool (Lovable, v0, Figma import) has a single
 * place to see the system and a single place to verify a change. This
 * route reads no data and calls no server action; it is safe to
 * restyle freely.
 *
 * Adding a component to components/ui/? Add it here too, otherwise it
 * is invisible to whoever is doing the redesign.
 *
 * See LOVABLE.md for what is safe to edit and what is a security
 * boundary that must not be refactored.
 * ════════════════════════════════════════════════════════════════════ */

/* Token tables mirror the :root block in app/globals.css. `varName` is
   what a design tool edits; `utility` is what pages should use. */
const SURFACE_TOKENS = [
  { varName: "--background", utility: "bg-background", use: "Page background" },
  { varName: "--surface-sunken", utility: "bg-surface-sunken", use: "Inset fields, wells" },
  { varName: "--surface", utility: "bg-surface", use: "Cards, panels" },
  { varName: "--surface-raised", utility: "bg-surface-raised", use: "Hover states, chips" },
];

const LINE_TOKENS = [
  { varName: "--line", utility: "border-line", use: "Default card border" },
  { varName: "--line-strong", utility: "border-line-strong", use: "Hover border" },
  { varName: "--line-focus", utility: "border-line-focus", use: "Focused input border" },
];

const TEXT_TOKENS = [
  { varName: "--foreground", utility: "text-foreground", use: "Primary text" },
  { varName: "--foreground-dim", utility: "text-foreground-dim", use: "Primary on hover" },
  { varName: "--muted-strong", utility: "text-muted-strong", use: "Secondary text" },
  { varName: "--muted", utility: "text-muted", use: "Captions, placeholders" },
  { varName: "--muted-faint", utility: "text-muted-faint", use: "Disabled, watermarks" },
];

const ACCENT_TOKENS = [
  { varName: "--accent", utility: "bg-accent", use: "Primary action" },
  { varName: "--danger", utility: "text-danger", use: "Bans, deletes, errors" },
  { varName: "--warning", utility: "text-warning", use: "VIP, caution" },
  { varName: "--success", utility: "text-success", use: "Confirmations" },
  { varName: "--info", utility: "text-info", use: "Neutral highlights" },
  { varName: "--restricted", utility: "text-restricted", use: "Temporary restriction" },
];

const BRAND_TOKENS = [
  { varName: "--brand", utility: "bg-brand", use: "Primary brand — rings, glows" },
  { varName: "--brand-light", utility: "text-brand-light", use: "Brand text" },
  { varName: "--brand-lighter", utility: "text-brand-lighter", use: "Brand text, emphasis" },
  { varName: "--brand-dark", utility: "to-brand-dark", use: "Gradient end" },
  { varName: "--brand-deep", utility: "bg-brand-deep", use: "Deep background wash" },
  { varName: "--brand-deepest", utility: "bg-brand-deepest", use: "Deepest background wash" },
];

const BADGE_TONES = [
  "nsfw",
  "sfw",
  "visibility",
  "tier",
  "personality",
  "tag",
  "vip",
  "admin",
  "banned",
] as const;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-10">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-muted">{description}</p>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="w-40 shrink-0 font-mono text-xs text-muted-faint">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Swatch({
  varName,
  utility,
  use,
}: {
  varName: string;
  utility: string;
  use: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-11 w-11 shrink-0 rounded-lg border border-line-strong"
        style={{ background: `var(${varName})` }}
      />
      <div className="min-w-0">
        <div className="truncate font-mono text-xs text-foreground">{varName}</div>
        <div className="truncate font-mono text-[11px] text-muted-faint">{utility}</div>
        <div className="truncate text-[11px] text-muted">{use}</div>
      </div>
    </div>
  );
}

export default function StyleGuidePage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="border-b border-line pb-8">
        <h1 className="text-3xl font-bold text-foreground">Style guide</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every design token and UI component in one place. Tokens are defined in{" "}
          <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-muted-strong">
            app/globals.css
          </code>
          ; components live in{" "}
          <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-muted-strong">
            components/ui/
          </code>
          . Changing a token value retints the whole app. Read{" "}
          <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-muted-strong">
            LOVABLE.md
          </code>{" "}
          before editing anything outside those two locations.
        </p>
      </header>

      <Section
        title="Surfaces"
        description="Elevation ladder. Page sits on --background; cards on --surface; anything hovering above a card on --surface-raised."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SURFACE_TOKENS.map((t) => (
            <Swatch key={t.varName} {...t} />
          ))}
        </div>
      </Section>

      <Section
        title="Lines"
        description="Borders and dividers. Three weights: resting, hover, focus."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LINE_TOKENS.map((t) => (
            <Swatch key={t.varName} {...t} />
          ))}
        </div>
      </Section>

      <Section
        title="Text"
        description="Five steps of emphasis. Body copy is --foreground; everything supporting it steps down."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TEXT_TOKENS.map((t) => (
            <Swatch key={t.varName} {...t} />
          ))}
        </div>
        <div className="mt-6 space-y-1 rounded-xl border border-line bg-surface p-5">
          <p className="text-foreground">Primary — the thing you came to read.</p>
          <p className="text-foreground-dim">Dim — primary text on hover.</p>
          <p className="text-muted-strong">Secondary — supporting detail.</p>
          <p className="text-muted">Caption — timestamps, counts, hints.</p>
          <p className="text-muted-faint">Faint — disabled and decorative.</p>
        </div>
      </Section>

      <Section
        title="Brand"
        description="The highest-leverage block for a retheme. Every glow, ring, gradient and active state in the app derives from these. Alpha works: bg-brand/10, border-brand/30."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BRAND_TOKENS.map((t) => (
            <Swatch key={t.varName} {...t} />
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-gradient-to-r from-brand to-brand-dark px-5 py-3 text-sm font-medium text-white">
            Gradient
          </div>
          <div className="rounded-xl border border-brand/30 bg-brand/10 px-5 py-3 text-sm text-brand-lighter">
            Tinted surface
          </div>
          <div className="rounded-xl px-5 py-3 text-sm text-foreground ring-2 ring-brand/50">
            Focus ring
          </div>
        </div>
      </Section>

      <Section
        title="Accents"
        description="Semantic, not decorative. Pick by meaning — danger for destructive, warning for VIP — so a retheme keeps the meaning intact."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ACCENT_TOKENS.map((t) => (
            <Swatch key={t.varName} {...t} />
          ))}
        </div>
      </Section>

      <Section title="Typography" description="Geist Sans for UI, Geist Mono for code and IDs.">
        <div className="space-y-3">
          <p className="text-3xl font-bold text-foreground">Heading 1 — 3xl bold</p>
          <p className="text-xl font-semibold text-foreground">Heading 2 — xl semibold</p>
          <p className="text-base text-foreground">Body — base regular</p>
          <p className="text-sm text-muted">Small — sm, muted</p>
          <p className="font-mono text-xs text-muted-strong">Mono — xs, for IDs and code</p>
        </div>
      </Section>

      <Section title="Button" description="Four variants, three sizes, plus a loading state.">
        <Row label="variant">
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
        </Row>
        <Row label="size">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
        <Row label="state">
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </Row>
      </Section>

      <Section title="Badge" description="Status pills. Tone carries the meaning; never pick one for colour alone.">
        <Row label="tone">
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </Row>
      </Section>

      <Section title="Avatar" description="Five sizes, two shapes. Falls back to the initial when src is null.">
        <Row label="size">
          <Avatar name="Ada" size="xs" />
          <Avatar name="Ada" size="sm" />
          <Avatar name="Ada" size="md" />
          <Avatar name="Ada" size="lg" />
          <Avatar name="Ada" size="xl" />
        </Row>
        <Row label="shape">
          <Avatar name="Ada" size="md" shape="circle" />
          <Avatar name="Ada" size="md" shape="square" />
        </Row>
      </Section>

      <Section title="Form controls" description="TextField and TextArea. Both forward every native input prop.">
        <div className="max-w-md space-y-4">
          <TextField placeholder="Display name" />
          <TextField placeholder="Disabled" disabled />
          <TextArea placeholder="Character backstory…" />
        </div>
      </Section>

      <Section title="Loading" description="Spinner for inline waits, Skeleton for content-shaped placeholders, TypingDots for AI turns.">
        <Row label="Spinner">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </Row>
        <Row label="LoadingState">
          <LoadingState text="Finding a match…" />
        </Row>
        <Row label="TypingDots">
          <TypingDots size="sm" />
          <TypingDots size="md" />
        </Row>
        <div className="mt-2 space-y-3">
          <div className="font-mono text-xs text-muted-faint">Skeleton</div>
          <div className="flex items-center gap-3">
            <Skeleton variant="avatar" />
            <Skeleton variant="circle" />
          </div>
          <Skeleton variant="line" />
          <Skeleton variant="card" />
        </div>
      </Section>

      <Section title="ProgressBar" description="Clamped to 0–100%. Used for token balance and match progress.">
        <Row label="0 / 100">
          <ProgressBar value={0} max={100} />
        </Row>
        <Row label="45 / 100">
          <ProgressBar value={45} max={100} />
        </Row>
        <Row label="100 / 100">
          <ProgressBar value={100} max={100} />
        </Row>
      </Section>

      <Section title="EmptyState" description="Shown when a list has no rows. Always give it a subtitle telling the user what to do next.">
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            title="No characters yet"
            subtitle="Create your first character to start matching."
          />
        </div>
      </Section>

      <Section title="Modal" description="Closes on Escape and on backdrop click. Width is a Tailwind class via maxWidth.">
        <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
          <h3 className="text-lg font-semibold text-foreground">Modal title</h3>
          <p className="mt-2 text-sm text-muted">
            Body content goes here. Press Escape or click the backdrop to close.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModalOpen(false)}>Confirm</Button>
          </div>
        </Modal>
      </Section>

      <Section title="Card" description="Not a component — a pattern. Surface, subtle border, rounded-xl, p-5.">
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <Avatar name="Ada" size="md" />
            <div>
              <div className="font-medium text-foreground">Ada</div>
              <div className="text-sm text-muted">Curious, sharp, a little impatient.</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Badge tone="sfw">SFW</Badge>
            <Badge tone="personality">analytical</Badge>
            <Badge tone="tag">sci-fi</Badge>
          </div>
        </div>
      </Section>

      <footer className="py-10 text-sm text-muted">
        This page reads no data and calls no server action. Restyle it freely.
      </footer>
    </main>
  );
}
