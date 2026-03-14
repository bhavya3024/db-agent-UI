type OnePasswordSdkModule = typeof import("@1password/sdk");

let onePasswordSdkPromise: Promise<OnePasswordSdkModule> | null = null;
let onePasswordClientPromise: Promise<unknown> | null = null;

interface ConnectionSecretInput {
  connectionId: string;
  userId: string;
  connectionName: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  connectionString?: string;
}

interface StoredSecretRefs {
  credentialVaultId: string;
  credentialItemId: string;
  passwordSecretRef?: string;
  connectionStringSecretRef?: string;
}

const DATABASE_SECTION_ID = "database_details";

function getOnePasswordConfig() {
  const serviceAccountToken = process.env.OP_SERVICE_ACCOUNT_TOKEN;
  const vaultId = process.env.OP_VAULT_ID;

  if (!serviceAccountToken) {
    throw new Error("Missing OP_SERVICE_ACCOUNT_TOKEN environment variable");
  }

  if (!vaultId) {
    throw new Error("Missing OP_VAULT_ID environment variable");
  }

  return { serviceAccountToken, vaultId };
}

function buildSecretRef(vaultId: string, itemId: string, fieldId: string): string {
  return `op://${vaultId}/${itemId}/${fieldId}`;
}

async function getOnePasswordClient() {
  const sdk = await getOnePasswordSdk();

  if (!onePasswordClientPromise) {
    const { serviceAccountToken } = getOnePasswordConfig();
    onePasswordClientPromise = sdk.createClient({
      auth: serviceAccountToken,
      integrationName: "db-agent-ui",
      integrationVersion: "v0.1.0",
    });
  }

  return onePasswordClientPromise;
}

async function getOnePasswordSdk(): Promise<OnePasswordSdkModule> {
  if (!onePasswordSdkPromise) {
    onePasswordSdkPromise = import("@1password/sdk");
  }

  return onePasswordSdkPromise;
}

function hasSecretValues(input: Pick<ConnectionSecretInput, "password" | "connectionString">): boolean {
  return Boolean(input.password && input.password.trim()) || Boolean(input.connectionString && input.connectionString.trim());
}

export async function createConnectionSecrets(input: ConnectionSecretInput): Promise<StoredSecretRefs | null> {
  if (!hasSecretValues(input)) {
    return null;
  }

  const sdk = await getOnePasswordSdk();
  const client = await getOnePasswordClient();
  const { vaultId } = getOnePasswordConfig();

  const fields = [
    {
      id: "db_host",
      title: "host",
      sectionId: DATABASE_SECTION_ID,
      fieldType: sdk.ItemFieldType.Text,
      value: input.host,
    },
    {
      id: "db_port",
      title: "port",
      sectionId: DATABASE_SECTION_ID,
      fieldType: sdk.ItemFieldType.Text,
      value: String(input.port),
    },
    {
      id: "db_name",
      title: "database",
      sectionId: DATABASE_SECTION_ID,
      fieldType: sdk.ItemFieldType.Text,
      value: input.database,
    },
  ];

  if (input.username?.trim()) {
    fields.push({
      id: "username",
      title: "username",
      fieldType: sdk.ItemFieldType.Text,
      value: input.username,
    });
  }

  if (input.password?.trim()) {
    fields.push({
      id: "password",
      title: "password",
      fieldType: sdk.ItemFieldType.Concealed,
      value: input.password,
    });
  }

  if (input.connectionString?.trim()) {
    fields.push({
      id: "connectionString",
      title: "connectionString",
      sectionId: DATABASE_SECTION_ID,
      fieldType: sdk.ItemFieldType.Concealed,
      value: input.connectionString,
    });
  }

  const item = await client.items.create({
    title: `DB Connection: ${input.connectionName}`,
    category: sdk.ItemCategory.Login,
    vaultId,
    fields,
    sections: [{ id: DATABASE_SECTION_ID, title: "Database Details" }],
    tags: [
      "db-agent-ui",
      "database-credentials",
      `connection:${input.connectionId}`,
      `user:${input.userId}`,
      `type:${input.type}`,
    ],
    notes: `Connection ${input.connectionName} (${input.connectionId}) credentials`,
  });

  return {
    credentialVaultId: item.vaultId,
    credentialItemId: item.id,
    passwordSecretRef: input.password?.trim() ? buildSecretRef(item.vaultId, item.id, "password") : undefined,
    connectionStringSecretRef: input.connectionString?.trim()
      ? buildSecretRef(item.vaultId, item.id, "connectionString")
      : undefined,
  };
}

export async function updateConnectionSecrets(
  existing: {
    credentialVaultId?: string;
    credentialItemId?: string;
    passwordSecretRef?: string;
    connectionStringSecretRef?: string;
  },
  input: ConnectionSecretInput
): Promise<StoredSecretRefs | null> {
  if (!hasSecretValues(input) && !existing.credentialItemId) {
    return null;
  }

  const sdk = await getOnePasswordSdk();

  if (!existing.credentialVaultId || !existing.credentialItemId) {
    return createConnectionSecrets(input);
  }

  const client = await getOnePasswordClient();
  const item = await client.items.get(existing.credentialVaultId, existing.credentialItemId);
  const fields = [...item.fields];

  const setFieldValue = (
    id: string,
    title: string,
    fieldType: sdk.ItemFieldType,
    value?: string,
    sectionId?: string
  ) => {
    if (value === undefined || value.trim() === "") {
      return;
    }

    const index = fields.findIndex((field) => field.id === id);

    if (index >= 0) {
      fields[index] = { ...fields[index], value, sectionId };
      return;
    }

    fields.push({ id, title, fieldType, value, sectionId });
  };

  setFieldValue("db_host", "host", sdk.ItemFieldType.Text, input.host, DATABASE_SECTION_ID);
  setFieldValue("db_port", "port", sdk.ItemFieldType.Text, String(input.port), DATABASE_SECTION_ID);
  setFieldValue("db_name", "database", sdk.ItemFieldType.Text, input.database, DATABASE_SECTION_ID);
  setFieldValue("username", "username", sdk.ItemFieldType.Text, input.username);
  setFieldValue("password", "password", sdk.ItemFieldType.Concealed, input.password);
  setFieldValue(
    "connectionString",
    "connectionString",
    sdk.ItemFieldType.Concealed,
    input.connectionString,
    DATABASE_SECTION_ID
  );

  const updatedItem = await client.items.put({
    ...item,
    title: `DB Connection: ${input.connectionName}`,
    fields,
    sections: item.sections.some((section) => section.id === DATABASE_SECTION_ID)
      ? item.sections
      : [...item.sections, { id: DATABASE_SECTION_ID, title: "Database Details" }],
    tags: [
      "db-agent-ui",
      "database-credentials",
      `connection:${input.connectionId}`,
      `user:${input.userId}`,
      `type:${input.type}`,
    ],
    notes: `Connection ${input.connectionName} (${input.connectionId}) credentials`,
  });

  const hasPassword = updatedItem.fields.some((field) => field.id === "password");
  const hasConnectionString = updatedItem.fields.some((field) => field.id === "connectionString");

  return {
    credentialVaultId: updatedItem.vaultId,
    credentialItemId: updatedItem.id,
    passwordSecretRef: hasPassword
      ? buildSecretRef(updatedItem.vaultId, updatedItem.id, "password")
      : undefined,
    connectionStringSecretRef: hasConnectionString
      ? buildSecretRef(updatedItem.vaultId, updatedItem.id, "connectionString")
      : undefined,
  };
}

export async function deleteConnectionSecrets(vaultId?: string, itemId?: string): Promise<void> {
  if (!vaultId || !itemId) {
    return;
  }

  const client = await getOnePasswordClient();
  await client.items.delete(vaultId, itemId);
}
