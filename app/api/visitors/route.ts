import { NextResponse, NextRequest } from "next/server"
import { Redis } from "@upstash/redis"
import { randomUUID } from "crypto"

const redis = Redis.fromEnv()

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const KEYS = {
  totalVisitors:  "clarifai:total_visitors",
  totalAnalyses:  "clarifai:total_analyses",
  todayVisitors:  "clarifai:today_visitors",
  todayDate:      "clarifai:today_date",
  sessions:       "clarifai:sessions", // Redis hash — sessionId -> lastActive timestamp
}

// Get today's date in Philippine Time (UTC+8)
function getTodayPH(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// ── GET — return current counts ───────────────────────────────────────────
export async function GET() {
  try {
    const [totalVisitors, totalAnalyses, todayVisitors, storedDate] = await Promise.all([
      redis.get<number>(KEYS.totalVisitors),
      redis.get<number>(KEYS.totalAnalyses),
      redis.get<number>(KEYS.todayVisitors),
      redis.get<string>(KEYS.todayDate),
    ])

    const today = getTodayPH()

    return NextResponse.json({
      total_visitors: totalVisitors ?? 0,
      today:          storedDate === today ? (todayVisitors ?? 0) : 0,
      total_analyses: totalAnalyses ?? 0,
      today_date:     today,
    })
  } catch (err) {
    console.error("[visitors GET] Redis error:", err)
    return NextResponse.json(
      { total_visitors: 0, today: 0, total_analyses: 0, today_date: getTodayPH() },
      { status: 200 } // still return 200 so frontend doesn't break
    )
  }
}

// ── POST — register a new page visit ─────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const today = getTodayPH()
    const now   = Date.now()

    // Reset today's counter if it's a new day
    const storedDate = await redis.get<string>(KEYS.todayDate)
    if (storedDate !== today) {
      await Promise.all([
        redis.set(KEYS.todayDate, today),
        redis.set(KEYS.todayVisitors, 0),
      ])
    }

    // Resolve session ID from cookie
    const existingId = req.cookies.get("session_id")?.value
    const sessionId  = existingId && existingId.length > 10 ? existingId : randomUUID()

    // Check if session exists and is still active
    const lastActiveRaw = await redis.hget<number>(KEYS.sessions, sessionId)
    const lastActive    = lastActiveRaw ? Number(lastActiveRaw) : null
    const isNewSession  = !lastActive || (now - lastActive >= SESSION_TIMEOUT_MS)

    if (isNewSession) {
      // New or expired session — count as a new visit
      await Promise.all([
        redis.hset(KEYS.sessions, { [sessionId]: now }),
        redis.incr(KEYS.totalVisitors),
        redis.incr(KEYS.todayVisitors),
      ])
    } else {
      // Active session — just refresh the timestamp
      await redis.hset(KEYS.sessions, { [sessionId]: now })
    }

    // Prune expired sessions every ~20 requests to keep the hash lean
    if (Math.random() < 0.05) {
      pruneExpiredSessions().catch(() => {}) // fire and forget
    }

    const [totalVisitors, totalAnalyses, todayVisitors] = await Promise.all([
      redis.get<number>(KEYS.totalVisitors),
      redis.get<number>(KEYS.totalAnalyses),
      redis.get<number>(KEYS.todayVisitors),
    ])

    const res = NextResponse.json({
      total_visitors: totalVisitors ?? 0,
      today:          todayVisitors ?? 0,
      total_analyses: totalAnalyses ?? 0,
      today_date:     today,
    })

    // Set session cookie — 1 day TTL
    res.cookies.set("session_id", sessionId, {
      httpOnly: true,
      path:     "/",
      maxAge:   60 * 60 * 24,
      sameSite: "lax",
    })

    return res
  } catch (err) {
    console.error("[visitors POST] Redis error:", err)
    return NextResponse.json(
      { total_visitors: 0, today: 0, total_analyses: 0, today_date: getTodayPH() },
      { status: 200 }
    )
  }
}

// ── PATCH — increment total analyses count ────────────────────────────────
export async function PATCH() {
  try {
    const total = await redis.incr(KEYS.totalAnalyses)
    return NextResponse.json({ total_analyses: total })
  } catch (err) {
    console.error("[visitors PATCH] Redis error:", err)
    return NextResponse.json({ total_analyses: 0 }, { status: 200 })
  }
}

// ── Background: prune expired sessions from the hash ─────────────────────
async function pruneExpiredSessions() {
  try {
    const all = await redis.hgetall<Record<string, number>>(KEYS.sessions)
    if (!all) return
    const now     = Date.now()
    const expired = Object.entries(all)
      .filter(([, ts]) => now - Number(ts) >= SESSION_TIMEOUT_MS)
      .map(([id]) => id)
    if (expired.length > 0) {
      await redis.hdel(KEYS.sessions, ...expired)
      console.log(`[visitors] Pruned ${expired.length} expired sessions`)
    }
  } catch (err) {
    console.warn("[visitors] Prune error:", err)
  }
}