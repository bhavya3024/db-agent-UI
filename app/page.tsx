import { auth } from "@/auth";
import DashboardClient from "@/components/DashboardClient";

export default async function Home() {
  const session = await auth();

  return <DashboardClient user={session?.user} />;
}
