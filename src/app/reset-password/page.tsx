import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { SupabaseSetup } from "@/components/supabase-setup";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return <SupabaseSetup />;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return <ResetPasswordForm />;
}