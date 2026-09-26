"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up" | "reset" | "check-email";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    if (mode === "reset") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
      if (resetError) setError(resetError.message);
      else setMessage("Password reset instructions have been sent if that email is registered.");
    } else if (mode === "sign-up") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: redirectTo },
      });
      if (signUpError) setError(signUpError.message);
      else if (data.session) router.refresh();
      else {
        setConfirmationEmail(email.trim());
        setPassword("");
        setMode("check-email");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
      else router.refresh();
    }

    setBusy(false);
  }

  const title = mode === "sign-up" ? "Create your account" : mode === "reset" ? "Reset your password" : "Welcome back";

  if (mode === "check-email") {
    return <main className="auth-screen"><section className="auth-panel">
      <div className="brand auth-brand"><span className="brand-mark"><GraduationCap size={20} /></span><span>StudyPulse<small>YOUR STUDY, IN RHYTHM</small></span></div>
      <p className="eyebrow">One more step</p><h1>Check your inbox</h1>
      <div className="confirmation-notice" role="status" aria-live="polite"><strong>Confirmation email sent</strong><p>We sent an account confirmation link to <b>{confirmationEmail}</b>. Open it to verify your email, then come back here to sign in.</p></div>
      <button className="primary-button auth-submit" onClick={() => { setMode("sign-in"); setError(""); setMessage(""); }}>I have confirmed my email</button>
    </section></main>;
  }

  return <main className="auth-screen"><section className="auth-panel">
    <div className="brand auth-brand"><span className="brand-mark"><GraduationCap size={20} /></span><span>StudyPulse<small>YOUR STUDY, IN RHYTHM</small></span></div>
    <p className="eyebrow">Your study, in rhythm</p><h1>{title}</h1>
    <form className="auth-form" onSubmit={submit}>
      {mode === "sign-up" && <label>Your name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>}
      <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      {mode !== "reset" && <label>Password<input type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="primary-button auth-submit" disabled={busy}>{busy ? "Please wait…" : title}</button>
    </form>
    <div className="auth-links">
      {mode === "sign-in" && <><button type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>Forgot password?</button><span>New here?</span><button type="button" onClick={() => { setMode("sign-up"); setError(""); setMessage(""); }}>Create account</button></>}
      {mode === "sign-up" && <><span>Already registered?</span><button type="button" onClick={() => { setMode("sign-in"); setError(""); setMessage(""); }}>Sign in</button></>}
      {mode === "reset" && <button type="button" onClick={() => { setMode("sign-in"); setError(""); setMessage(""); }}>Back to sign in</button>}
    </div>
  </section></main>;
}
