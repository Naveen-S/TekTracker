import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/safe-next.mjs";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · StoryBoard" };

export default async function LoginPage({ searchParams }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getCurrentUser();
  if (user) {
    redirect(nextPath);
  }
  return <LoginForm nextPath={nextPath} />;
}
