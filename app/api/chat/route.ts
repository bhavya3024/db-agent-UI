import { NextRequest, NextResponse } from "next/server";
import { getLangGraphClient, getGraphName } from "@/lib/langgraph";

export async function POST(request: NextRequest) {
  try {
    const { message, threadId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const client = getLangGraphClient();
    const graphName = getGraphName();

    // Create or use existing thread
    let thread;
    if (threadId) {
      thread = { thread_id: threadId };
    } else {
      thread = await client.threads.create();
    }

    // Create a run with the message
    const input = {
      messages: [{ role: "human", content: message }],
    };

    // Stream the response
    const streamResponse = client.runs.stream(thread.thread_id, graphName, {
      input,
      streamMode: "messages",
    });

    // Collect the streamed response
    const messages: string[] = [];
    
    for await (const chunk of streamResponse) {
      if (chunk.event === "messages/partial") {
        // Get the latest message content
        const data = chunk.data as Array<{ content?: string; type?: string }>;
        if (data && data.length > 0) {
          const lastMessage = data[data.length - 1];
          if (lastMessage.content && lastMessage.type === "ai") {
            messages.push(lastMessage.content);
          }
        }
      }
    }

    // Get the final state to extract the complete response
    const state = await client.threads.getState(thread.thread_id);
    const stateMessages = state.values?.messages || [];
    const lastAiMessage = stateMessages
      .filter((m: { type?: string }) => m.type === "ai")
      .pop();

    return NextResponse.json({
      threadId: thread.thread_id,
      response: lastAiMessage?.content || messages.join("") || "No response generated",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process message" },
      { status: 500 }
    );
  }
}
