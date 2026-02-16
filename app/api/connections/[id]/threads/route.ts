import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/mongoose";
import DatabaseConnection from "@/models/DatabaseConnection";
import Thread from "@/models/Thread";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List all threads for a connection
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid connection ID" }, { status: 400 });
    }

    await dbConnect();

    // Verify user owns this connection
    const connection = await DatabaseConnection.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const threads = await Thread.find({ connectionId: id }).sort({ updatedAt: -1 });

    return NextResponse.json(threads);
  } catch (error) {
    console.error("Error fetching threads:", error);
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
  }
}

// POST - Create a new thread for a connection
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid connection ID" }, { status: 400 });
    }

    const body = await request.json();
    const { threadId, title } = body;

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    await dbConnect();

    // Verify user owns this connection
    const connection = await DatabaseConnection.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Check if thread already exists
    let thread = await Thread.findOne({ threadId });

    if (thread) {
      // Update existing thread
      if (title) thread.title = title;
      thread.updatedAt = new Date();
      await thread.save();
    } else {
      // Create new thread
      thread = await Thread.create({
        threadId,
        connectionId: id,
        userId: session.user.id,
        title: title || "New Conversation",
      });
    }

    return NextResponse.json(thread, { status: thread.isNew ? 201 : 200 });
  } catch (error) {
    console.error("Error creating thread:", error);
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
  }
}
