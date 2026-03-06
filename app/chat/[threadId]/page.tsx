import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";
import dbConnect from "@/lib/mongoose";
import Thread from "@/models/Thread";

interface PageProps {
  params: Promise<{ threadId: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { threadId } = await params;

  // Fetch the thread to get the connectionId
  await dbConnect();
  const thread = await Thread.findOne({
    threadId,
    userId: session.user.id,
  }).lean();

  if (!thread) {
    // Thread not found, redirect to home
    redirect("/");
  }

  return (
    <DashboardClient
      user={session?.user}
      initialThreadId={threadId}
      initialConnectionId={thread.connectionId.toString()}
    />
  );
}
