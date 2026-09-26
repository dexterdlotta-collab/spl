"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, ChartNoAxesColumnIncreasing, GraduationCap, LayoutDashboard, LogOut, Moon, Search, Sun, Users, UserRound, type LucideIcon } from "lucide-react";
import { OverviewDashboard } from "@/components/dashboard";
import { SectionView } from "@/components/live-section-views";
import { navigation, type Section, type Subject } from "@/lib/study-data";
import { createClient } from "@/lib/supabase/client";

const navIcons: Record<Section, LucideIcon> = {
  Overview: LayoutDashboard,
  "Play & Study": BookOpen,
  Exams: CalendarDays,
  "Study Rooms": Users,
  Leaderboard: ChartNoAxesColumnIncreasing,
  "My Profile": UserRound,
};

export function AppShell({ user }: { user: { id: string; email: string; displayName: string } }) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [active, setActive] = useState<Section>("Overview");
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [xp, setXp] = useState(0);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [subjectList, setSubjectList] = useState<Subject[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let activeEffect = true;
    async function loadAccountData() {
      const [subjectResult, profileResult, progressResult] = await Promise.all([
        supabase.from("subjects").select("id,name,description,icon,tone").order("name"),
        supabase.from("profiles").select("display_name,xp").eq("id", user.id).single(),
        supabase.from("subject_progress").select("subject_id,answered,correct").eq("user_id", user.id),
      ]);
      if (!activeEffect) return;
      if (subjectResult.error || profileResult.error || progressResult.error) {
        setLoadError(subjectResult.error?.message ?? profileResult.error?.message ?? progressResult.error?.message ?? "Unable to load your account data.");
        return;
      }
      const progressBySubject = new Map(progressResult.data.map((entry) => [entry.subject_id, entry]));
      setSubjectList(subjectResult.data.map((row) => {
        const progress = progressBySubject.get(row.id);
        return { id: row.id, name: row.name, detail: row.description, icon: row.icon, tone: row.tone, progress: progress?.answered ? Math.round((progress.correct / progress.answered) * 100) : 0 };
      }));
      setXp(profileResult.data.xp);
      setDisplayName(profileResult.data.display_name);
    }
    void loadAccountData();
    const channel = supabase.channel("shared-subject-catalog").on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, () => { void loadAccountData(); }).subscribe();
    return () => {
      activeEffect = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, user.id]);

  async function addSubject(subject: Omit<Subject, "id" | "progress">): Promise<Subject | null> {
    const { data, error } = await supabase.from("subjects").insert({ name: subject.name, description: subject.detail, icon: subject.icon, tone: subject.tone, created_by: user.id }).select("id,name,description,icon,tone").single();
    if (error || !data) return null;
    const savedSubject: Subject = { id: data.id, name: data.name, detail: data.description, icon: data.icon, tone: data.tone, progress: 0 };
    setSubjectList((current) => current.some((item) => item.id === savedSubject.id) ? current : [...current, savedSubject].sort((left, right) => left.name.localeCompare(right.name)));
    return savedSubject;
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return <div className="app-shell" data-theme={dark ? "dark" : "light"}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><GraduationCap size={20} /></span><span>StudyPulse<small>YOUR STUDY, IN RHYTHM</small></span></div>
      <p className="nav-label">Workspace</p>
      <nav className="nav-list" aria-label="Main navigation">{navigation.map((item) => { const Icon = navIcons[item]; return <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => setActive(item)} aria-current={active === item ? "page" : undefined}><Icon size={18} />{item}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="sidebar-user"><span className="avatar">{displayName.slice(0, 2).toUpperCase() || user.email.slice(0, 2).toUpperCase()}</span><span><strong>{displayName || user.email}</strong><small>{user.email}</small></span><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}><LogOut size={15} /></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span style={{ margin: "0 8px", color: "var(--line)" }}>/</span><strong>{active}</strong></div><div className="top-actions"><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects..." aria-label="Search subjects" /></label><button className="icon-button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"} onClick={() => setDark(!dark)}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button></div></header>
      {loadError && <p className="auth-error" role="alert">{loadError}</p>}
      {active === "Overview" ? <OverviewDashboard onNavigate={setActive} query={query} subjects={subjectList} xp={xp} user={{ ...user, displayName }} /> : <SectionView section={active} xp={xp} subjects={subjectList} onAddSubject={addSubject} user={{ ...user, displayName }} onAccountRefresh={async () => { const { data } = await supabase.from("profiles").select("xp").eq("id", user.id).single(); if (data) setXp(data.xp); }} onDisplayNameChange={setDisplayName} />}
    </main>
  </div>;
}
