import { NextResponse } from "next/server";
import { getLangGraphClient } from "@/lib/langgraph";

export async function GET() {
  try {
    const client = getLangGraphClient();
    
    // Try to search for assistants to verify connection
    const assistants = await client.assistants.search();
    
    return NextResponse.json({
      status: "connected",
      assistants: assistants.map((a) => ({
        id: a.assistant_id,
        name: a.name,
        graphId: a.graph_id,
      })),
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Failed to connect to LangGraph",
      },
      { status: 500 }
    );
  }
}
