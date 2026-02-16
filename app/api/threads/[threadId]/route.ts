import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/mongoose";
import Thread from "@/models/Thread";

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

// GET - Get a thread by LangGraph threadId
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;

    await dbConnect();

    const thread = await Thread.findOne({
      threadId,
      userId: session.user.id,
    }).populate("connectionId", "name type");

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json(thread);
  } catch (error) {
    console.error("Error fetching thread:", error);
    return NextResponse.json({ error: "Failed to fetch thread" }, { status: 500 });
  }
}

// PUT - Update a thread (title, lastMessage, etc.)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;
    const body = await request.json();
    const { title, lastMessage, messageCount } = body;

    await dbConnect();

    const thread = await Thread.findOne({
      threadId,
      userId: session.user.id,
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (title !== undefined) thread.title = title;
    if (lastMessage !== undefined) thread.lastMessage = lastMessage;
    if (messageCount !== undefined) thread.messageCount = messageCount;

    await thread.save();

    return NextResponse.json(thread);
  } catch (error) {
    console.error("Error updating thread:", error);
    return NextResponse.json({ error: "Failed to update thread" }, { status: 500 });
  }
}

// DELETE - Delete a thread
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;

    await dbConnect();

    const thread = await Thread.findOneAndDelete({
      threadId,
      userId: session.user.id,
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // TODO: Optionally delete the thread from LangGraph as well

    return NextResponse.json({ message: "Thread deleted successfully" });
  } catch (error) {
    console.error("Error deleting thread:", error);
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
  }
}
