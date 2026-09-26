import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Play, Trophy, Zap } from "lucide-react";
import { type Section, type Subject } from "@/lib/study-data";
import { createClient } from "@/lib/supabase/client";

type DashboardUser = { id: string; email: string; displayName: string };
type Plan = { id: string; title: string; subject_id: string; question_count: number };
type Rank = { id: string; display_name: string; xp: number };

export function OverviewDashboard({ onNavigate, query, subjects, xp, user }: { onNavigate: (section: Section) => void; query: string; subjects: Subject[]; xp: number; user: DashboardUser }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [leaders, setLeaders] = useState<Rank[]>([]);
  const visibleSubjects = subjects.filter((subject) => `${subject.name} ${subject.detail}`.toLowerCase().includes(query.toLowerCase()));
  const [supabase] = useState(createClient);

  useEffect(() => {
    let active = true;
    async function loadOverview() {
      const [planResult, leaderboardResult] = await Promise.all([
        supabase.from("exam_plans").select("id,title,subject_id,question_count").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("profiles").select("id,display_name,xp").order("xp", { ascending: false }).limit(3),
      ]);
      if (active) {
        setPlans(planResult.data ?? []);
        setLeaders(leaderboardResult.data ?? []);
      }
    }
    void loadOverview();
    return () => { active = false; };
  }, [supabase, user.id]);

  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return <div className="content">
    <div className="greeting-row"><div><p className="eyebrow">{today}</p><h1>{greeting}, {user.displayName || user.email.split("@")[0]}</h1><p>Your account progress and shared learning catalog.</p></div></div>
    <div className="dashboard-grid">
      <div>
        <section className="hero-card card"><div className="hero-copy"><p className="eyebrow">Study workspace</p><h2>Choose a subject and keep moving.</h2><p>{subjects.length} subjects are available in the shared catalog.</p><button className="primary-button" onClick={() => onNavigate("Play & Study")}><Play size={14} fill="currentColor" /> Open study</button></div></section>
        <div className="stat-row"><div className="stat-card"><div className="stat-icon mint"><Zap size={19} /></div><div><small>Total XP</small><strong>{xp.toLocaleString()}<span>pts</span></strong></div></div><div className="stat-card"><div className="stat-icon coral"><BookOpen size={19} /></div><div><small>Subjects</small><strong>{subjects.length}</strong></div></div><div className="stat-card"><div className="stat-icon gold"><Trophy size={19} /></div><div><small>Best progress</small><strong>{subjects.length ? Math.max(...subjects.map((subject) => subject.progress)) : 0}<span>%</span></strong></div></div></div>
      </div>
      <section className="card week-card"><div className="card-head"><div><h2>Your practice exams</h2><p>Recently saved by you</p></div><button className="text-link" onClick={() => onNavigate("Exams")}>All exams <ArrowRight size={14} /></button></div>{plans.length ? plans.map((plan) => <div className="exam-row" key={plan.id}><div className="exam-icon"><BookOpen size={17} /></div><div><strong>{plan.title}</strong><small>{subjects.find((subject) => subject.id === plan.subject_id)?.name ?? "Subject"} · {plan.question_count} questions</small></div></div>) : <p className="empty-copy">No saved exams yet.</p>}</section>
    </div>
    <div className="section-row"><div><h2>Shared learning catalog</h2><p>Subjects and your recorded accuracy.</p></div><button className="text-link" onClick={() => onNavigate("Play & Study")}>Open study <ArrowRight size={14} /></button></div>
    <div className="subject-grid">{visibleSubjects.length ? visibleSubjects.map((subject) => <button className="subject-card" key={subject.id} onClick={() => onNavigate("Play & Study")}><div className="subject-top"><span className={`subject-icon ${subject.tone}`}>{subject.icon}</span><ArrowRight size={15} color="var(--muted)" /></div><h3>{subject.name}</h3><p>{subject.detail}</p><div className="progress-line"><span style={{ width: `${subject.progress}%` }} /></div><div className="progress-caption"><span>Accuracy</span><span>{subject.progress}%</span></div></button>) : <div className="empty-state">{query ? `No subjects match “${query}”.` : "The shared catalog is empty."}</div>}</div>
    <div className="section-row"><div><h2>Leaderboard</h2><p>Ranked by recorded XP.</p></div><button className="text-link" onClick={() => onNavigate("Leaderboard")}>Full rankings <ArrowRight size={14} /></button></div>
    <section className="card">{leaders.length ? leaders.map((student, index) => <div className="rank-row" key={student.id}><span className="rank-num">{index + 1}</span><span className="avatar">{student.display_name.slice(0, 2).toUpperCase() || "ST"}</span><div className="rank-name"><strong>{student.display_name || "Student"}{student.id === user.id ? " (you)" : ""}</strong><small>StudyPulse member</small></div><span className="rank-points">{student.xp.toLocaleString()} XP</span></div>) : <p className="empty-copy">No rankings yet.</p>}</section>
  </div>;
}
