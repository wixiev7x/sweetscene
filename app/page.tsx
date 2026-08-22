"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMounted } from "@/lib/utils/useMounted";
import { useStoredFlag, notifyFlagChange } from "@/lib/utils/useStoredFlag";
import TurnstileWidget from "@/components/TurnstileWidget";
import { MIN_PLATFORM_AGE } from "@/lib/config/constants";
import { playSound } from "@/lib/utils/sound";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STEPS = [
  { emoji: "\u{1F52E}", title: "Match Anonymously", desc: "Our AI pairs you on shared interests, not faces. Pick a scene, get matched instantly." },
  { emoji: "\u{1F3AD}", title: "Roleplay Together", desc: "An AI director joins your chat, breaks the ice, and keeps the scene alive with curveball prompts." },
  { emoji: "\u{1F32B}\uFE0F", title: "Reveal or Fade", desc: "When BOTH click Unmask, the blur drops. Stay anonymous forever or walk away." },
];

const SCENARIOS = [
  { name: "Late-Night Diner", emoji: "\u{1F374}", desc: "3am, greasy fries, a jukebox that only plays one song on repeat. The AI keeps throwing curveball questions at you both until sunrise." },
  { name: "Rooftop Stargazing", emoji: "\u{1F31F}", desc: "Ten minutes until the show starts. No names, just a shared blanket and a skyline." },
  { name: "Train Compartment", emoji: "\u{1F686}", desc: "You both swiped Anonymous. The AI seals the compartment doors. Six hours to the next stop." },
  { name: "Airport Lounge", emoji: "\u2708\uFE0F", desc: "Delayed flight. Shared charger. The AI narrates your layover like a rom-com trailer." },
  { name: "Food Truck Festival", emoji: "\u{1F32D}", desc: "Last two in line. Rain starts. The AI makes you share an umbrella and opinions." },
  { name: "Masquerade Ball", emoji: "\u{1F3AD}", desc: "Masks on. The AI assigns secret identities. Dance with a stranger who might be anyone." },
];

const ACTIVITY = [
  { text: "New blind match formed in Train Compartment", time: "just now" },
  { text: "User_7734 just unmasked after a 2hr scene", time: "12s ago" },
  { text: "User_1104 earned the Marathon Talker badge", time: "34s ago" },
  { text: "New character published: The Moonlit Witch", time: "1m ago" },
  { text: "Rooftop Stargazing scene reached 3,000 watchers", time: "2m ago" },
  { text: "Anonymous confession posted: \u2018We talked till 4am...\u2019", time: "3m ago" },
];

const FEATURES = [
  { title: "THE BLIND MATCH", desc: "30-min scene together. Timer hits zero \u2014 reveal or lose match forever.", href: "/scenarios" },
  { title: "AI-GUIDED ROLEPLAY", desc: "Pre-built scenes with AI driving conversation. Just show up.", href: "/explore" },
  { title: "UNMASK TOGETHER", desc: "Mutual consent only. When BOTH click Unmask, the blur drops.", href: "/bounties" },
  { title: "CREATE CHARACTERS", desc: "Design AI personalities for others to interact with.", href: "/create" },
];

const FAQ = [
  { q: "What if I don't want to unmask?", a: "You never have to. Reveal is 100% mutual consent. Stay anonymous forever or walk away \u2014 both are valid." },
  { q: "Will my chats leak?", a: "Your scenes stay in the dark until you say otherwise. Messages are encrypted at rest." },
  { q: "Is this like a dating app?", a: "No. It's a roleplay-first platform. You match on shared interests, build connection through scenes, and reveal only if you both choose to." },
  { q: "What does the AI do?", a: "The AI director breaks the ice, throws curveball prompts, and keeps the scene alive. Every 6 messages, it steps in to keep things moving." },
];

export default function Home() {
  const ageVerified = useStoredFlag("sweetscene_age_verified");
  const mounted = useMounted();
  const [goodbyeClicked, setGoodbyeClicked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [ageError, setAgeError] = useState("");
  const [onlineCount, setOnlineCount] = useState(12847);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setOnlineCount((c) => Math.max(0, c + Math.floor(Math.random() * 11) - 5));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  function calculateAge(): number {
    const month = parseInt(birthMonth, 10);
    const day = parseInt(birthDay, 10);
    const year = parseInt(birthYear, 10);
    if (!month || !day || !year) return -1;
    const birth = new Date(year, month - 1, day);
    if (birth.getMonth() !== month - 1 || birth.getDate() !== day) return -1;
    const now = new Date();
    let age = now.getFullYear() - year;
    if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) {
      age--;
    }
    return age;
  }

  function birthdateISO(): string {
    const month = parseInt(birthMonth, 10);
    const day = parseInt(birthDay, 10);
    const year = parseInt(birthYear, 10);
    if (!month || !day || !year) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function handleVerify() {
    const age = calculateAge();
    if (age < 0) {
      setAgeError("Please enter a valid date of birth.");
      return;
    }
    if (age < MIN_PLATFORM_AGE) {
      setGoodbyeClicked(true);
      setAgeError(`You must be ${MIN_PLATFORM_AGE} or older to use this platform.`);
      setTimeout(() => {
        window.location.assign("https://www.google.com");
      }, 2000);
      return;
    }
    sessionStorage.setItem("sweetscene_pending_dob", birthdateISO());
    localStorage.setItem("sweetscene_age_verified", "true");
    notifyFlagChange();
    playSound("matchFound");
  }

  function handleDecline() {
    setGoodbyeClicked(true);
    setTimeout(() => {
      window.location.assign("https://www.google.com");
    }, 1500);
  }

  if (!mounted) return null;

  if (!ageVerified) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
    const daysInMonth = birthMonth
      ? new Date(parseInt(String(birthYear || currentYear), 10), parseInt(String(birthMonth), 10), 0).getDate()
      : 31;
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const selectClass =
      "bg-surface border border-white/10 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-neon-magenta/50";

    return (
      <div className="fixed inset-0 z-50 bg-void-950 flex items-center justify-center overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-neon-magenta/20"
            style={{
              width: `${4 + (i % 3) * 4}px`,
              height: `${4 + (i % 3) * 4}px`,
              left: `${10 + (i * 12) % 80}%`,
              animation: `floatUp ${12 + (i % 6)}s ${i * 1.5}s infinite linear`,
              opacity: 0,
            }}
          />
        ))}

        <div
          className="relative z-10 flex flex-col items-center text-center px-6"
          style={{ animation: "slowFade 2s ease-in-out forwards" }}
        >
          <span className="font-retro text-sm tracking-[0.3em] text-neon-magenta neon-text uppercase">
            SweetScene
          </span>

          <div className="w-16 mx-auto my-6 h-px bg-gradient-to-r from-transparent via-neon-magenta/50 to-transparent" />

          <h1 className="text-2xl font-light text-foreground-dim">Enter the fog</h1>

          <p className="text-sm text-muted-faint max-w-md mt-3 leading-relaxed">
            This platform contains mature content. Please verify your date of
            birth to continue. You must be {MIN_PLATFORM_AGE} or older.
          </p>

          <div className="flex items-center gap-2 mt-6">
            <select aria-label="Birth month" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} className={selectClass}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
            </select>
            <select aria-label="Birth day" value={birthDay} onChange={(e) => setBirthDay(e.target.value)} className={selectClass}>
              <option value="">Day</option>
              {days.map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
            <select aria-label="Birth year" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className={selectClass}>
              <option value="">Year</option>
              {years.map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>

          {ageError && <p className="text-xs text-danger mt-3">{ageError}</p>}

          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleVerify}
              disabled={!birthMonth || !birthDay || !birthYear || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken)}
              className="px-8 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enter
            </button>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={handleDecline}
                className="px-8 py-3 rounded-xl font-medium text-muted bg-surface border border-white/10 hover:bg-surface-raised active:scale-95 transform transition-all duration-300"
              >
                Leave
              </button>
              {goodbyeClicked && <span className="text-xs text-muted-faint mt-1">Goodbye.</span>}
            </div>
          </div>

          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <div className="mt-6">
              <TurnstileWidget siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onVerify={setTurnstileToken} />
            </div>
          )}

          <p className="text-xs text-muted-faint mt-6">
            By entering, you agree to our{" "}
            <Link href="/legal/terms" className="text-neon-magenta/70 hover:text-brand-light underline">Terms</Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-neon-magenta/70 hover:text-brand-light underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="bg-void-950 text-foreground min-h-screen">
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,45,149,0.12)_0%,transparent_60%)]" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <span
            className="text-xs tracking-[0.3em] text-neon-magenta/60 uppercase max-w-md"
            style={{ animation: "slowFade 1.5s ease-in-out forwards", opacity: 0 }}
          >
            Match first. Build connection. Reveal only when both sides agree.
          </span>

          <h1
            className="gradient-text text-7xl md:text-8xl font-bold tracking-tight mt-6"
            style={{ animation: "breathScale 4s infinite alternate ease-in-out" }}
          >
            SweetScene
          </h1>

          <p
            className="text-2xl font-light text-muted-strong italic mt-2"
            style={{ animation: "slowFade 2s ease-in-out forwards", animationDelay: "0.8s", opacity: 0 }}
          >
            Step into a scene. Start anonymous.
          </p>

          <p
            className="text-base text-muted max-w-lg mt-6 leading-relaxed"
            style={{ animation: "slowFade 2s ease-in-out forwards", animationDelay: "1.4s", opacity: 0 }}
          >
            No pictures. No names. Our AI pairs you on real shared interests. Total anonymity, zero judgment.
          </p>

          <div
            className="mt-10 flex flex-col items-center gap-3"
            style={{ animation: "slowFade 2s ease-in-out forwards", animationDelay: "2s", opacity: 0 }}
          >
            <Link
              href="/scenarios"
              onClick={() => playSound("matchSearch")}
              className="pulse-glow px-8 py-4 rounded-xl font-medium text-lg text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all duration-300 inline-flex items-center gap-2"
            >
              Join a Live Scene <span>&rarr;</span>
            </Link>
            <Link
              href="/explore"
              className="text-sm text-muted hover:text-foreground-dim mt-1 underline-offset-4 hover:underline transition-all"
            >
              Browse Characters
            </Link>
          </div>

          <p
            className="text-sm text-muted-faint mt-10 max-w-md"
            style={{ animation: "slowFade 2s ease-in-out forwards", animationDelay: "2.4s", opacity: 0 }}
          >
            Join 50,000+ people sharing scenes, prompts, and stories. No faces, no names, just vibes.
          </p>

          <p
            className="text-neon-green font-retro text-xs mt-4 neon-text"
            style={{ animation: "slowFade 2s ease-in-out forwards", animationDelay: "2.8s", opacity: 0 }}
          >
            {onlineCount.toLocaleString()} online right now
          </p>
        </div>
      </section>

      <section className="py-24 px-6 bg-void-900">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-light text-foreground-dim tracking-wide">
            Three steps to anonymous connection
          </h2>
          <p className="text-neon-magenta/60 uppercase tracking-[0.2em] text-xs mt-3">
            Don&apos;t just play scenes. BUILD them.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center hover:border-neon-magenta/40 transition-all duration-300"
              style={{ animation: "slowFade 2s ease-in-out forwards", animationDelay: `${0.2 + i * 0.2}s`, opacity: 0 }}
            >
              <span className="block text-4xl mb-4">{step.emoji}</span>
              <h3 className="text-lg text-foreground font-light mb-3">{step.title}</h3>
              <p className="text-sm text-muted-strong leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 px-6 bg-void-950">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-light text-foreground-dim tracking-wide">Step Into a Scene</h2>
          <p className="text-sm text-muted mt-3 max-w-xl mx-auto">
            Browse all available rooms and scenarios. Find scenes and matches that fit your vibe.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {SCENARIOS.map((s, i) => (
            <Link
              key={s.name}
              href="/scenarios"
              className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-neon-magenta/40 hover:bg-surface-raised transition-all duration-300"
              style={{ animation: "slowFade 2s ease-in-out forwards", animationDelay: `${0.1 + i * 0.1}s`, opacity: 0 }}
            >
              <span className="block text-3xl mb-3">{s.emoji}</span>
              <h3 className="text-lg text-foreground font-medium mb-2 group-hover:text-neon-magenta transition-colors">
                {s.name}
              </h3>
              <p className="text-sm text-muted-strong leading-relaxed">{s.desc}</p>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/scenarios" className="text-brand-lighter hover:text-neon-magenta underline-offset-4 hover:underline transition-all">
            View all scenarios &rarr;
          </Link>
        </div>
      </section>

      <section className="py-24 px-6 bg-void-900">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-light text-foreground-dim tracking-wide">Live Activity</h2>
          <p className="text-sm text-muted mt-3">Live activity by interest category</p>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          {ACTIVITY.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-4"
              style={{ animation: "slowFade 1.5s ease-in-out forwards", animationDelay: `${i * 0.1}s`, opacity: 0 }}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-green" />
              </span>
              <span className="text-sm text-muted-strong flex-1">{item.text}</span>
              <span className="text-xs text-muted-faint shrink-0">{item.time}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-faint mt-8">
          Live now: Late-Night Diner scene &mdash; <span className="text-neon-green">2,847 watching</span>
        </p>
      </section>

      <section className="py-24 px-6 bg-void-950">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-light text-foreground-dim tracking-wide">Unlock badges as you explore</h2>
          <p className="text-sm text-muted mt-3 max-w-xl mx-auto">
            Your scenes stay in the dark until you say otherwise.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {FEATURES.map((f, i) => (
            <Link
              key={f.title}
              href={f.href}
              className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:border-neon-magenta/40 hover:bg-surface-raised transition-all duration-300"
              style={{ animation: "slowFade 2s ease-in-out forwards", animationDelay: `${0.1 + i * 0.1}s`, opacity: 0 }}
            >
              <h3 className="font-retro text-sm text-neon-magenta mb-4 group-hover:neon-text transition-all">
                {f.title}
              </h3>
              <p className="text-sm text-muted-strong leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-24 px-6 bg-void-900">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-light text-foreground-dim text-center tracking-wide mb-12">Questions</h2>

          <div className="space-y-3">
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <span className="text-sm text-foreground-dim font-medium">{item.q}</span>
                    <span className={`text-neon-magenta transition-transform duration-300 ${open ? "rotate-45" : ""}`}>
                      +
                    </span>
                  </button>
                  {open && (
                    <p className="px-5 pb-4 text-sm text-muted-strong leading-relaxed">{item.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-void-950 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-4xl font-light text-foreground-dim mb-3">
            Ready to enter the fog?
          </h2>
          <p className="text-muted mb-8">Step into a scene. The blur drops only when you both say so.</p>
          <Link
            href="/login"
            className="pulse-glow inline-block px-10 py-4 rounded-xl font-medium text-lg text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all duration-300"
          >
            Get Started
          </Link>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-white/5 bg-void-900">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-lg text-brand font-medium">
            <span className="pulse-glow w-2 h-2 rounded-full bg-neon-magenta inline-block" />
            SweetScene
          </span>

          <div className="flex items-center gap-6">
            <Link href="/legal/privacy" className="text-xs text-muted-faint hover:text-muted-strong transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="text-xs text-muted-faint hover:text-muted-strong transition-colors">Terms</Link>
            <Link href="/pricing" className="text-xs text-muted-faint hover:text-muted-strong transition-colors">Pricing</Link>
            <Link href="/confessions" className="text-xs text-muted-faint hover:text-muted-strong transition-colors">Confessions</Link>
          </div>

          <span className="text-xs text-muted-faint">
            &copy; 2025 SweetScene. All scenes reserved.
          </span>
        </div>
      </footer>
    </main>
  );
}
