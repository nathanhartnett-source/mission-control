import { NextResponse } from "next/server";
import {
  getCurrentModel,
  getSessionInfo,
  getTokenEstimate,
  getOpenClawVersion,
  getAgentStatuses,
  getPersonTodoModules,
  getBusinessModule,
} from "@/lib/openclaw-reader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function quadrantLegend() {
  return {
    Q1: 'Important + Urgent — Do now',
    Q2: 'Important + Not urgent — Plan & protect',
    Q3: 'Not important + Urgent — Delegate',
    Q4: 'Not important + Not urgent — Drop or automate',
  };
}

export async function GET() {
  try {
    const currentModel = getCurrentModel();
    const session = getSessionInfo();
    const tokenEstimate = getTokenEstimate();
    const openclawVersion = getOpenClawVersion();
    const agents = getAgentStatuses();
    const people = getPersonTodoModules();
    const business = getBusinessModule();
    const legend = quadrantLegend();

    return NextResponse.json({
      currentModel,
      session,
      tokenEstimate,
      openclawVersion,
      agents,
      people,
      business,
      legend,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Status API error:", err);
    return NextResponse.json({ error: "Failed to read status" }, { status: 500 });
  }
}
