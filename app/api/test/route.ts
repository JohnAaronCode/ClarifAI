import { NextResponse } from "next/server";
import { ensembleAnalysis } from "@/lib/ml-utils";

export async function GET() {
  
const testText = "The DOH reported 1,200 dengue cases this week.";
const hfKey = process.env.HF_API_KEY || "";
const openaiKey = process.env.OPENAI_API_KEY || "";

const result = await ensembleAnalysis(testText, hfKey, openaiKey);
console.log("=== BACKEND TEST RESULT ===");
console.log(result);

  return NextResponse.json({ ok: true, result });
}
