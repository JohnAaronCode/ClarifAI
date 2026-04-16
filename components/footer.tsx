"use client"

import { ShieldCheck } from "lucide-react"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
        .cai-footer { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <footer className="cai-footer mt-16 py-7">
        <div
          className="max-w-3xl mx-auto px-4"
          style={{
            borderTop: "0.5px solid",
            borderColor: "rgba(148,163,184,0.15)",
            paddingTop: "1.5rem",
          }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">

            {/* Left: branding */}
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  background: "linear-gradient(135deg, #0d9488, #0f766e)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                © {currentYear} ClarifAI
              </span>
            </div>

            {/* Center: powered by */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <ShieldCheck style={{ width: 12, height: 12 }} className="text-teal-500" />
              AI-powered credibility analysis
            </div>

            {/* Right: developer */}
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Developed by{" "}
              <a
                href="https://github.com/johnaaron"
                className="font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                style={{ textDecoration: "none" }}
              >
                John Aaron Tumangan
              </a>
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}