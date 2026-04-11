import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const DATA_FILE = path.join(process.cwd(), "data", "visitors.json")

interface VisitorData {
  total_visitors: number
  total_analyses: number
  today: number
  today_date: string
  updated_at: string
}

async function readData(): Promise<VisitorData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (typeof parsed.total === "number" && typeof parsed.total_visitors === "undefined") {
      parsed.total_visitors = parsed.total
      parsed.total_analyses = 0
      delete parsed.total
    }
    return parsed
  } catch {
    return {
      total_visitors: 0,
      total_analyses: 0,
      today: 0,
      today_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }
  }
}

async function writeData(data: VisitorData): Promise<void> {
  await fs.mkdir(path.join(process.cwd(), "data"), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8")
}

export async function GET() {
  const data = await readData()
  return NextResponse.json(data)
}

export async function POST() {
  const data = await readData()
  const today = new Date().toISOString().slice(0, 10)
  if (data.today_date !== today) { data.today = 0; data.today_date = today }
  data.total_visitors += 1
  data.today += 1
  data.updated_at = new Date().toISOString()
  await writeData(data)
  return NextResponse.json(data)
}

export async function PATCH() {
  const data = await readData()
  data.total_analyses += 1
  data.updated_at = new Date().toISOString()
  await writeData(data)
  return NextResponse.json(data)
}