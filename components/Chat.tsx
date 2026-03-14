"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  connectionId: string;
  threadId: string | null;
  onThreadCreated?: (threadId: string) => void;
}

export default function Chat({ connectionId, threadId: initialThreadId, onThreadCreated }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadSavedRef = useRef(false); // Use ref for synchronous check
  const currentConnectionRef = useRef(connectionId);

  // Load messages for an existing thread
  const loadThreadMessages = useCallback(async (threadIdToLoad: string) => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/threads/${threadIdToLoad}/messages`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const loadedMessages: Message[] = data.messages.map((msg: { role: string; content: string }, index: number) => ({
            id: `loaded-${index}`,
            role: msg.role === "human" ? "user" : "assistant",
            content: msg.content,
            timestamp: new Date(),
          }));
          setMessages(loadedMessages);
        }
      }
    } catch (error) {
      console.error("Error loading thread messages:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Reset only when CONNECTION changes (not when threadId is set for the first time)
  useEffect(() => {
    // Only reset if connection actually changed
    if (currentConnectionRef.current !== connectionId) {
      setMessages([]);
      setThreadId(initialThreadId);
      setError(null);
      threadSavedRef.current = !!initialThreadId;
      currentConnectionRef.current = connectionId;
      // Load messages if we have an initial thread
      if (initialThreadId) {
        loadThreadMessages(initialThreadId);
      }
    } else if (initialThreadId && initialThreadId !== threadId) {
      // Different thread selected (from sidebar), load its messages
      setMessages([]);
      setThreadId(initialThreadId);
      threadSavedRef.current = true; // Existing thread, already saved
      loadThreadMessages(initialThreadId);
    }
  }, [connectionId, initialThreadId, loadThreadMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save thread to database (only once per thread)
  const saveThread = useCallback(async (newThreadId: string, firstMessage: string) => {
    // Synchronous check with ref - prevents duplicate calls
    if (threadSavedRef.current) return;
    threadSavedRef.current = true;
    
    try {
      const response = await fetch(`/api/connections/${connectionId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: newThreadId,
          title: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : ""),
        }),
      });
      
      if (response.ok) {
        onThreadCreated?.(newThreadId);
      }
    } catch (error) {
      console.error("Error saving thread:", error);
      threadSavedRef.current = false; // Allow retry on error
    }
  }, [connectionId, onThreadCreated]);

  // Update thread with last message
  const updateThread = useCallback(async (currentThreadId: string, lastMessage: string) => {
    try {
      await fetch(`/api/threads/${currentThreadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastMessage: lastMessage.slice(0, 100),
          messageCount: messages.length + 2,
        }),
      });
    } catch (error) {
      console.error("Error updating thread:", error);
    }
  }, [messages.length]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    // Add placeholder for assistant message
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ]);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          threadId,
          connectionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let threadIdHandled = false; // Local flag for this stream session

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.delta) {
                accumulatedContent += parsed.delta;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              }
              // Handle threadId only once per stream
              if (parsed.threadId && !threadIdHandled) {
                threadIdHandled = true;
                const newThreadId = parsed.threadId;
                setThreadId(newThreadId);
                saveThread(newThreadId, userMessage.content);
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Update thread with last message
      if (threadId && accumulatedContent) {
        updateThread(threadId, accumulatedContent);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      // Remove the empty assistant message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setThreadId(null);
    setError(null);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Database Agent
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {threadId ? `Thread: ${threadId.slice(0, 8)}...` : "New conversation"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoadingHistory ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <svg className="mx-auto h-8 w-8 animate-spin text-blue-500" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="mt-2 text-sm text-zinc-500">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
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
              Ask me questions about your databases. I can query PostgreSQL and MongoDB,
              list tables, describe schemas, and help you explore your data.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                "List all databases",
                "Show tables in PostgreSQL",
                "Describe the users collection",
                "Query recent orders",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  {message.role === "user" ? (
                    <p className="whitespace-pre-wrap">{message.content || "..."}</p>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:m-0 prose-pre:bg-transparent">
                      {message.content ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || "");
                              const isInline = !match && !className;
                              return isInline ? (
                                <code
                                  className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-700"
                                  {...props}
                                >
                                  {children}
                                </code>
                              ) : (
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match ? match[1] : "text"}
                                  PreTag="div"
                                  className="rounded-lg !my-2"
                                >
                                  {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                              );
                            },
                            table({ children }) {
                              return (
                                <div className="overflow-x-auto my-2">
                                  <table className="min-w-full border-collapse border border-zinc-300 dark:border-zinc-600">
                                    {children}
                                  </table>
                                </div>
                              );
                            },
                            th({ children }) {
                              return (
                                <th className="border border-zinc-300 bg-zinc-200 px-3 py-2 text-left dark:border-zinc-600 dark:bg-zinc-700">
                                  {children}
                                </th>
                              );
                            },
                            td({ children }) {
                              return (
                                <td className="border border-zinc-300 px-3 py-2 dark:border-zinc-600">
                                  {children}
                                </td>
                              );
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <span className="animate-pulse">...</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-6 mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <form onSubmit={sendMessage} className="flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your databases..."
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-500 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400 dark:focus:border-blue-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              "Send"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
