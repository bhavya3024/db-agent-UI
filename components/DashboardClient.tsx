"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Chat from "./Chat";
import ConnectionStatus from "./ConnectionStatus";
import UserMenu from "./UserMenu";

interface DashboardClientProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelectConnection = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
  };

  const handleSelectThread = (threadId: string, connectionId: string) => {
    setSelectedThreadId(threadId);
    setSelectedConnectionId(connectionId);
  };

  const handleNewChat = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setSelectedThreadId(null);
  };

  const handleThreadCreated = (threadId: string) => {
    setSelectedThreadId(threadId);
    // Trigger sidebar to refresh threads list
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleThreadDeleted = (threadId: string, connectionId: string) => {
    // Clear selection if the deleted thread was selected
    if (selectedThreadId === threadId) {
      setSelectedThreadId(null);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
              />
            </svg>
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">DB Agent</span>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionStatus />
          {user && <UserMenu user={user} />}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-72" : "w-0"
          } flex-shrink-0 overflow-hidden border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900`}
        >
          <Sidebar
            selectedConnectionId={selectedConnectionId}
            selectedThreadId={selectedThreadId}
            onSelectConnection={handleSelectConnection}
            onSelectThread={handleSelectThread}
            onNewChat={handleNewChat}
            onThreadDeleted={handleThreadDeleted}
            refreshTrigger={refreshTrigger}
          />
        </aside>

        {/* Chat area */}
        <main className="flex-1 overflow-hidden">
          {selectedConnectionId ? (
            <Chat
              user={user}
              connectionId={selectedConnectionId}
              threadId={selectedThreadId}
              onThreadCreated={handleThreadCreated}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-4">
                <svg
                  className="h-8 w-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Welcome to Database Agent
              </h2>
              <p className="max-w-md text-zinc-500 dark:text-zinc-400">
                Add a database connection from the sidebar to get started. You can query
                PostgreSQL, MongoDB, and MySQL databases.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
