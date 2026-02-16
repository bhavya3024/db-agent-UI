import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/mongoose";
import DatabaseConnection, { DatabaseType } from "@/models/DatabaseConnection";

// GET - List all connections for the current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const connections = await DatabaseConnection.find({ userId: session.user.id })
      .select("-password -connectionString") // Don't send sensitive data
      .sort({ updatedAt: -1 });

    return NextResponse.json(connections);
  } catch (error) {
    console.error("Error fetching connections:", error);
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
  }
}

// POST - Create a new connection
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, host, port, database, username, password } = body;

    // Validate required fields
    if (!name || !type || !host || !port || !database) {
      return NextResponse.json(
        { error: "Missing required fields: name, type, host, port, database" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes: DatabaseType[] = ["postgresql", "mongodb", "mysql"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check for duplicate name
    const existing = await DatabaseConnection.findOne({
      userId: session.user.id,
      name,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A connection with this name already exists" },
        { status: 409 }
      );
    }

    const connection = await DatabaseConnection.create({
      userId: session.user.id,
      name,
      type,
      host,
      port,
      database,
      username,
      password, // TODO: Encrypt in production
    });

    // Return without sensitive data
    const response = connection.toObject();
    delete response.password;
    delete response.connectionString;

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating connection:", error);
    return NextResponse.json({ error: "Failed to create connection" }, { status: 500 });
  }
}
