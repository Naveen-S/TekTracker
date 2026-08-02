import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · StoryBoard" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }
  return <LoginForm />;
}
