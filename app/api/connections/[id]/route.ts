import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/mongoose";
import { deleteConnectionSecrets, updateConnectionSecrets } from "@/lib/onepassword";
import DatabaseConnection from "@/models/DatabaseConnection";
import Thread from "@/models/Thread";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single connection
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
    const connection = await DatabaseConnection.findOne({
      _id: id,
      userId: session.user.id,
    }).select(
      "-passwordSecretRef -connectionStringSecretRef -credentialVaultId -credentialItemId"
    );

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    return NextResponse.json(connection);
  } catch (error) {
    console.error("Error fetching connection:", error);
    return NextResponse.json({ error: "Failed to fetch connection" }, { status: 500 });
  }
}

// PUT - Update a connection
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const { name, type, host, port, database, username, password, connectionString, isActive } = body;

    await dbConnect();

    // Check ownership
    const existing = await DatabaseConnection.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!existing) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Check for duplicate name (excluding current)
    if (name && name !== existing.name) {
      const duplicate = await DatabaseConnection.findOne({
        userId: session.user.id,
        name,
        _id: { $ne: id },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A connection with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Update fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = port;
    if (database !== undefined) updateData.database = database;
    if (username !== undefined) updateData.username = username;
    if (isActive !== undefined) updateData.isActive = isActive;

    const hasNewSecretValues =
      (typeof password === "string" && password.trim() !== "") ||
      (typeof connectionString === "string" && connectionString.trim() !== "");

    if (hasNewSecretValues) {
      const updatedSecrets = await updateConnectionSecrets(
        {
          credentialVaultId: existing.credentialVaultId,
          credentialItemId: existing.credentialItemId,
          passwordSecretRef: existing.passwordSecretRef,
          connectionStringSecretRef: existing.connectionStringSecretRef,
        },
        {
          connectionId: existing._id.toString(),
          userId: existing.userId,
          connectionName: name ?? existing.name,
          type: type ?? existing.type,
          host: host ?? existing.host,
          port: port ?? existing.port,
          database: database ?? existing.database,
          username: username ?? existing.username,
          password,
          connectionString,
        }
      );

      if (updatedSecrets) {
        updateData.credentialVaultId = updatedSecrets.credentialVaultId;
        updateData.credentialItemId = updatedSecrets.credentialItemId;
        updateData.passwordSecretRef = updatedSecrets.passwordSecretRef;
        updateData.connectionStringSecretRef = updatedSecrets.connectionStringSecretRef;
      }
    }

    const connection = await DatabaseConnection.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select(
      "-passwordSecretRef -connectionStringSecretRef -credentialVaultId -credentialItemId"
    );

    return NextResponse.json(connection);
  } catch (error) {
    console.error("Error updating connection:", error);
    return NextResponse.json({ error: "Failed to update connection" }, { status: 500 });
  }
}

// DELETE - Delete a connection and its threads
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Check ownership
    const connection = await DatabaseConnection.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Delete all threads associated with this connection
    await Thread.deleteMany({ connectionId: id });

    // Delete secrets from 1Password before deleting the DB record
    await deleteConnectionSecrets(connection.credentialVaultId, connection.credentialItemId);

    // Delete the connection
    await DatabaseConnection.findByIdAndDelete(id);

    return NextResponse.json({ message: "Connection deleted successfully" });
  } catch (error) {
    console.error("Error deleting connection:", error);
    return NextResponse.json({ error: "Failed to delete connection" }, { status: 500 });
  }
}
