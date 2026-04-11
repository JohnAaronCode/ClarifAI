"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useLoading } from "@/components/loading-provider"

interface VisitorData {
  total_visitors: number
  total_analyses: number
  today: number
  today_date: string
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

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.style.opacity = "1"
        el.style.transform = "translateY(0)"
        observer.disconnect()
      }
    }, { threshold: 0.08 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ opacity: 0, transform: "translateY(22px)", transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

const IconSource = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
)
const IconClaim = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><polyline points="8 11 10 13 14 9" />
  </svg>
)
const IconBias = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
  </svg>
)
const IconAI = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z" />
  </svg>
)

const FEATURES = [
  { bg: "rgba(37,99,235,0.2)", bgLight: "rgba(37,99,235,0.1)", icon: <IconSource />, glowDark: "rgba(59,130,246,0.3)", glowLight: "rgba(59,130,246,0.15)", title: "Source & Publisher Assessment", desc: "Identifies the origin of the content and evaluates the publisher's credibility using a curated index of trusted local and international news organizations." },
  { bg: "rgba(20,184,166,0.18)", bgLight: "rgba(20,184,166,0.1)", icon: <IconClaim />, glowDark: "rgba(45,212,191,0.3)", glowLight: "rgba(45,212,191,0.15)", title: "Claim & Evidence Validation", desc: "Extracts key claims from the article and cross-references them with trusted fact-checking databases and authoritative news sources to assess factual consistency." },
  { bg: "rgba(217,119,6,0.18)", bgLight: "rgba(217,119,6,0.1)", icon: <IconBias />, glowDark: "rgba(251,191,36,0.3)", glowLight: "rgba(251,191,36,0.15)", title: "Linguistic & Bias Analysis", desc: "Examines tone, writing style, and language patterns to detect signs of sensationalism, emotional manipulation, and bias commonly associated with low-credibility content." },
  { bg: "rgba(225,29,72,0.18)", bgLight: "rgba(225,29,72,0.1)", icon: <IconAI />, glowDark: "rgba(244,63,94,0.3)", glowLight: "rgba(244,63,94,0.15)", title: "AI-Driven Credibility Scoring", desc: "Combines a trained machine learning model with external APIs and advanced language model analysis to produce a weighted, multi-signal credibility assessment." },
]

const VERDICTS = [
  { label: "Credible", style: { background: "rgba(16,185,129,0.15)", color: "#34d399", border: "0.5px solid rgba(16,185,129,0.3)" }, glowDark: "rgba(16,185,129,0.25)", glowLight: "rgba(16,185,129,0.15)", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>, text: "Reliable source with factual, neutral reporting supported by verifiable evidence." },
  { label: "Likely false", style: { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "0.5px solid rgba(239,68,68,0.3)" }, glowDark: "rgba(239,68,68,0.25)", glowLight: "rgba(239,68,68,0.15)", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>, text: "Conflicts with verified data and shows patterns commonly linked to misinformation." },
  { label: "Unverified", style: { background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "0.5px solid rgba(245,158,11,0.3)" }, glowDark: "rgba(245,158,11,0.25)", glowLight: "rgba(245,158,11,0.15)", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>, text: "Insufficient evidence available; requires further verification from trusted sources." },
]

function getTokens(dark: boolean) {
  return {
    pageBg:       dark ? "#111111"                   : "#f8fafc",
    navBg:        dark ? "rgba(17,17,17,0.95)"        : "rgba(248,250,252,0.95)",
    navBorder:    dark ? "rgba(255,255,255,0.07)"     : "rgba(0,0,0,0.08)",
    text:         dark ? "#e5e5e5"                   : "#1e293b",
    textMuted:    dark ? "#a0a0a0"                   : "#64748b",
    textDim:      dark ? "#6b6b6b"                   : "#94a3b8",
    headingColor: dark ? "#ffffff"                   : "#0f172a",
    statsBorder:  dark ? "rgba(255,255,255,0.09)"    : "rgba(0,0,0,0.1)",
    cardBg:       dark ? "#1a1a1a"                   : "#ffffff",
    cardBorder:   dark ? "rgba(255,255,255,0.08)"    : "rgba(0,0,0,0.08)",
    verdictBg:    dark ? "#1a1a1a"                   : "#ffffff",
    verdictBorder:dark ? "rgba(255,255,255,0.08)"    : "rgba(0,0,0,0.08)",
    footerBorder: dark ? "rgba(255,255,255,0.06)"    : "rgba(0,0,0,0.06)",
    footerText:   dark ? "#4a4a4a"                   : "#94a3b8",
    toggleBg:     dark ? "#1f1f1f"                   : "rgba(0,0,0,0.06)",
    toggleColor:  dark ? "#888888"                   : "#64748b",
  }
}

// Stat card accent configs
const STAT_CONFIG = [
  { key: "total_visitors", label: "Total Visitors",      accent: "#22c55e",  glowColor: "rgba(34,197,94,0.2)",  borderColor: "rgba(34,197,94,0.25)"  },
  { key: "today",          label: "Today's Visitors",    accent: "#3b82f6",  glowColor: "rgba(59,130,246,0.2)", borderColor: "rgba(59,130,246,0.25)" },
  { key: "total_analyses", label: "Analyses Completed",  accent: "#a78bfa",  glowColor: "rgba(167,139,250,0.2)",borderColor: "rgba(167,139,250,0.25)"},
]

export default function LandingPage() {
  const { data: visitorData, loading: visitorLoading } = useVisitorCount()
  const [dark, setDark] = useState(true)
  const { start } = useLoading()

  useEffect(() => {
    document.title = "ClarifAI — News Credibility Analyzer"
    const saved = localStorage.getItem("theme") ?? localStorage.getItem("clarifai_theme")
    if (saved) setDark(saved === "dark")
  }, [])

  const toggleTheme = () => {
    setDark(prev => {
      const next = !prev
      const val = next ? "dark" : "light"
      localStorage.setItem("clarifai_theme", val)
      localStorage.setItem("theme", val)
      document.documentElement.classList.toggle("dark", next)
      window.dispatchEvent(new StorageEvent("storage", { key: "clarifai_theme", newValue: val }))
      return next
    })
  }

  const getStatValue = (key: string) => {
    if (visitorLoading) return "..."
    if (!visitorData) return "—"
    return (visitorData as any)[key]?.toLocaleString() ?? "—"
  }

  const t = getTokens(dark)

  return (
    <>
      <style>{`
        @keyframes cai-gradient { 0%{background-position:0% center} 100%{background-position:200% center} }
        @keyframes cai-orb-1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-40px) scale(1.1)} 66%{transform:translate(-30px,30px) scale(0.95)} }
        @keyframes cai-orb-2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,60px) scale(1.05)} 66%{transform:translate(40px,-20px) scale(1.1)} }
        @keyframes cai-orb-3 { 0%,100%{transform:translate(0,0) scale(1.05)} 50%{transform:translate(30px,50px) scale(0.95)} }
        @keyframes cai-orb-4 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-40px,-30px) scale(1.08)} 70%{transform:translate(25px,20px) scale(0.92)} }
        @keyframes cai-orb-5 { 0%,100%{transform:translate(0,0) scale(0.95)} 50%{transform:translate(-20px,40px) scale(1.1)} }

        .cai-heading-gradient {
          background: linear-gradient(90deg, #ffffff 0%, #93c5fd 40%, #ffffff 80%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: cai-gradient 5s linear infinite;
        }
        .cai-heading-gradient-light {
          background: linear-gradient(90deg, #0f172a 0%, #2563eb 40%, #0f172a 80%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: cai-gradient 5s linear infinite;
        }

        .cai-feat-card {
          border-radius: 14px; padding: 1.4rem;
          display: flex; flex-direction: column; height: 100%;
          transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
          cursor: pointer; position: relative; overflow: hidden;
        }
        .cai-verdict-row {
          display: flex; align-items: flex-start; gap: 14px;
          border-radius: 12px; padding: 1.1rem 1.25rem; margin-bottom: 10px;
          transition: all 0.3s cubic-bezier(0.4,0,0.2,1); cursor: pointer;
        }
        .cai-stat-card {
          transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
          cursor: default;
        }
        .cai-stat-card:hover { transform: translateY(-6px); }

        .cai-btn-primary {
          background: #2563eb; color: #fff; border: none; border-radius: 10px;
          font-weight: 600; cursor: pointer;
          display: inline-flex; align-items: center; gap: 8px;
          text-decoration: none; font-family: inherit; letter-spacing: -0.01em;
          transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
          position: relative; overflow: hidden;
        }
        .cai-btn-primary::after { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.15),transparent); opacity:0; transition:opacity 0.25s ease; }
        .cai-btn-primary:hover { background:#1d4ed8; transform:translateY(-3px) scale(1.02); box-shadow:0 0 20px rgba(59,130,246,0.5),0 8px 24px rgba(37,99,235,0.4); }
        .cai-btn-primary:hover::after { opacity:1; }
        .cai-btn-primary:hover svg { transform:translateX(2px); }
        .cai-btn-primary svg { transition:transform 0.2s ease; }
        .cai-btn-primary:active { transform:scale(0.98); }

        .cai-btn-ghost { background:transparent; border-radius:10px; cursor:pointer; text-decoration:none; font-family:inherit; font-weight:500; transition:all 0.25s cubic-bezier(0.4,0,0.2,1); }
        .cai-btn-ghost:hover { background:rgba(128,128,128,0.1); transform:translateY(-2px); }

        .cai-toggle-btn { display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s ease; border-radius:8px; width:34px; height:34px; }
        .cai-toggle-btn:hover { background:rgba(128,128,128,0.15) !important; transform:rotate(15deg); }
      `}</style>

      <div style={{ background: t.pageBg, color: t.text, minHeight: "100vh", fontFamily: "var(--font-sans,'Inter',system-ui,sans-serif)", transition: "background 0.3s,color 0.3s", position: "relative", overflow: "hidden" }}>

        {/* ── Floating orbs only — no grid ── */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          <div style={{ position:"absolute", top:"-12%", left:"-6%", width:560, height:560, borderRadius:"50%", background: dark ? "radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 68%)" : "radial-gradient(circle, rgba(37,99,235,0.09) 0%, transparent 68%)", animation:"cai-orb-1 20s ease-in-out infinite", filter:"blur(2px)" }} />
          <div style={{ position:"absolute", top:"-6%", right:"-10%", width:480, height:480, borderRadius:"50%", background: dark ? "radial-gradient(circle, rgba(6,182,212,0.16) 0%, transparent 68%)" : "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 68%)", animation:"cai-orb-2 25s ease-in-out infinite", filter:"blur(2px)" }} />
          <div style={{ position:"absolute", bottom:"8%", left:"25%", width:420, height:420, borderRadius:"50%", background: dark ? "radial-gradient(circle, rgba(59,130,246,0.13) 0%, transparent 68%)" : "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 68%)", animation:"cai-orb-3 30s ease-in-out infinite", filter:"blur(2px)" }} />
          <div style={{ position:"absolute", top:"40%", right:"5%", width:320, height:320, borderRadius:"50%", background: dark ? "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 68%)" : "radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 68%)", animation:"cai-orb-4 22s ease-in-out infinite", filter:"blur(2px)" }} />
          <div style={{ position:"absolute", bottom:"20%", left:"5%", width:280, height:280, borderRadius:"50%", background: dark ? "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 68%)" : "radial-gradient(circle, rgba(34,197,94,0.04) 0%, transparent 68%)", animation:"cai-orb-5 28s ease-in-out infinite", filter:"blur(2px)" }} />
          {dark && <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)" }} />}
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ── Navbar ── */}
          <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem 2rem", borderBottom:`0.5px solid ${t.navBorder}`, position:"sticky", top:0, background:t.navBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", zIndex:50, transition:"background 0.3s" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:34, height:34, background:"linear-gradient(135deg,#2563eb,#1d4ed8)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 8px rgba(37,99,235,0.35)" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:t.headingColor, lineHeight:1, letterSpacing:"-0.3px" }}>ClarifAI</div>
                <div style={{ fontSize:10.5, fontWeight:500, color:t.textDim, marginTop:3 }}>News Credibility Analyzer</div>
              </div>
            </div>
            <button onClick={toggleTheme} aria-label="Toggle theme" className="cai-toggle-btn" style={{ background:t.toggleBg, color:t.toggleColor, border:`0.5px solid ${t.statsBorder}` }}>
              {dark
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </button>
          </nav>

          {/* ── Hero ── */}
          <section style={{ textAlign:"center", padding:"6rem 1.5rem 3.5rem" }}>
            <FadeIn>
              <h1 className={dark ? "cai-heading-gradient" : "cai-heading-gradient-light"}
                style={{ fontSize:"clamp(36px,6vw,58px)", fontWeight:800, lineHeight:1.15, marginBottom:"1.25rem", letterSpacing:"-0.03em" }}>
                Don&apos;t guess the news —{" "}ClarifAI it
              </h1>
            </FadeIn>
            <FadeIn delay={120}>
              <p style={{ fontSize:16, color:t.textMuted, maxWidth:500, margin:"0 auto 2.5rem", lineHeight:1.75 }}>
                ClarifAI uses artificial intelligence to classify the credibility of news articles and URLs — detecting misinformation, evaluating sources, and delivering clear, reliable verdicts in seconds.
              </p>
            </FadeIn>

            {/* ── 3 Stat cards ── */}
            <FadeIn delay={200}>
              <div style={{ display:"flex", justifyContent:"center", gap:14, flexWrap:"wrap", marginBottom:"3rem" }}>
                {STAT_CONFIG.map(cfg => (
                  <div key={cfg.key} className="cai-stat-card"
                    style={{
                      display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                      padding:"20px 28px", borderRadius:12,
                      background: t.cardBg,
                      border:`0.5px solid ${cfg.borderColor}`,
                      minWidth: 150,
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 40px ${cfg.glowColor}`}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
                  >
                    <div style={{ fontSize:24, fontWeight:800, color:cfg.accent, lineHeight:1 }}>
                      {getStatValue(cfg.key)}
                    </div>
                    <div style={{ fontSize:12, color:t.textMuted, textAlign:"center" }}>{cfg.label}</div>
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={280}>
              <div style={{ display:"flex", justifyContent:"center", gap:12, flexWrap:"wrap" as const }}>
                <Link href="/detector" className="cai-btn-primary" style={{ fontSize:15, padding:"13px 28px" }}
                  onClick={start}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Start Detecting Now
                </Link>
                <a href="#how-it-works" className="cai-btn-ghost" style={{ fontSize:15, padding:"13px 28px", color:t.text, border:`0.5px solid ${t.statsBorder}` }}>
                  See how it works
                </a>
              </div>
            </FadeIn>
          </section>

          {/* ── How it works ── */}
          <section id="how-it-works" style={{ padding:"4rem 1.5rem", maxWidth:920, margin:"0 auto" }}>
            <FadeIn>
              <div style={{ fontSize:11, color:"#3b82f6", letterSpacing:"0.09em", textTransform:"uppercase" as const, marginBottom:"0.75rem", fontWeight:600 }}>How it works</div>
              <h2 className={dark ? "cai-heading-gradient" : "cai-heading-gradient-light"}
                style={{ fontSize:"clamp(22px,3vw,30px)", fontWeight:700, lineHeight:1.25, marginBottom:"0.75rem", letterSpacing:"-0.02em" }}>
                Intelligent credibility analysis,<br />powered by AI
              </h2>
              <p style={{ fontSize:14, color:t.textMuted, maxWidth:480, lineHeight:1.8, marginBottom:"2rem" }}>
                Submit any news article or URL. ClarifAI evaluates multiple credibility signals in parallel and delivers a structured, evidence-based verdict within seconds.
              </p>
            </FadeIn>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:14 }}>
              {FEATURES.map((f, i) => (
                <FadeIn key={i} delay={i * 80}>
                  <div className="cai-feat-card" style={{ background:t.cardBg, border:`0.5px solid ${t.cardBorder}` }}
                    onMouseEnter={e => { const el=e.currentTarget as HTMLDivElement; el.style.transform="translateY(-8px) scale(1.02)"; el.style.borderColor=dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.15)"; el.style.boxShadow=`0 20px 48px ${dark?f.glowDark:f.glowLight}`; el.style.background=dark?"#202020":"#f8faff" }}
                    onMouseLeave={e => { const el=e.currentTarget as HTMLDivElement; el.style.transform="translateY(0) scale(1)"; el.style.borderColor=t.cardBorder; el.style.boxShadow="none"; el.style.background=t.cardBg }}>
                    <div style={{ width:38, height:38, borderRadius:9, background:dark?f.bg:f.bgLight, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14, flexShrink:0 }}>{f.icon}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:t.headingColor, marginBottom:7, lineHeight:1.3 }}>{f.title}</div>
                    <div style={{ fontSize:12, color:t.textDim, lineHeight:1.7, flex:1 }}>{f.desc}</div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </section>

          {/* ── Verdicts ── */}
          <section style={{ padding:"0 1.5rem 4rem", maxWidth:920, margin:"0 auto" }}>
            <FadeIn>
              <div style={{ fontSize:11, color:"#3b82f6", letterSpacing:"0.09em", textTransform:"uppercase" as const, marginBottom:"0.75rem", fontWeight:600 }}>Classification outcomes</div>
              <h2 className={dark ? "cai-heading-gradient" : "cai-heading-gradient-light"}
                style={{ fontSize:"clamp(22px,3vw,30px)", fontWeight:700, lineHeight:1.25, marginBottom:"0.75rem", letterSpacing:"-0.02em" }}>
                Three possible outcomes,<br />clear explanations
              </h2>
              <p style={{ fontSize:14, color:t.textMuted, maxWidth:520, lineHeight:1.8, marginBottom:"2rem" }}>
                Every analysis returns one of three defined verdicts supported by detected signals and validation results.
              </p>
            </FadeIn>
            {VERDICTS.map((v, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="cai-verdict-row" style={{ background:t.verdictBg, border:`0.5px solid ${t.verdictBorder}` }}
                  onMouseEnter={e => { const el=e.currentTarget as HTMLDivElement; el.style.transform="translateY(-4px) scale(1.01)"; el.style.borderColor=dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.15)"; el.style.boxShadow=`0 16px 40px ${dark?v.glowDark:v.glowLight}`; el.style.background=dark?"#202020":"#f8faff" }}
                  onMouseLeave={e => { const el=e.currentTarget as HTMLDivElement; el.style.transform="translateY(0) scale(1)"; el.style.borderColor=t.verdictBorder; el.style.boxShadow="none"; el.style.background=t.verdictBg }}>
                  <span style={{ ...v.style, fontSize:11, fontWeight:600, padding:"4px 11px", borderRadius:6, whiteSpace:"nowrap" as const, display:"inline-flex", alignItems:"center", gap:5, flexShrink:0, marginTop:1 }}>
                    {v.icon}{v.label}
                  </span>
                  <div style={{ flex:1, fontSize:13, color:t.textMuted, lineHeight:1.65 }}>{v.text}</div>
                </div>
              </FadeIn>
            ))}
          </section>

          {/* ── CTA ── */}
          <section style={{ padding:"0 1.5rem 5rem", maxWidth:920, margin:"0 auto", textAlign:"center" }}>
            <FadeIn>
              <div style={{ fontSize:11, color:"#3b82f6", letterSpacing:"0.09em", textTransform:"uppercase" as const, marginBottom:"1rem", fontWeight:600 }}>Get started</div>
              <h2 className={dark ? "cai-heading-gradient" : "cai-heading-gradient-light"}
                style={{ fontSize:"clamp(22px,3vw,30px)", fontWeight:700, marginBottom:"0.75rem", letterSpacing:"-0.02em", lineHeight:1.25 }}>
                Make informed decisions.<br />Verify with ClarifAI.
              </h2>
              <p style={{ fontSize:14, color:t.textMuted, marginBottom:"2rem", maxWidth:420, margin:"0 auto 2rem", lineHeight:1.75 }}>
                Free to use. No login required. Simply paste a news article or URL and receive a structured credibility assessment within seconds.
              </p>
              <Link href="/detector" className="cai-btn-primary" style={{ fontSize:15, padding:"13px 32px" }} onClick={start}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Try ClarifAI Now
              </Link>
            </FadeIn>
          </section>

          <footer style={{ textAlign:"center", padding:"1.5rem", borderTop:`0.5px solid ${t.footerBorder}` }}>
            <p style={{ fontSize:12, color:t.footerText }}>
              © {new Date().getFullYear()} ClarifAI ·{" "}
              <span style={{ color:"#3b82f6" }}>John Aaron Tumangan</span>
              {" "}· All rights reserved.
            </p>
          </footer>
        </div>
      </div>
    </>
  )
}