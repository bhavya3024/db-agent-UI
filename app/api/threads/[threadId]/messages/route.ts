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
    const messages = Array.isArray(state.values) 
      ? state.values.flatMap((val: any) => val.messages || [])
      : (state.values as any).messages || [];
    
    // Format messages for the frontend
    const formattedMessages = messages.map((msg: { type: string; content: string }) => ({
      role: msg.type === "human" ? "human" : "assistant",
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    // Return empty messages if thread not found (might be in-memory only)
    return NextResponse.json({ messages: [] });
  }
}
