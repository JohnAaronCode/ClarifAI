"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function Navbar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isDetectorPage, setIsDetectorPage] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Show back arrow only on non-landing pages
    setIsDetectorPage(window.location.pathname !== "/")

    const saved = localStorage.getItem("clarifai_theme") ?? localStorage.getItem("theme")
    if (saved) setTheme(saved)

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "clarifai_theme" && e.newValue) setTheme(e.newValue)
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [setTheme])

  const isDark = theme === "dark"

  const handleToggle = () => {
    const next = isDark ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("clarifai_theme", next)
    localStorage.setItem("theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  return (
    <>
      <style>{`
        .cai-nav-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 0.5px solid;
          flex-shrink: 0;
        }
        .cai-nav-toggle:hover { transform: rotate(15deg); }

        .cai-nav-back {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          text-decoration: none;
          border: 0.5px solid;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .cai-nav-back:hover {
          transform: translateX(-2px);
        }

        .cai-nav-wordmark {
          font-size: 15px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.3px;
        }
        .cai-nav-subtitle {
          font-size: 10.5px;
          font-weight: 500;
          margin-top: 3px;
          letter-spacing: 0.01em;
        }
      `}</style>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.875rem 1.75rem",
          borderBottom: isDark ? "0.5px solid rgba(255,255,255,0.07)" : "0.5px solid rgba(0,0,0,0.08)",
          position: "sticky",
          top: 0,
          background: isDark ? "rgba(17,17,17,0.95)" : "rgba(248,250,252,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          zIndex: 50,
          transition: "background 0.3s, border-color 0.3s",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 34, height: 34,
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div>
            <div className="cai-nav-wordmark" style={{ color: isDark ? "#ffffff" : "#0f172a" }}>
              ClarifAI
            </div>
            <div className="cai-nav-subtitle" style={{ color: isDark ? "#888888" : "#64748b" }}>
              News Credibility Analyzer
            </div>
          </div>
        </Link>

        {/* Right side controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

          {/* Back arrow — only shown on detector/non-home pages */}
          {mounted && isDetectorPage && (
            <Link
              href="/"
              className="cai-nav-back"
              title="Back to Home"
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                color: isDark ? "#a0a0a0" : "#475569",
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
            </Link>
          )}

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={handleToggle}
              aria-label="Toggle theme"
              className="cai-nav-toggle"
              style={{
                background: isDark ? "#1f1f1f" : "rgba(0,0,0,0.06)",
                borderColor: isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.1)",
                color: isDark ? "#888" : "#64748b",
              }}
            >
              {isDark
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </button>
          )}
        </div>
      </nav>
    </>
  )
}