import { NextRequest, NextResponse } from "next/server";
import { getLangGraphClient, getGraphName } from "@/lib/langgraph";
import { auth } from "@/auth";
import dbConnect from "@/lib/mongoose";
import DatabaseConnection from "@/models/DatabaseConnection";
import mongoose from "mongoose";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, threadId, connectionId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!connectionId) {
      return NextResponse.json(
        { error: "Connection ID is required" },
        { status: 400 }
      );
    }

    // Validate connectionId format
    if (!mongoose.Types.ObjectId.isValid(connectionId)) {
      return NextResponse.json(
        { error: "Invalid connection ID format" },
        { status: 400 }
      );
    }

    // Verify the connection exists and belongs to the user
    await dbConnect();
    const connection = await DatabaseConnection.findOne({
      _id: connectionId,
      userId: session.user.id,
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Database connection not found" },
        { status: 404 }
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

    // Create input with ONLY connection_id and user_id (secure - no credentials)
    // LangGraph agent will fetch connection details from its own connection store
    const input = {
      messages: [{ role: "human", content: message }],
      connection_id: connectionId,
      user_id: session.user.id,
    };

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamResponse = client.runs.stream(thread.thread_id, graphName, {
            input,
            streamMode: "messages",
          });

          let lastContent = "";

          for await (const chunk of streamResponse) {
            if (chunk.event === "messages/partial") {
              const data = chunk.data as Array<{ content?: string; type?: string }>;
              if (data && data.length > 0) {
                const lastMessage = data[data.length - 1];
                if (lastMessage.content && lastMessage.type === "ai") {
                  // Only send the new content (delta)
                  const newContent = lastMessage.content;
                  if (newContent.length > lastContent.length) {
                    const delta = newContent.slice(lastContent.length);
                    lastContent = newContent;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ delta, threadId: thread.thread_id })}\n\n`)
                    );
                  }
                }
              }
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat stream API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process message" },
      { status: 500 }
    );
  }
}
