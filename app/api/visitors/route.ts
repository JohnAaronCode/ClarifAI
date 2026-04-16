import { NextResponse, NextRequest } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { randomUUID } from "crypto"

const DATA_FILE = path.join(process.cwd(), "data", "visitors.json")

interface VisitorData {
  total_visitors: number
  today_visitors: number
  total_analyses: number
  today_date: string
  updated_at: string
  daily_unique: Record<string, string[]> // date -> visitorIds
}

async function readData(): Promise<VisitorData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8")
    return JSON.parse(raw)
  } catch {
    return {
      total_visitors: 0,
      today_visitors: 0,
      total_analyses: 0,
      today_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
      daily_unique: {},
    }
  }
}

async function writeData(data: VisitorData) {
  await fs.mkdir(path.join(process.cwd(), "data"), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2))
}

function getVisitorId(req: NextRequest) {
  let visitorId = req.cookies.get("visitor_id")?.value

  if (!visitorId) {
    visitorId = randomUUID()
  }

  return visitorId
}

/* =========================
   GET → fetch stats
========================= */
export async function GET() {
  const data = await readData()
  return NextResponse.json(data)
}

/* =========================
   POST → VISIT TRACKING
========================= */
export async function POST(req: NextRequest) {
  const data = await readData()

  const today = new Date().toISOString().slice(0, 10)
  const visitorId = getVisitorId(req)

  // reset day if needed
  if (data.today_date !== today) {
    data.today_date = today
    data.today_visitors = 0
    data.daily_unique[today] = []
  }

  // ensure array exists
  if (!data.daily_unique[today]) {
    data.daily_unique[today] = []
  }

  const alreadyCountedToday = data.daily_unique[today].includes(visitorId)

  // ALWAYS count total visits
  data.total_visitors += 1

  // ONLY count unique daily visitor once
  if (!alreadyCountedToday) {
    data.daily_unique[today].push(visitorId)
    data.today_visitors += 1
  }

  data.updated_at = new Date().toISOString()

  const res = NextResponse.json(data)

  // set cookie (1 year expiry)
  res.cookies.set("visitor_id", visitorId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  await writeData(data)
  return res
}

/* =========================
   PATCH → ANALYSES COUNT
========================= */
export async function PATCH() {
  const data = await readData()

  data.total_analyses += 1
  data.updated_at = new Date().toISOString()

  await writeData(data)
  return NextResponse.json(data)
}