"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"

// ── Visitor counter hook ──────────────────────────────────────────────────
interface VisitorData {
  total: number
  today: number
}

function useVisitorCount() {
  const [data, setData] = useState<VisitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const hasCounted = useRef(false)

  useEffect(() => {
    if (hasCounted.current) return
    hasCounted.current = true
    const run = async () => {
      try {
        const alreadyCounted = sessionStorage.getItem("clarifai_counted")
        const res = alreadyCounted
          ? await fetch("/api/visitors")
          : await fetch("/api/visitors", { method: "POST" })
        if (!alreadyCounted) sessionStorage.setItem("clarifai_counted", "1")
        if (res.ok) setData(await res.json())
      } catch {}
      finally { setLoading(false) }
    }
    run()
  }, [])

  return { data, loading }
}

// ── Fade-in on scroll ─────────────────────────────────────────────────────
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1"
          el.style.transform = "translateY(0)"
          observer.disconnect()
        }
      },
      { threshold: 0.08 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(22px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ── Pulse dot ─────────────────────────────────────────────────────────────
function PulseDot({ color = "#3b82f6", size = 6 }: { color?: string; size?: number }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      background: color, borderRadius: "50%",
      animation: "cai-pulse 1.5s infinite", flexShrink: 0,
    }} />
  )
}

// ── Sun icon ──────────────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

// ── Moon icon ─────────────────────────────────────────────────────────────
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

// ── Features ──────────────────────────────────────────────────────────────
const FEATURES = [
  {
    bg: "rgba(37,99,235,0.2)", bgLight: "rgba(37,99,235,0.1)",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.6" fill="#60a5fa"/></svg>,
    title: "Source verification",
    desc: "Identifies the publisher and cross-checks it against a curated index of trusted local and international news outlets.",
  },
  {
    bg: "rgba(20,184,166,0.18)", bgLight: "rgba(20,184,166,0.1)",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    title: "Live fact-checking",
    desc: "Queries Google Fact Check and NewsAPI in real-time to match claims against verified databases.",
  },
  {
    bg: "rgba(217,119,6,0.18)", bgLight: "rgba(217,119,6,0.1)",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="#fbbf24"/></svg>,
    title: "Clickbait & sentiment",
    desc: "Detects sensationalist language, emotional manipulation, and writing patterns that signal low credibility.",
  },
  {
    bg: "rgba(225,29,72,0.18)", bgLight: "rgba(225,29,72,0.1)",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    title: "ML + AI ensemble",
    desc: "Combines a trained machine learning model with Groq LLaMA and GPT-4o mini for a weighted, reliable verdict.",
  },
]

// ── Verdicts ──────────────────────────────────────────────────────────────
const VERDICTS = [
  {
    label: "Credible", pct: "91%",
    style: { background: "rgba(16,185,129,0.15)", color: "#34d399", border: "0.5px solid rgba(16,185,129,0.3)" },
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    text: "Article from BBC News on climate policy — professional tone, multiple citations, verified source.",
  },
  {
    label: "Likely false", pct: "17%",
    style: { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "0.5px solid rgba(239,68,68,0.3)" },
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    text: "Viral Facebook post claiming a local official made an unverified statement — no citations, clickbait headline.",
  },
  {
    label: "Unverified", pct: "44%",
    style: { background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "0.5px solid rgba(245,158,11,0.3)" },
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>,
    text: "Opinion piece from an unknown blog — plausible content but no verifiable source or external confirmation.",
  },
]

// ── Main Page ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { data: visitorData, loading: visitorLoading } = useVisitorCount()
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem("clarifai_theme")
    if (saved) setDark(saved === "dark")
  }, [])

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev
      localStorage.setItem("clarifai_theme", next ? "dark" : "light")
      return next
    })
  }

  const totalDisplay = visitorLoading ? "..." : visitorData ? visitorData.total.toLocaleString() : "—"

  const t = {
    pageBg:        dark ? "#0f1623"                      : "#f8fafc",
    navBg:         dark ? "rgba(15,22,35,0.92)"          : "rgba(248,250,252,0.92)",
    navBorder:     dark ? "rgba(255,255,255,0.08)"       : "rgba(0,0,0,0.08)",
    text:          dark ? "#e2e8f0"                      : "#1e293b",
    textMuted:     dark ? "#94a3b8"                      : "#64748b",
    textDim:       dark ? "#64748b"                      : "#94a3b8",
    headingColor:  dark ? "#ffffff"                      : "#0f172a",
    badgeBg:       dark ? "rgba(37,99,235,0.15)"        : "rgba(37,99,235,0.08)",
    badgeBorder:   dark ? "rgba(37,99,235,0.4)"         : "rgba(37,99,235,0.25)",
    badgeText:     dark ? "#93c5fd"                      : "#1d4ed8",
    statsBg:       dark ? "rgba(255,255,255,0.04)"      : "rgba(0,0,0,0.04)",
    statsBorder:   dark ? "rgba(255,255,255,0.1)"       : "rgba(0,0,0,0.1)",
    statDivider:   dark ? "rgba(255,255,255,0.1)"       : "rgba(0,0,0,0.1)",
    cardBg:        dark ? "rgba(255,255,255,0.04)"      : "#ffffff",
    cardBorder:    dark ? "rgba(255,255,255,0.1)"       : "rgba(0,0,0,0.1)",
    cardHover:     dark ? "rgba(255,255,255,0.07)"      : "#f1f5f9",
    verdictBg:     dark ? "rgba(255,255,255,0.04)"      : "#ffffff",
    verdictBorder: dark ? "rgba(255,255,255,0.08)"      : "rgba(0,0,0,0.08)",
    ctaBorder:     dark ? "rgba(255,255,255,0.08)"      : "rgba(0,0,0,0.08)",
    footerBorder:  dark ? "rgba(255,255,255,0.06)"      : "rgba(0,0,0,0.06)",
    footerText:    dark ? "#475569"                      : "#94a3b8",
    toggleBg:      dark ? "rgba(255,255,255,0.08)"      : "rgba(0,0,0,0.07)",
    toggleColor:   dark ? "#94a3b8"                      : "#64748b",
  }

  return (
    <>
      <style>{`
        @keyframes cai-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .cai-feat-card { border-radius:12px; padding:1.25rem; transition:background 0.2s,border-color 0.2s; display:flex; flex-direction:column; height:100%; }
        .cai-verdict-row { display:flex; align-items:center; gap:14px; border-radius:10px; padding:1rem 1.25rem; margin-bottom:10px; transition:background 0.2s; }
        .cai-btn-blue { background:#2563eb; color:#fff; border:none; border-radius:9px; font-weight:500; cursor:pointer; display:inline-flex; align-items:center; gap:8px; text-decoration:none; transition:background 0.15s; font-family:inherit; }
        .cai-btn-blue:hover { background:#1d4ed8; }
        .cai-btn-outline { background:transparent; border-radius:9px; cursor:pointer; text-decoration:none; transition:background 0.15s; font-family:inherit; }
      `}</style>

      <div style={{ background: t.pageBg, color: t.text, minHeight: "100vh", fontFamily: "var(--font-sans,'Inter',system-ui,sans-serif)", transition: "background 0.3s,color 0.3s" }}>

        {/* ── Navbar ── */}
        <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem 2rem", borderBottom:`0.5px solid ${t.navBorder}`, position:"sticky", top:0, background:t.navBg, backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", zIndex:50, transition:"background 0.3s,border-color 0.3s" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, background:"#2563eb", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:t.headingColor, lineHeight:1 }}>ClarifAI</div>
              <div style={{ fontSize:11, color:t.textDim, marginTop:2 }}>News Credibility Analyzer</div>
            </div>
          </div>
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{ background:t.toggleBg, color:t.toggleColor, border:`0.5px solid ${t.statsBorder}`, borderRadius:8, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"background 0.2s" }}>
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
        </nav>

        {/* ── Hero ── */}
        <section style={{ textAlign:"center", padding:"5rem 1.5rem 3.5rem" }}>
          <FadeIn>
            <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:t.badgeBg, border:`0.5px solid ${t.badgeBorder}`, color:t.badgeText, fontSize:11, padding:"5px 14px", borderRadius:20, marginBottom:"1.5rem", letterSpacing:"0.05em", textTransform:"uppercase" as const }}>
              <PulseDot color="#3b82f6" size={6} />
              ClarifAI: News Credibility Analyzer
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 style={{ fontSize:"clamp(30px,5vw,46px)", fontWeight:700, color:t.headingColor, lineHeight:1.2, marginBottom:"1rem", letterSpacing:"-0.02em" }}>
              Don't guess the news — {" "}<em style={{ color:"#60a5fa", fontStyle:"normal" }}>ClarifAI</em> it
            </h1>
          </FadeIn>
          <FadeIn delay={180}>
            <p style={{ fontSize:15, color:t.textMuted, maxWidth:460, margin:"0 auto 2.5rem", lineHeight:1.75 }}>
              ClarifAI uses artificial intelligence to classify the credibility of news articles and URLs—detecting misinformation, evaluating sources, and delivering clear, reliable verdicts in seconds.
            </p>
          </FadeIn>
          <FadeIn delay={260}>
            <div style={{ display:"flex", justifyContent:"center", gap:12, flexWrap:"wrap" as const, marginBottom:"3.5rem" }}>
              {/* ✅ Naka-link sa /detector — dito pupunta kapag pinindot */}
              <Link href="/detector" className="cai-btn-blue" style={{ fontSize:14, padding:"11px 24px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Analyze an article
              </Link>
              <a href="#how-it-works" className="cai-btn-outline" style={{ fontSize:14, padding:"11px 24px", color:t.text, border:`0.5px solid ${t.statsBorder}` }}>
                See how it works
              </a>
            </div>
          </FadeIn>

        {/* Stats bar */}
        <FadeIn delay={340}>
          <div style={{ display:"flex", justifyContent:"center", background:t.statsBg, border:`0.5px solid ${t.statsBorder}`, borderRadius:14, padding:"1.5rem", maxWidth:580, margin:"0 auto", flexWrap:"wrap" as const, transition:"background 0.3s,border-color 0.3s" }}>
            {[
              { num: totalDisplay, label:"Total visitors", sub:"Active now", numColor:"#60a5fa" },
              { num:"Credible / False / Unverified", label:"Verdict types", sub:null, numColor:t.headingColor },
              { num:"Active AI Model", label:"AI engines", sub:null, numColor:t.headingColor },
              { num:"<5s", label:"Avg Response Time", sub:null, numColor:t.headingColor },
            ].map((s, i, arr) => (
              <div key={i} style={{ flex:"1 1 100px", textAlign:"center", padding:"0 1.25rem", borderRight: i < arr.length - 1 ? `0.5px solid ${t.statDivider}` : "none" }}>
                <div style={{ fontSize:26, fontWeight:600, color:s.numColor, lineHeight:1 }}>{s.num}</div>
                <div style={{ fontSize:11, color:t.textDim, marginTop:4, textTransform:"uppercase" as const, letterSpacing:"0.04em" }}>
                  {s.label}
                </div>
                {s.sub && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4, marginTop:3 }}>
                    <PulseDot color="#34d399" size={5} />
                    <span style={{ fontSize:10, color:"#34d399" }}>{s.sub}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </FadeIn>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" style={{ padding:"4rem 1.5rem", maxWidth:860, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ fontSize:11, color:"#60a5fa", letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:"0.75rem" }}>How it works</div>
            <h2 style={{ fontSize:"clamp(22px,3vw,28px)", fontWeight:600, color:t.headingColor, lineHeight:1.3, marginBottom:"0.75rem", letterSpacing:"-0.01em" }}>
              Multi-layer credibility<br />analysis, instantly
            </h2>
            <p style={{ fontSize:14, color:t.textMuted, maxWidth:440, lineHeight:1.75, marginBottom:"2rem" }}>
              Paste any news article or URL. ClarifAI cross-references multiple signals to give you a reliable verdict.
            </p>
          </FadeIn>

          {/* Grid — pantay ang lahat ng cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))", gap:14 }}>
            {FEATURES.map((f, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div
                  className="cai-feat-card"
                  style={{ background:t.cardBg, border:`0.5px solid ${t.cardBorder}`, transition:"background 0.3s,border-color 0.3s" }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = t.cardHover; el.style.borderColor = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.2)" }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = t.cardBg; el.style.borderColor = t.cardBorder }}
                >
                  <div style={{ width:36, height:36, borderRadius:8, background: dark ? f.bg : f.bgLight, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12, flexShrink:0 }}>
                    {f.icon}
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:t.headingColor, marginBottom:6 }}>{f.title}</div>
                  <div style={{ fontSize:12, color:t.textDim, lineHeight:1.65, flex:1 }}>{f.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* ── Sample verdicts ── */}
        <section style={{ padding:"0 1.5rem 4rem", maxWidth:860, margin:"0 auto" }}>
          <FadeIn>
            <div style={{ fontSize:11, color:"#60a5fa", letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:"0.75rem" }}>Sample verdicts</div>
            <h2 style={{ fontSize:"clamp(22px,3vw,28px)", fontWeight:600, color:t.headingColor, lineHeight:1.3, marginBottom:"1.5rem", letterSpacing:"-0.01em" }}>
              Three clear outcomes,<br />no ambiguity
            </h2>
          </FadeIn>
          {VERDICTS.map((v, i) => (
            <FadeIn key={i} delay={i * 80}>
              <div className="cai-verdict-row" style={{ background:t.verdictBg, border:`0.5px solid ${t.verdictBorder}`, transition:"background 0.3s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = t.cardHover }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = t.verdictBg }}>
                <span style={{ ...v.style, fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:6, whiteSpace:"nowrap" as const, display:"inline-flex", alignItems:"center", gap:5, flexShrink:0 }}>
                  {v.icon}{v.label}
                </span>
                <div style={{ flex:1, fontSize:13, color:t.textMuted, lineHeight:1.55 }}>{v.text}</div>
                <div style={{ fontSize:20, fontWeight:700, color:t.headingColor, flexShrink:0 }}>{v.pct}</div>
              </div>
            </FadeIn>
          ))}
        </section>

        {/* ── CTA ── */}
        <section style={{ textAlign:"center", padding:"4rem 1.5rem 3rem", borderTop:`0.5px solid ${t.ctaBorder}` }}>
          <FadeIn>
            <h2 style={{ fontSize:"clamp(22px,3vw,28px)", fontWeight:600, color:t.headingColor, marginBottom:"0.5rem", letterSpacing:"-0.01em" }}>
              Stop spreading misinformation.<br />Start with ClarifAI.
            </h2>
            <p style={{ fontSize:14, color:t.textDim, marginBottom:"2rem" }}>
              Free to use. No login required. Just paste the article or URL and get your answer in seconds.
            </p>
            {/* ✅ Naka-link din sa /detector */}
            <Link href="/detector" className="cai-btn-blue" style={{ fontSize:15, padding:"13px 32px" }}>
              Analyze now — it&apos;s free →
            </Link>
          </FadeIn>
        </section>

        {/* ── Footer ── */}
        <footer style={{ textAlign:"center", padding:"1.5rem", borderTop:`0.5px solid ${t.footerBorder}` }}>
          <p style={{ fontSize:12, color:t.footerText }}>
            © {new Date().getFullYear()} ClarifAI ·{" "}
            <span style={{ color:"#60a5fa" }}>John Aaron Tumangan</span>
            {" "}· All rights reserved.
          </p>
        </footer>
      </div>
    </>
  )
}