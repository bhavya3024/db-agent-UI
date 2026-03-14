import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLangGraphClient } from "@/lib/langgraph";

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

// GET - Fetch messages for a thread from LangGraph
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;

    if (!threadId) {
      return NextResponse.json({ error: "Thread ID is required" }, { status: 400 });
    }

    const client = getLangGraphClient();
    
    // Get thread state which contains messages
    const state = await client.threads.getState(threadId);
    
    if (!state || !state.values) {
      return NextResponse.json({ messages: [] });
    }

    // Extract messages from state
    const stateValues = state.values as Record<string, unknown>[] | Record<string, unknown>;
    const messages = Array.isArray(stateValues)
      ? stateValues.flatMap((val) => (val.messages as unknown[]) || [])
      : ((stateValues as Record<string, unknown>).messages as unknown[]) || [];
    
    // Format messages for the frontend
    const formattedMessages = messages.map((msg) => {
      const { type, content } = msg as { type: string; content: unknown };
      return {
        role: type === "human" ? "human" : "assistant",
        content: typeof content === "string" ? content : JSON.stringify(content),
      };
    });

    return NextResponse.json({ messages: formattedMessages });
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    // Return empty messages if thread not found (might be in-memory only)
    return NextResponse.json({ messages: [] });
  }
}
