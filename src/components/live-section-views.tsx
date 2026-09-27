"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Check, Crown, MessageCircle, Pencil, Plus, Save, Send, Star, Trash2, Trophy, X } from "lucide-react";
import { type Section, type Subject } from "@/lib/study-data";
import { createClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/types";
import { VoiceCall } from "@/components/voice-call";

type User = { id: string; email: string; displayName: string };
type Question = Pick<Database["public"]["Tables"]["questions"]["Row"], "id" | "subject_id" | "prompt" | "options">;
type ExamPlan = Database["public"]["Tables"]["exam_plans"]["Row"];
type Room = Database["public"]["Tables"]["study_rooms"]["Row"];
type Message = { id: string; user_id: string; content: string; created_at: string; display_name: string };

function Heading({ title, copy }: { title: string; copy: string }) {
  return <div className="view-heading"><p className="eyebrow">StudyPulse workspace</p><h1>{title}</h1><p>{copy}</p></div>;
}

function optionList(options: Json): string[] {
  return Array.isArray(options) ? options.filter((option): option is string => typeof option === "string") : [];
}

export function StudyView({ subjects, user, onAddSubject, onUpdateSubject, onDeleteSubject, onAccountRefresh }: { subjects: Subject[]; user: User; onAddSubject: (subject: Omit<Subject, "id" | "progress" | "createdBy">) => Promise<Subject | null>; onUpdateSubject: (subjectId: string, changes: { name: string; detail: string }) => Promise<string | null>; onDeleteSubject: (subjectId: string) => Promise<string | null>; onAccountRefresh: () => Promise<void> }) {
  const [supabase] = useState(createClient);
  const [subjectId, setSubjectId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [flashcards, setFlashcards] = useState<{ id: string; front: string; back: string }[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [subjectDetail, setSubjectDetail] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");
  const [editingSubjectDetail, setEditingSubjectDetail] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState(false);
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [flashcardForm, setFlashcardForm] = useState(false);
  const [flashcardFront, setFlashcardFront] = useState("");
  const [flashcardBack, setFlashcardBack] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId(subjects[0]?.id ?? "");
      setActiveQuestion(null);
      setFeedback("");
    }
  }, [subjects, subjectId]);

  useEffect(() => {
    if (!subjectId) { setQuestions([]); setFlashcards([]); return; }
    let active = true;
    async function loadContent() {
      const [questionResult, flashcardResult] = await Promise.all([
        supabase.from("questions").select("id,subject_id,prompt,options").eq("subject_id", subjectId).eq("published", true).order("created_at", { ascending: false }),
        supabase.from("flashcards").select("id,front,back").eq("subject_id", subjectId).order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      setQuestions(questionResult.data ?? []);
      setFlashcards(flashcardResult.data ?? []);
      setError(questionResult.error?.message ?? flashcardResult.error?.message ?? "");
    }
    void loadContent();
    return () => { active = false; };
  }, [subjectId, supabase]);

  async function saveSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = subjectName.trim();
    if (!name) return;
    const saved = await onAddSubject({ name, detail: subjectDetail.trim(), tone: "mint", icon: name.slice(0, 1).toUpperCase() });
    if (!saved) { setError("Could not save this subject. It may already exist."); return; }
    setSubjectId(saved.id);
    setSubjectName(""); setSubjectDetail(""); setAddingSubject(false); setError("");
  }

  async function saveSubjectChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSubjectId) return;
    const name = editingSubjectName.trim();
    if (!name) return;
    setSavingSubject(true);
    const updateError = await onUpdateSubject(editingSubjectId, { name, detail: editingSubjectDetail.trim() });
    setSavingSubject(false);
    if (updateError) { setError(updateError); return; }
    setEditingSubjectId(null); setError("");
  }

  async function removeSubject(subject: Subject) {
    const message = `Delete "${subject.name}"? Its questions, flashcards, exams, and related study history will also be deleted.`;
    if (!window.confirm(message)) return;
    setDeletingSubjectId(subject.id);
    const deleteError = await onDeleteSubject(subject.id);
    setDeletingSubjectId(null);
    if (deleteError) { setError(deleteError); return; }
    setEditingSubjectId(null); setError("");
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const options = questionOptions.split("\n").map((option) => option.trim()).filter(Boolean);
    if (!subjectId || options.length < 2 || !options.some((option) => option.toLowerCase() === questionAnswer.trim().toLowerCase())) {
      setError("Add at least two options and make the correct answer match one of them."); return;
    }
    const { error: insertError } = await supabase.from("questions").insert({ subject_id: subjectId, prompt: questionPrompt.trim(), options, correct_answer: questionAnswer.trim(), created_by: user.id, published: true });
    if (insertError) { setError(insertError.message); return; }
    setQuestionPrompt(""); setQuestionOptions(""); setQuestionAnswer(""); setQuestionForm(false); setError("");
    const { data } = await supabase.from("questions").select("id,subject_id,prompt,options").eq("subject_id", subjectId).eq("published", true).order("created_at", { ascending: false });
    setQuestions(data ?? []);
  }

  async function saveFlashcard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subjectId) return;
    const { error: insertError } = await supabase.from("flashcards").insert({ subject_id: subjectId, front: flashcardFront.trim(), back: flashcardBack.trim(), created_by: user.id });
    if (insertError) { setError(insertError.message); return; }
    setFlashcardFront(""); setFlashcardBack(""); setFlashcardForm(false); setError("");
    const { data } = await supabase.from("flashcards").select("id,front,back").eq("subject_id", subjectId).order("created_at", { ascending: false });
    setFlashcards(data ?? []);
  }

  async function gradeAnswer() {
    if (!activeQuestion || !answer) return;
    const { data, error: gradeError } = await supabase.rpc("grade_answer", { p_question_id: activeQuestion.id, p_answer: answer });
    if (gradeError) { setError(gradeError.message); return; }
    setFeedback(data.correct ? data.xp_awarded ? "Correct. 25 XP added." : "Correct. XP for a question is awarded once by another student." : "Not quite. Review the question and try another.");
    await onAccountRefresh();
  }

  return <div className="content"><Heading title="Play & Study" copy="Build and study shared questions and flashcards." />
    <div className="section-row"><div><h2>Shared subjects</h2><p>Study content added by students.</p></div><button className="primary-button" type="button" onClick={() => setAddingSubject(!addingSubject)}><Plus size={14} /> Add subject</button></div>
    {addingSubject && <form className="toolbar" onSubmit={saveSubject}><input aria-label="Subject name" placeholder="Subject name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} maxLength={80} required /><input aria-label="Subject description" placeholder="Description" value={subjectDetail} onChange={(event) => setSubjectDetail(event.target.value)} maxLength={180} /><button className="outline-button">Save subject</button></form>}
    {subjects.some((subject) => subject.createdBy === user.id) && <div className="manage-list" aria-label="Manage your subjects">{subjects.filter((subject) => subject.createdBy === user.id).map((subject) => <div className="manage-row" key={subject.id}>{editingSubjectId === subject.id ? <form className="manage-form" onSubmit={(event) => void saveSubjectChanges(event)}><input aria-label="Edit subject name" value={editingSubjectName} onChange={(event) => setEditingSubjectName(event.target.value)} maxLength={80} required /><input aria-label="Edit subject description" value={editingSubjectDetail} onChange={(event) => setEditingSubjectDetail(event.target.value)} maxLength={180} /><div className="manage-actions"><button className="icon-button" aria-label="Save subject changes" title="Save changes" disabled={savingSubject}><Save size={15} /></button><button className="icon-button" type="button" aria-label="Cancel subject edit" title="Cancel" onClick={() => setEditingSubjectId(null)}><X size={15} /></button></div></form> : <><div className="manage-copy"><strong>{subject.name}</strong><small>{subject.detail || "No description"}</small></div><div className="manage-actions"><button className="icon-button" aria-label={`Edit ${subject.name}`} title="Edit subject" onClick={() => { setEditingSubjectId(subject.id); setEditingSubjectName(subject.name); setEditingSubjectDetail(subject.detail); setError(""); }}><Pencil size={15} /></button><button className="icon-button manage-delete" aria-label={`Delete ${subject.name}`} title="Delete subject" disabled={deletingSubjectId === subject.id} onClick={() => void removeSubject(subject)}><Trash2 size={15} /></button></div></>}</div>)}</div>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {subjects.length === 0 ? <div className="empty-state">No subjects yet. Add the first shared subject to begin.</div> : <><div className="section-row"><div><h2>Question bank</h2><p>{questions.length} shared questions</p></div><select aria-label="Study subject" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setActiveQuestion(null); setFeedback(""); }}>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></div>
      <div className="panel-grid"><section className="card"><div className="card-head"><div><h2>Quick practice</h2><p>Answers are checked by the database.</p></div><button className="outline-button" onClick={() => { const next = questions[Math.floor(Math.random() * questions.length)]; setActiveQuestion(next ?? null); setAnswer(""); setFeedback(""); }} disabled={!questions.length}><ArrowRight size={13} /> New question</button></div>
        {activeQuestion ? <><h3>{activeQuestion.prompt}</h3><div className="quiz-options">{optionList(activeQuestion.options).map((option) => <button className={`quiz-option ${answer === option ? "chosen" : ""}`} key={option} onClick={() => setAnswer(option)}>{option}</button>)}</div><div className="card-head"><p role="status">{feedback || ""}</p><button className="primary-button" disabled={!answer || !!feedback} onClick={() => void gradeAnswer()}>Check answer <Check size={14} /></button></div></> : <p className="empty-copy">{questions.length ? "Choose New question to practice." : "No questions for this subject yet."}</p>}
        <button className="text-link" onClick={() => setQuestionForm(!questionForm)}><Plus size={14} /> Add a question</button>
        {questionForm && <form className="toolbar content-form" onSubmit={saveQuestion}><input aria-label="Question prompt" placeholder="Question" value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} required maxLength={500} /><textarea aria-label="Answer options" placeholder="One answer option per line" value={questionOptions} onChange={(event) => setQuestionOptions(event.target.value)} required rows={4} /><input aria-label="Correct answer" placeholder="Correct answer" value={questionAnswer} onChange={(event) => setQuestionAnswer(event.target.value)} required /><button className="outline-button">Publish question</button></form>}
      </section><section className="card"><div className="card-head"><div><h2>Flashcards</h2><p>{flashcards.length} shared cards</p></div><button className="outline-button" onClick={() => setFlashcardForm(!flashcardForm)}><Plus size={13} /> Add card</button></div>
        {flashcards.length ? flashcards.map((card) => <details className="flashcard-item" key={card.id}><summary>{card.front}</summary><p>{card.back}</p></details>) : <p className="empty-copy">No flashcards for this subject yet.</p>}
        {flashcardForm && <form className="toolbar content-form" onSubmit={saveFlashcard}><input aria-label="Flashcard prompt" placeholder="Front of card" value={flashcardFront} onChange={(event) => setFlashcardFront(event.target.value)} required maxLength={500} /><textarea aria-label="Flashcard answer" placeholder="Back of card" value={flashcardBack} onChange={(event) => setFlashcardBack(event.target.value)} required rows={3} /><button className="outline-button">Publish card</button></form>}
      </section></div></>}
  </div>;
}

export function ExamsView({ subjects, user, onAccountRefresh }: { subjects: Subject[]; user: User; onAccountRefresh: () => Promise<void> }) {
  const [supabase] = useState(createClient);
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [count, setCount] = useState(5);
  const [active, setActive] = useState<{ plan: ExamPlan; questions: Question[]; attemptId: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingPlanTitle, setEditingPlanTitle] = useState("");
  const [editingPlanSubjectId, setEditingPlanSubjectId] = useState("");
  const [editingPlanQuestionCount, setEditingPlanQuestionCount] = useState("5");
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  async function loadPlans() {
    const { data, error: loadError } = await supabase.from("exam_plans").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
    setPlans(data ?? []); setError(loadError?.message ?? "");
  }
  useEffect(() => { if (!subjectId && subjects[0]) setSubjectId(subjects[0].id); }, [subjectId, subjects]);
  useEffect(() => {
    let active = true;
    async function loadInitialPlans() {
      const { data, error: loadError } = await supabase.from("exam_plans").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      if (active) { setPlans(data ?? []); setError(loadError?.message ?? ""); }
    }
    void loadInitialPlans();
    return () => { active = false; };
  }, [supabase, user.id]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subjectId) return;
    const { error: createError } = await supabase.from("exam_plans").insert({ owner_id: user.id, subject_id: subjectId, title: title.trim(), question_count: count });
    if (createError) { setError(createError.message); return; }
    setTitle(""); setError(""); await loadPlans();
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPlanId || !editingPlanTitle.trim() || !editingPlanSubjectId) return;
    const questionCount = Number(editingPlanQuestionCount);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) {
      setError("Question count must be between 1 and 100."); return;
    }
    setSavingPlan(true);
    const { data, error: updateError } = await supabase.from("exam_plans").update({ title: editingPlanTitle.trim(), subject_id: editingPlanSubjectId, question_count: questionCount }).eq("id", editingPlanId).eq("owner_id", user.id).select("*").maybeSingle();
    setSavingPlan(false);
    if (updateError || !data) { setError(updateError?.message ?? "Could not update this exam plan."); return; }
    setPlans((current) => current.map((plan) => plan.id === data.id ? data : plan));
    setEditingPlanId(null); setError("");
  }

  async function deletePlan(plan: ExamPlan) {
    if (!window.confirm(`Delete "${plan.title}" and its saved attempts?`)) return;
    setDeletingPlanId(plan.id);
    const { data, error: deleteError } = await supabase.from("exam_plans").delete().eq("id", plan.id).eq("owner_id", user.id).select("id").maybeSingle();
    setDeletingPlanId(null);
    if (deleteError || !data) { setError(deleteError?.message ?? "Could not delete this exam plan."); return; }
    setPlans((current) => current.filter((item) => item.id !== plan.id));
    setError("");
  }

  async function beginExam(plan: ExamPlan) {
    const { data: bank, error: questionError } = await supabase.from("questions").select("id,subject_id,prompt,options").eq("subject_id", plan.subject_id).eq("published", true);
    if (questionError) { setError(questionError.message); return; }
    const questions = (bank ?? []).sort(() => Math.random() - 0.5).slice(0, plan.question_count);
    if (!questions.length) { setError("This subject has no published questions yet."); return; }
    const { data: attempt, error: attemptError } = await supabase.from("exam_attempts").insert({ exam_id: plan.id, user_id: user.id, score: 0, total_questions: questions.length }).select("id").single();
    if (attemptError || !attempt) { setError(attemptError?.message ?? "Could not start the exam."); return; }
    setActive({ plan, questions, attemptId: attempt.id }); setAnswers({}); setResult(null); setError("");
  }

  async function submitExam() {
    if (!active) return;
    let score = 0;
    for (const question of active.questions) {
      const { data, error: gradeError } = await supabase.rpc("grade_answer", { p_question_id: question.id, p_answer: answers[question.id] ?? "" });
      if (gradeError) { setError(gradeError.message); return; }
      if (data.correct) score += 1;
    }
    const { error: updateError } = await supabase.from("exam_attempts").update({ score, completed_at: new Date().toISOString() }).eq("id", active.attemptId);
    if (updateError) setError(updateError.message);
    setResult(`${score} of ${active.questions.length} correct`);
    await onAccountRefresh();
  }

  return <div className="content"><Heading title="Exam studio" copy="Create exams from the shared question bank." />
    <section className="card"><div className="card-head"><div><h2>Your exam plans</h2><p>Plans and attempts are stored in your account.</p></div><BookOpen size={20} color="var(--green)" /></div>
      <form className="toolbar" onSubmit={createPlan}><input aria-label="Exam title" placeholder="Exam title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} /><select aria-label="Exam subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required><option value="" disabled>Select subject</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select><select aria-label="Question count" value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={5}>5 questions</option><option value={10}>10 questions</option><option value={20}>20 questions</option></select><button className="outline-button" disabled={!subjects.length}><Save size={13} /> Save plan</button></form>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {plans.length ? <div className="exam-list">{plans.map((plan) => <div className="exam-item exam-plan-item" key={plan.id}><span className="exam-icon"><BookOpen size={16} /></span>{editingPlanId === plan.id ? <form className="manage-form exam-edit-form" onSubmit={(event) => void savePlan(event)}><input aria-label="Edit exam title" value={editingPlanTitle} onChange={(event) => setEditingPlanTitle(event.target.value)} maxLength={120} required /><select aria-label="Edit exam subject" value={editingPlanSubjectId} onChange={(event) => setEditingPlanSubjectId(event.target.value)} required>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select><input aria-label="Edit question count" type="number" min={1} max={100} value={editingPlanQuestionCount} onChange={(event) => setEditingPlanQuestionCount(event.target.value)} required /><div className="manage-actions"><button className="icon-button" aria-label="Save exam changes" title="Save changes" disabled={savingPlan}><Save size={15} /></button><button className="icon-button" type="button" aria-label="Cancel exam edit" title="Cancel" onClick={() => setEditingPlanId(null)}><X size={15} /></button></div></form> : <><div className="exam-plan-copy"><strong>{plan.title}</strong><small>{subjects.find((subject) => subject.id === plan.subject_id)?.name ?? "Subject"} · {plan.question_count} questions</small></div><div className="manage-actions">{active?.plan.id !== plan.id && <><button className="icon-button" aria-label={`Edit ${plan.title}`} title="Edit exam" onClick={() => { setEditingPlanId(plan.id); setEditingPlanTitle(plan.title); setEditingPlanSubjectId(plan.subject_id); setEditingPlanQuestionCount(String(plan.question_count)); setError(""); }}><Pencil size={15} /></button><button className="icon-button manage-delete" aria-label={`Delete ${plan.title}`} title="Delete exam" disabled={deletingPlanId === plan.id} onClick={() => void deletePlan(plan)}><Trash2 size={15} /></button></>}<button className="outline-button" disabled={!!active} onClick={() => void beginExam(plan)}>Start</button></div></>}</div>)}</div> : <p className="empty-copy">No exam plans saved yet.</p>}
    </section>
    {active && <section className="card exam-active"><div className="card-head"><div><p className="eyebrow">{subjects.find((subject) => subject.id === active.plan.subject_id)?.name}</p><h2>{active.plan.title}</h2></div><button className="icon-button" aria-label="Close exam" onClick={() => setActive(null)}><X size={16} /></button></div>{active.questions.map((question, index) => <fieldset className="exam-question" key={question.id}><legend>{index + 1}. {question.prompt}</legend>{optionList(question.options).map((option) => <label className="exam-choice" key={option}><input type="radio" name={question.id} checked={answers[question.id] === option} disabled={!!result} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />{option}</label>)}</fieldset>)}{result ? <p className="auth-message" role="status">Result saved: {result}</p> : <button className="primary-button" disabled={active.questions.some((question) => !answers[question.id])} onClick={() => void submitExam()}>Submit exam <Check size={14} /></button>}</section>}
  </div>;
}

export function RoomsView({ subjects, user }: { subjects: Subject[]; user: User }) {
  const [supabase] = useState(createClient);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomTitle, setEditingRoomTitle] = useState("");
  const [editingRoomSubjectId, setEditingRoomSubjectId] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const activeRoomId = activeRoom?.id;

  async function loadRooms() {
    const { data, error: loadError } = await supabase.from("study_rooms").select("*").order("created_at", { ascending: false });
    setRooms(data ?? []); setError(loadError?.message ?? "");
  }
  useEffect(() => {
    let active = true;
    async function loadInitialRooms() {
      const { data, error: loadError } = await supabase.from("study_rooms").select("*").order("created_at", { ascending: false });
      if (active) { setRooms(data ?? []); setError(loadError?.message ?? ""); }
    }
    void loadInitialRooms();
    return () => { active = false; };
  }, [supabase]);

  async function openRoom(room: Room) {
    const { error: joinError } = await supabase.from("room_members").insert({ room_id: room.id, user_id: user.id });
    if (joinError && joinError.code !== "23505") { setError(joinError.message); return; }
    setActiveRoom(room);
  }

  useEffect(() => {
    if (!activeRoomId) { setMessages([]); return; }
    const roomId = activeRoomId;
    let active = true;
    async function loadMessages() {
      const { data, error: messageError } = await supabase.from("room_messages").select("id,user_id,content,created_at").eq("room_id", roomId).order("created_at");
      if (!active) return;
      if (messageError) { setError(messageError.message); return; }
      const senderIds = [...new Set((data ?? []).map((item) => item.user_id))];
      const { data: profiles } = senderIds.length ? await supabase.from("profiles").select("id,display_name").in("id", senderIds) : { data: [] };
      const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
      setMessages((data ?? []).map((item) => ({ ...item, display_name: names.get(item.user_id) || "Student" })));
    }
    void loadMessages();
    const channel = supabase.channel(`room-messages-${roomId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, () => { void loadMessages(); }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [activeRoomId, supabase]);

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data, error: createError } = await supabase.from("study_rooms").insert({ title: title.trim(), subject_id: subjectId || null, created_by: user.id }).select("*").single();
    if (createError || !data) { setError(createError?.message ?? "Could not create room."); return; }
    setTitle(""); setSubjectId(""); setError(""); setActiveRoom(data); await loadRooms();
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRoomId || !editingRoomTitle.trim()) return;
    setSavingRoom(true);
    const { data, error: updateError } = await supabase.from("study_rooms").update({ title: editingRoomTitle.trim(), subject_id: editingRoomSubjectId || null }).eq("id", editingRoomId).eq("created_by", user.id).select("*").maybeSingle();
    setSavingRoom(false);
    if (updateError || !data) { setError(updateError?.message ?? "You can only edit rooms you created."); return; }
    setRooms((current) => current.map((room) => room.id === data.id ? data : room));
    setActiveRoom((current) => current?.id === data.id ? data : current);
    setEditingRoomId(null); setError("");
  }

  async function removeRoom(room: Room) {
    if (!window.confirm(`Delete "${room.title}" and all of its messages?`)) return;
    setDeletingRoomId(room.id);
    const { data, error: deleteError } = await supabase.from("study_rooms").delete().eq("id", room.id).eq("created_by", user.id).select("id").maybeSingle();
    setDeletingRoomId(null);
    if (deleteError || !data) { setError(deleteError?.message ?? "You can only delete rooms you created."); return; }
    setRooms((current) => current.filter((item) => item.id !== room.id));
    setActiveRoom((current) => current?.id === room.id ? null : current);
    setEditingRoomId(null); setError("");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRoom || !message.trim()) return;
    const { error: sendError } = await supabase.from("room_messages").insert({ room_id: activeRoom.id, user_id: user.id, content: message.trim() });
    if (sendError) setError(sendError.message); else setMessage("");
  }

  return <div className="content"><Heading title="Study rooms" copy="Create or join a room for shared text and voice sessions." />
    <section className="card"><div className="card-head"><div><h2>Open rooms</h2><p>Rooms and messages are shared across signed-in students.</p></div></div><form className="toolbar" onSubmit={createRoom}><input aria-label="Room name" placeholder="Room name" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={100} /><select aria-label="Room subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Open study</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select><button className="outline-button"><Plus size={13} /> Create room</button></form>{error && <p className="auth-error" role="alert">{error}</p>}{rooms.length ? rooms.map((room) => <div className="exam-item room-item" key={room.id}><span className="exam-icon"><MessageCircle size={16} /></span>{editingRoomId === room.id ? <form className="manage-form" onSubmit={(event) => void saveRoom(event)}><input aria-label="Edit room name" value={editingRoomTitle} onChange={(event) => setEditingRoomTitle(event.target.value)} maxLength={100} required /><select aria-label="Edit room subject" value={editingRoomSubjectId} onChange={(event) => setEditingRoomSubjectId(event.target.value)}><option value="">Open study</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select><div className="manage-actions"><button className="icon-button" aria-label="Save room changes" title="Save changes" disabled={savingRoom}><Save size={15} /></button><button className="icon-button" type="button" aria-label="Cancel room edit" title="Cancel" onClick={() => setEditingRoomId(null)}><X size={15} /></button></div></form> : <><div className="room-item-copy"><strong>{room.title}</strong><small>{subjects.find((subject) => subject.id === room.subject_id)?.name ?? "Open study"}</small></div><div className="manage-actions">{room.created_by === user.id && <><button className="icon-button" aria-label={`Edit ${room.title}`} title="Edit room" onClick={() => { setEditingRoomId(room.id); setEditingRoomTitle(room.title); setEditingRoomSubjectId(room.subject_id ?? ""); setError(""); }}><Pencil size={15} /></button><button className="icon-button manage-delete" aria-label={`Delete ${room.title}`} title="Delete room" disabled={deletingRoomId === room.id} onClick={() => void removeRoom(room)}><Trash2 size={15} /></button></>}<button className="outline-button" onClick={() => void openRoom(room)}>Join room <ArrowRight size={13} /></button></div></>}</div>) : <p className="empty-copy">No rooms are open yet.</p>}</section>
    {activeRoom && <section className="card room-chat"><div className="card-head"><div><h2>{activeRoom.title}</h2><p>{subjects.find((subject) => subject.id === activeRoom.subject_id)?.name ?? "Open study"}</p></div><button className="icon-button" aria-label="Close room" onClick={() => setActiveRoom(null)}><X size={16} /></button></div><VoiceCall roomId={activeRoom.id} /><div className="chat-log" aria-live="polite">{messages.length ? messages.map((item) => <p className="chat-line" key={item.id}><strong>{item.display_name}: </strong>{item.content}</p>) : <p className="empty-copy">No messages yet.</p>}</div><form className="chat-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Chat message" placeholder="Write a message" maxLength={2000} required /><button className="icon-button" aria-label="Send message"><Send size={15} /></button></form></section>}
  </div>;
}

export function LeaderboardView() {
  const [supabase] = useState(createClient);
  const [leaders, setLeaders] = useState<{ id: string; display_name: string; xp: number }[]>([]);
  useEffect(() => { void supabase.from("profiles").select("id,display_name,xp").order("xp", { ascending: false }).limit(100).then(({ data }) => setLeaders(data ?? [])); }, [supabase]);
  return <div className="content"><Heading title="Leaderboard" copy="Students ranked by XP earned from graded study answers." /><section className="card"><div className="card-head"><div><h2>All students</h2><p>Rankings update from recorded answers.</p></div><Trophy size={20} color="var(--green)" /></div>{leaders.length ? <table className="leaderboard-table"><thead><tr><th>Rank</th><th>Student</th><th>Points</th></tr></thead><tbody>{leaders.map((student, index) => <tr key={student.id}><td>{index === 0 ? <Crown size={15} color="#c2942b" /> : `#${index + 1}`}</td><td>{student.display_name || "Student"}</td><td><strong>{student.xp.toLocaleString()} XP</strong></td></tr>)}</tbody></table> : <p className="empty-copy">No student scores yet.</p>}</section></div>;
}

export function ProfileView({ user, xp, onDisplayNameChange }: { user: User; xp: number; onDisplayNameChange: (name: string) => void }) {
  const [supabase] = useState(createClient);
  const [name, setName] = useState(user.displayName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim();
    const { error: updateError } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    if (updateError) { setError(updateError.message); return; }
    onDisplayNameChange(displayName); setSaved(true); setError("");
  }
  return <div className="content"><Heading title="Your profile" copy="Account details and points earned by your study activity." /><section className="card profile-card"><div className="profile-banner"><span className="avatar">{name.slice(0, 2).toUpperCase() || "ST"}</span><div><h2>{name || "Student"}</h2><p>{user.email}</p></div></div><form className="toolbar" onSubmit={updateProfile}><input aria-label="Display name" value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} maxLength={80} required /><button className="outline-button"><Save size={13} /> Save profile</button></form>{error && <p className="auth-error" role="alert">{error}</p>}{saved && <p className="auth-message" role="status">Profile saved.</p>}<div className="stat-row"><div className="stat-card"><div className="stat-icon mint"><Trophy size={18} /></div><div><small>Total XP</small><strong>{xp.toLocaleString()}</strong></div></div><div className="stat-card"><div className="stat-icon gold"><Star size={18} /></div><div><small>Account</small><strong>Active</strong></div></div></div></section></div>;
}

export function SectionView({ section, xp, subjects, user, onAddSubject, onUpdateSubject, onDeleteSubject, onAccountRefresh, onDisplayNameChange }: { section: Section; xp: number; subjects: Subject[]; user: User; onAddSubject: (subject: Omit<Subject, "id" | "progress" | "createdBy">) => Promise<Subject | null>; onUpdateSubject: (subjectId: string, changes: { name: string; detail: string }) => Promise<string | null>; onDeleteSubject: (subjectId: string) => Promise<string | null>; onAccountRefresh: () => Promise<void>; onDisplayNameChange: (name: string) => void }) {
  if (section === "Play & Study") return <StudyView subjects={subjects} user={user} onAddSubject={onAddSubject} onUpdateSubject={onUpdateSubject} onDeleteSubject={onDeleteSubject} onAccountRefresh={onAccountRefresh} />;
  if (section === "Exams") return <ExamsView subjects={subjects} user={user} onAccountRefresh={onAccountRefresh} />;
  if (section === "Study Rooms") return <RoomsView subjects={subjects} user={user} />;
  if (section === "Leaderboard") return <LeaderboardView />;
  return <ProfileView user={user} xp={xp} onDisplayNameChange={onDisplayNameChange} />;
}