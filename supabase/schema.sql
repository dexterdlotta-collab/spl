create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  xp integer not null default 0 check (xp >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.create_profile_for_user();

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  description text not null default '',
  icon text not null default 'S',
  tone text not null default 'mint' check (tone in ('mint', 'coral', 'blue', 'gold')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  prompt text not null check (length(trim(prompt)) > 0),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  correct_answer text not null check (length(trim(correct_answer)) > 0),
  created_by uuid not null references public.profiles (id) on delete cascade,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  front text not null check (length(trim(front)) between 1 and 500),
  back text not null check (length(trim(back)) between 1 and 2000),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.subject_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  answered integer not null default 0,
  correct integer not null default 0,
  last_studied_at timestamptz,
  primary key (user_id, subject_id),
  check (correct <= answered)
);

create table if not exists public.answer_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.answer_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table if not exists public.exam_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  question_count integer not null check (question_count between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exam_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  total_questions integer not null check (total_questions > 0),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create or replace function public.add_room_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.room_members (room_id, user_id) values (new.id, new.created_by);
  return new;
end;
$$;

drop trigger if exists on_room_created on public.study_rooms;
create trigger on_room_created
after insert on public.study_rooms
for each row execute procedure public.add_room_creator_as_member();

create or replace function public.grade_answer(p_question_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject_id uuid;
  v_question_author uuid;
  v_correct_answer text;
  v_is_correct boolean;
  v_rewarded_question_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select subject_id, correct_answer, created_by
  into v_subject_id, v_correct_answer, v_question_author
  from public.questions
  where id = p_question_id and published = true;

  if not found then
    raise exception 'Question not found';
  end if;

  v_is_correct := lower(trim(coalesce(p_answer, ''))) = lower(trim(v_correct_answer));
  insert into public.answer_events (user_id, question_id, subject_id, is_correct)
  values (auth.uid(), p_question_id, v_subject_id, v_is_correct);
  insert into public.subject_progress (user_id, subject_id, answered, correct, last_studied_at)
  values (auth.uid(), v_subject_id, 1, case when v_is_correct then 1 else 0 end, now())
  on conflict (user_id, subject_id) do update
  set answered = public.subject_progress.answered + 1,
      correct = public.subject_progress.correct + excluded.correct,
      last_studied_at = now();

  if v_is_correct and v_question_author <> auth.uid() then
    insert into public.answer_rewards (user_id, question_id)
    values (auth.uid(), p_question_id)
    on conflict (user_id, question_id) do nothing
    returning question_id into v_rewarded_question_id;
    if v_rewarded_question_id is not null then
      update public.profiles set xp = xp + 25 where id = auth.uid();
    end if;
  end if;

  return jsonb_build_object('correct', v_is_correct, 'xp_awarded', v_rewarded_question_id is not null);
end;
$$;

grant execute on function public.grade_answer(uuid, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.questions enable row level security;
alter table public.flashcards enable row level security;
alter table public.subject_progress enable row level security;
alter table public.answer_events enable row level security;
alter table public.answer_rewards enable row level security;
alter table public.exam_plans enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.study_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_messages enable row level security;

revoke all on public.profiles, public.subjects, public.questions, public.flashcards, public.subject_progress, public.answer_events, public.answer_rewards, public.exam_plans, public.exam_attempts, public.study_rooms, public.room_members, public.room_messages from anon, authenticated;
revoke all on function public.grade_answer(uuid, text) from public, anon;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert on public.subjects to authenticated;
grant update (name, description, icon, tone) on public.subjects to authenticated;
grant delete on public.subjects to authenticated;
grant select (id, subject_id, prompt, options, created_by, published, created_at) on public.questions to authenticated;
grant insert (subject_id, prompt, options, correct_answer, created_by, published) on public.questions to authenticated;
grant select (id, subject_id, front, back, created_by, created_at) on public.flashcards to authenticated;
grant insert (subject_id, front, back, created_by) on public.flashcards to authenticated;
grant select on public.subject_progress, public.answer_events to authenticated;
grant select, insert, update, delete on public.exam_plans, public.exam_attempts to authenticated;
grant select, insert, update, delete on public.study_rooms to authenticated;
grant select, insert, delete on public.room_members to authenticated;
grant select, insert on public.room_messages to authenticated;

create policy "Authenticated users can read profiles" on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Authenticated users can read subjects" on public.subjects for select to authenticated using (true);
create policy "Authenticated users can add shared subjects" on public.subjects for insert to authenticated with check (created_by = auth.uid());
create policy "Creators can edit their subjects" on public.subjects for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "Creators can delete their subjects" on public.subjects for delete to authenticated using (created_by = auth.uid());
create policy "Authenticated users can read published questions" on public.questions for select to authenticated using (published = true);
create policy "Authenticated users can add questions" on public.questions for insert to authenticated with check (created_by = auth.uid());
create policy "Authenticated users can read shared flashcards" on public.flashcards for select to authenticated using (true);
create policy "Authenticated users can add flashcards" on public.flashcards for insert to authenticated with check (created_by = auth.uid());
create policy "Users can read their own progress" on public.subject_progress for select to authenticated using (user_id = auth.uid());
create policy "Users can read their own answer events" on public.answer_events for select to authenticated using (user_id = auth.uid());
create policy "Users manage their exam plans" on public.exam_plans for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Users manage their exam attempts" on public.exam_attempts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Authenticated users can read rooms" on public.study_rooms for select to authenticated using (true);
create policy "Users can create rooms" on public.study_rooms for insert to authenticated with check (created_by = auth.uid());
create policy "Room owners can update rooms" on public.study_rooms for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "Room owners can delete rooms" on public.study_rooms for delete to authenticated using (created_by = auth.uid());
create policy "Users can read their room memberships" on public.room_members for select to authenticated using (user_id = auth.uid());
create policy "Users can join rooms as themselves" on public.room_members for insert to authenticated with check (user_id = auth.uid());
create policy "Users can leave rooms" on public.room_members for delete to authenticated using (user_id = auth.uid());
create policy "Room members can read messages" on public.room_messages for select to authenticated using (exists (select 1 from public.room_members where room_id = room_messages.room_id and user_id = auth.uid()));
create policy "Room members can send messages as themselves" on public.room_messages for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.room_members where room_id = room_messages.room_id and user_id = auth.uid()));

create index if not exists questions_subject_idx on public.questions (subject_id, published);
create index if not exists answer_events_user_created_idx on public.answer_events (user_id, created_at desc);
create index if not exists answer_rewards_user_idx on public.answer_rewards (user_id);
create index if not exists exam_plans_owner_idx on public.exam_plans (owner_id, created_at desc);
create index if not exists room_messages_room_created_idx on public.room_messages (room_id, created_at);

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['subjects', 'room_messages'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
