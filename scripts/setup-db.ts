import dbConnect from "../lib/mongoose";
import mongoose from "mongoose";

/**
 * MongoDB Setup Script
 * 
 * Run this once to create indexes and validate the schema.
 * Usage: npx tsx scripts/setup-db.ts
 */

async function setupDatabase() {
  console.log("🔌 Connecting to MongoDB...");
  
  try {
    await dbConnect();
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not established");
    }

    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    // DatabaseConnections collection
    if (!collectionNames.includes("databaseconnections")) {
      await db.createCollection("databaseconnections");
      console.log("📁 Created 'databaseconnections' collection");
    }

    // Threads collection
    if (!collectionNames.includes("threads")) {
      await db.createCollection("threads");
      console.log("📁 Created 'threads' collection");
    }

    // Create indexes for DatabaseConnections
    console.log("\n📊 Creating indexes for DatabaseConnections...");
    const connectionsCollection = db.collection("databaseconnections");
    
    await connectionsCollection.createIndex({ userId: 1 });
    console.log("  ✓ Index on userId");
    
    await connectionsCollection.createIndex(
      { userId: 1, name: 1 },
      { unique: true }
    );
    console.log("  ✓ Unique compound index on userId + name");

    await connectionsCollection.createIndex({ updatedAt: -1 });
    console.log("  ✓ Index on updatedAt (descending)");

    // Create indexes for Threads
    console.log("\n📊 Creating indexes for Threads...");
    const threadsCollection = db.collection("threads");

    await threadsCollection.createIndex({ threadId: 1 }, { unique: true });
    console.log("  ✓ Unique index on threadId");

    await threadsCollection.createIndex({ connectionId: 1 });
    console.log("  ✓ Index on connectionId");

    await threadsCollection.createIndex({ userId: 1 });
    console.log("  ✓ Index on userId");

    await threadsCollection.createIndex({ connectionId: 1, updatedAt: -1 });
    console.log("  ✓ Compound index on connectionId + updatedAt");

    // NextAuth collections (users, accounts, sessions)
    console.log("\n📊 Creating indexes for NextAuth collections...");
    
    if (!collectionNames.includes("users")) {
      await db.createCollection("users");
    }
    const usersCollection = db.collection("users");
    await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log("  ✓ Unique index on users.email");

    if (!collectionNames.includes("accounts")) {
      await db.createCollection("accounts");
    }
    const accountsCollection = db.collection("accounts");
    await accountsCollection.createIndex(
      { provider: 1, providerAccountId: 1 },
      { unique: true }
    );
    console.log("  ✓ Unique compound index on accounts (provider + providerAccountId)");

    if (!collectionNames.includes("sessions")) {
      await db.createCollection("sessions");
    }
    const sessionsCollection = db.collection("sessions");
    await sessionsCollection.createIndex({ sessionToken: 1 }, { unique: true });
    console.log("  ✓ Unique index on sessions.sessionToken");

    // Print summary
    console.log("\n" + "=".repeat(50));
    console.log("✅ Database setup complete!");
    console.log("=".repeat(50));
    
    // List all indexes
    console.log("\n📋 Current indexes:");
    
    for (const collName of ["databaseconnections", "threads", "users", "accounts", "sessions"]) {
      if (collectionNames.includes(collName) || ["databaseconnections", "threads", "users", "accounts", "sessions"].includes(collName)) {
        const indexes = await db.collection(collName).indexes();
        console.log(`\n  ${collName}:`);
        indexes.forEach((idx) => {
          console.log(`    - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
      }
    }

  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

setupDatabase();
