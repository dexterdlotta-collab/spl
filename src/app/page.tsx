import { AuthForm } from "@/components/auth-form";
import { SupabaseSetup } from "@/components/supabase-setup";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return <SupabaseSetup />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <AuthForm />;

  return <AppShell user={{ id: user.id, email: user.email ?? "", displayName: user.user_metadata.display_name ?? "" }} />;
}
