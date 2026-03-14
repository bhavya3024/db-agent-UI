import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/mongoose";
import mongoose from "mongoose";
import { createConnectionSecrets } from "@/lib/onepassword";
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
      .select(
        "-passwordSecretRef -connectionStringSecretRef -credentialVaultId -credentialItemId"
      )
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
    const { name, type, host, port, database, username, password, connectionString } = body;

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

    const connectionId = new mongoose.Types.ObjectId();
    const storedSecrets = await createConnectionSecrets({
      connectionId: connectionId.toString(),
      userId: session.user.id,
      connectionName: name,
      type,
      host,
      port,
      database,
      username,
      password,
      connectionString,
    });

    const connection = await DatabaseConnection.create({
      _id: connectionId,
      userId: session.user.id,
      name,
      type,
      host,
      port,
      database,
      username,
      credentialVaultId: storedSecrets?.credentialVaultId,
      credentialItemId: storedSecrets?.credentialItemId,
      passwordSecretRef: storedSecrets?.passwordSecretRef,
      connectionStringSecretRef: storedSecrets?.connectionStringSecretRef,
    });

    // Return without sensitive data
    const response = connection.toObject();
    delete response.passwordSecretRef;
    delete response.connectionStringSecretRef;
    delete response.credentialVaultId;
    delete response.credentialItemId;

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating connection:", error);
    return NextResponse.json({ error: "Failed to create connection" }, { status: 500 });
  }
}
