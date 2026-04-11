"use client"

import { useEffect, useState, createContext, useContext, useCallback } from "react"
import { usePathname } from "next/navigation"

const LoadingCtx = createContext<{ start: () => void; done: () => void }>({
  start: () => {},
  done: () => {},
})

export function useLoading() {
  return useContext(LoadingCtx)
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()

  // Hide spinner whenever route actually changes
  useEffect(() => {
    setVisible(false)
  }, [pathname])

  const start = useCallback(() => setVisible(true), [])
  const done  = useCallback(() => setVisible(false), [])

  return (
    <LoadingCtx.Provider value={{ start, done }}>
      {visible && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: "fadeInOverlay 0.15s ease",
        }}>
          <style>{`
            @keyframes fadeInOverlay { from{opacity:0} to{opacity:1} }
            @keyframes spinRing {
              0%   { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulseCenter {
              0%,100% { opacity:0.5; transform: scale(0.8); }
              50%      { opacity:1;   transform: scale(1); }
            }
          `}</style>

          {/* Spinner */}
          <div style={{ position: "relative", width: 52, height: 52 }}>
            {/* Outer ring */}
            <div style={{
              position: "absolute", inset: 0,
              borderRadius: "50%",
              border: "2.5px solid rgba(59,130,246,0.2)",
              borderTopColor: "#3b82f6",
              animation: "spinRing 0.75s linear infinite",
            }} />
            {/* Inner dot */}
            <div style={{
              position: "absolute",
              top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
              width: 10, height: 10,
              borderRadius: "50%",
              background: "#3b82f6",
              animation: "pulseCenter 0.75s ease-in-out infinite",
            }} />
          </div>
        </div>
      )}
      {children}
    </LoadingCtx.Provider>
  )
}