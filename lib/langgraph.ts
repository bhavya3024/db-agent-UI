import { Client } from "@langchain/langgraph-sdk";

// Create a singleton client instance
let client: Client | null = null;

export function getLangGraphClient(): Client {
  if (!client) {
    const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:8123";
    const apiKey = process.env.LANGCHAIN_API_KEY;

    client = new Client({
      apiUrl,
      apiKey,
    });
  }
  return client;
}

export function getGraphName(): string {
  return process.env.LANGGRAPH_GRAPH_NAME || "agent";
}
