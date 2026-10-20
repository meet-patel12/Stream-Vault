import { redirect } from "next/navigation";
import { getSessionOrRefresh } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSessionOrRefresh();
  if (session) {
    redirect("/browse");
  }
  redirect("/auth/login");
}
