import mongoose from "mongoose";
import path from "node:path";
import { config } from 'dotenv';
config({
  path: path.resolve(process.cwd(), '.env.local'),
  override: true,
});
import * as sdk from "@1password/sdk";
import { createConnectionSecrets } from "../lib/onepassword";

interface LegacyConnectionDocument {
  _id: mongoose.Types.ObjectId;
  userId: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  connectionString?: string;
  credentialItemId?: string;
  credentialVaultId?: string;
}

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

async function assertVaultAccess() {
  const client = await sdk.createClient({
    auth: process.env.OP_SERVICE_ACCOUNT_TOKEN as string,
    integrationName: "db-agent-ui",
    integrationVersion: "v0.1.0",
  });

  try {
    await client.vaults.getOverview(process.env.OP_VAULT_ID as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to access OP_VAULT_ID with OP_SERVICE_ACCOUNT_TOKEN. ${message}. ` +
        "Grant the service account access to this vault with item read/create/update/delete permissions."
    );
  }
}

function hasLegacySecrets(connection: LegacyConnectionDocument): boolean {
  const hasPassword = typeof connection.password === "string" && connection.password.trim() !== "";
  const hasConnectionString =
    typeof connection.connectionString === "string" && connection.connectionString.trim() !== "";

  return hasPassword || hasConnectionString;
}

async function migrateConnectionSecrets() {
  console.log("Starting credentials migration to 1Password...");
  if (isDryRun) {
    console.log("Dry-run mode is enabled. No database updates will be written.");
  }

  requireEnv("MONGODB_URI");
  requireEnv("OP_SERVICE_ACCOUNT_TOKEN");
  requireEnv("OP_VAULT_ID");
  await assertVaultAccess();

  const { default: dbConnect } = await import("../lib/mongoose");
  await dbConnect();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not established");
  }

  const collection = db.collection<LegacyConnectionDocument>("databaseconnections");

  const candidates = await collection
    .find({
      $or: [{ password: { $exists: true, $ne: "" } }, { connectionString: { $exists: true, $ne: "" } }],
    })
    .toArray();

  if (candidates.length === 0) {
    console.log("No legacy plaintext credentials found. Migration is already complete.");
    return;
  }

  console.log(`Found ${candidates.length} candidate connection(s).`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let wouldMigrate = 0;

  for (const connection of candidates) {
    const alreadyMigrated = Boolean(connection.credentialItemId && connection.credentialVaultId);
    if (alreadyMigrated) {
      skipped += 1;
      console.log(`- Skipped ${connection._id.toString()} (${connection.name}): already has 1Password metadata.`);
      continue;
    }

    if (!hasLegacySecrets(connection)) {
      skipped += 1;
      console.log(`- Skipped ${connection._id.toString()} (${connection.name}): no non-empty secret values.`);
      continue;
    }

    try {
      if (isDryRun) {
        wouldMigrate += 1;
        console.log(`- Would migrate ${connection._id.toString()} (${connection.name})`);
        continue;
      }

      const refs = await createConnectionSecrets({
        connectionId: connection._id.toString(),
        userId: connection.userId,
        connectionName: connection.name,
        type: connection.type,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password: connection.password,
        connectionString: connection.connectionString,
      });

      if (!refs) {
        skipped += 1;
        console.log(`- Skipped ${connection._id.toString()} (${connection.name}): no refs returned.`);
        continue;
      }

      if (!isDryRun) {
        await collection.updateOne(
          { _id: connection._id },
          {
            $set: {
              credentialVaultId: refs.credentialVaultId,
              credentialItemId: refs.credentialItemId,
              passwordSecretRef: refs.passwordSecretRef,
              connectionStringSecretRef: refs.connectionStringSecretRef,
            },
            $unset: {
              password: "",
              connectionString: "",
            },
          }
        );
      }

      migrated += 1;
      console.log(`- Migrated ${connection._id.toString()} (${connection.name})`);
    } catch (error) {
      failed += 1;
      console.error(
        `- Failed ${connection._id.toString()} (${connection.name}):`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log("\nMigration summary");
  console.log(`- Migrated: ${migrated}`);
  console.log(`- Would migrate: ${wouldMigrate}`);
  console.log(`- Skipped: ${skipped}`);
  console.log(`- Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

migrateConnectionSecrets()
  .catch((error) => {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
