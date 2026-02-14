"use client";

import { useEffect, useState } from "react";

interface HealthStatus {
  status: "checking" | "connected" | "error";
  message?: string;
  assistants?: Array<{
    id: string;
    name: string;
    graphId: string;
  }>;
}

export default function ConnectionStatus() {
  const [health, setHealth] = useState<HealthStatus>({ status: "checking" });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        setHealth({
          status: data.status,
          message: data.message,
          assistants: data.assistants,
        });
      } catch (error) {
        setHealth({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to check connection",
        });
      }
    };

    checkHealth();
    // Recheck every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusColors = {
    checking: "bg-yellow-500",
    connected: "bg-green-500",
    error: "bg-red-500",
  };

  const statusText = {
    checking: "Checking connection...",
    connected: "Connected to LangGraph",
    error: health.message || "Connection error",
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800">
      <span
        className={`h-2 w-2 rounded-full ${statusColors[health.status]} ${health.status === "checking" ? "animate-pulse" : ""}`}
      />
      <span className="text-zinc-600 dark:text-zinc-400">
        {statusText[health.status]}
      </span>
    </div>
  );
}
