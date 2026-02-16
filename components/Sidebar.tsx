"use client";

import { useState, useEffect, useCallback } from "react";
import ConnectionForm from "./ConnectionForm";

interface DatabaseConnection {
  _id: string;
  name: string;
  type: "postgresql" | "mongodb" | "mysql";
  host: string;
  port: number;
  database: string;
  username?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Thread {
  _id: string;
  threadId: string;
  title: string;
  lastMessage?: string;
  messageCount: number;
  updatedAt: string;
}

interface SidebarProps {
  selectedConnectionId: string | null;
  selectedThreadId: string | null;
  onSelectConnection: (connectionId: string) => void;
  onSelectThread: (threadId: string, connectionId: string) => void;
  onNewChat: (connectionId: string) => void;
}

const typeIcons: Record<string, string> = {
  postgresql: "🐘",
  mongodb: "🍃",
  mysql: "🐬",
};

export default function Sidebar({
  selectedConnectionId,
  selectedThreadId,
  onSelectConnection,
  onSelectThread,
  onNewChat,
}: SidebarProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [threads, setThreads] = useState<Record<string, Thread[]>>({});
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/connections");
      if (response.ok) {
        const data = await response.json();
        setConnections(data);
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchThreads = useCallback(async (connectionId: string) => {
    // Skip if already fetching or already have data

    console.log('FETCHING THREADS CONTINUOUSLY!!!');
    if (threads[connectionId] !== undefined) {
      return;
    }
    
    try {
      const response = await fetch(`/api/connections/${connectionId}/threads`);
      if (response.ok) {
        const data = await response.json();
        setThreads((prev) => ({ ...prev, [connectionId]: data }));
      } else {
        // Don't retry on error - set empty array
        console.error("Error fetching threads:", response.status);
        setThreads((prev) => ({ ...prev, [connectionId]: [] }));
      }
    } catch (error) {
      console.error("Error fetching threads:", error);
      setThreads((prev) => ({ ...prev, [connectionId]: [] }));
    }
    console.log('THREADS VALUE -->>>', threads);
  }, [threads]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const toggleConnection = (connectionId: string) => {
    const newExpanded = new Set(expandedConnections);
    if (newExpanded.has(connectionId)) {
      newExpanded.delete(connectionId);
    } else {
      newExpanded.add(connectionId);
      if (!threads[connectionId]) {
        fetchThreads(connectionId);
      }
    }
    setExpandedConnections(newExpanded);
    onSelectConnection(connectionId);
  };

  const handleSaveConnection = (connection: DatabaseConnection) => {
    if (editingConnection) {
      setConnections((prev) =>
        prev.map((c) => (c._id === connection._id ? connection : c))
      );
    } else {
      setConnections((prev) => [connection, ...prev]);
    }
    setShowForm(false);
    setEditingConnection(null);
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm("Are you sure? This will delete all threads for this connection.")) {
      return;
    }

    try {
      const response = await fetch(`/api/connections/${connectionId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setConnections((prev) => prev.filter((c) => c._id !== connectionId));
        setThreads((prev) => {
          const newThreads = { ...prev };
          delete newThreads[connectionId];
          return newThreads;
        });
      }
    } catch (error) {
      console.error("Error deleting connection:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Connections</h2>
        <button
          onClick={() => {
            setEditingConnection(null);
            setShowForm(true);
          }}
          className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="Add Connection"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Connection Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-800">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {editingConnection ? "Edit Connection" : "New Connection"}
            </h3>
            <ConnectionForm
              connection={editingConnection || undefined}
              onSave={handleSaveConnection}
              onCancel={() => {
                setShowForm(false);
                setEditingConnection(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Connections List */}
      <div className="flex-1 overflow-y-auto">
        {connections.length === 0 ? (
          <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No connections yet.
            <br />
            Click + to add one.
          </div>
        ) : (
          <div className="p-2">
            {connections.map((connection) => (
              <div key={connection._id} className="mb-1">
                {/* Connection Item */}
                <div
                  className={`group flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                    selectedConnectionId === connection._id
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <button
                    onClick={() => toggleConnection(connection._id)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span className="text-lg">{typeIcons[connection.type]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {connection.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {connection.host}:{connection.port}
                      </p>
                    </div>
                    <svg
                      className={`h-4 w-4 text-zinc-400 transition-transform ${
                        expandedConnections.has(connection._id) ? "rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <div className="ml-2 flex gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setEditingConnection(connection);
                        setShowForm(true);
                      }}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      title="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteConnection(connection._id)}
                      className="rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Threads */}
                {expandedConnections.has(connection._id) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {threads[connection._id]?.length === 0 && (
                      <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                        No conversations yet
                      </p>
                    )}
                    {threads[connection._id]?.map((thread) => (
                      <button
                        key={thread._id}
                        onClick={() => onSelectThread(thread.threadId, connection._id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          selectedThreadId === thread.threadId
                            ? "bg-zinc-200 dark:bg-zinc-700"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <svg
                          className="h-4 w-4 flex-shrink-0 text-zinc-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-zinc-900 dark:text-zinc-100">
                            {thread.title}
                          </p>
                          {thread.lastMessage && (
                            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {thread.lastMessage}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
