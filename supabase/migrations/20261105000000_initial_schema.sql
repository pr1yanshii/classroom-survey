-- Classroom Survey — initial schema
-- Source of truth: DATABASE.md and API.md
-- Run in the Supabase SQL editor or via `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table surveys (
    id uuid primary key default gen_random_uuid(),
    title text not null check (length(trim(title)) > 0),
    description text,
    status text not null default 'draft'
        check (status in ('draft', 'active', 'closed', 'archived')),
    public_slug text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table questions (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references surveys(id) on delete cascade,
    question_text text not null,
    question_type text not null
        check (question_type in ('multiple_choice', 'true_false')),
    position integer not null,
    created_at timestamptz not null default now()
);

create table choices (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references questions(id) on delete cascade,
    choice_text text not null,
    position integer not null,
    created_at timestamptz not null default now()
);

create table responses (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references surveys(id) on delete cascade,
    anonymous_token text,
    submitted_at timestamptz not null default now()
);

create table answers (
    id uuid primary key default gen_random_uuid(),
    response_id uuid not null references responses(id) on delete cascade,
    question_id uuid not null references questions(id) on delete cascade,
    choice_id uuid references choices(id) on delete set null,
    text_answer text,
    created_at timestamptz not null default now(),
    unique (response_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index surveys_status_idx on surveys(status);
create index questions_survey_id_idx on questions(survey_id);
create index choices_question_id_idx on choices(question_id);
create index responses_survey_id_idx on responses(survey_id);
create index responses_submitted_at_idx on responses(submitted_at);
create index answers_response_id_idx on answers(response_id);
create index answers_question_id_idx on answers(question_id);
create index answers_choice_id_idx on answers(choice_id);

-- One submission per browser token per survey
create unique index responses_unique_student_per_survey
    on responses(survey_id, anonymous_token)
    where anonymous_token is not null;

-- At most one Active survey
create unique index only_one_active_survey
    on surveys ((status))
    where status = 'active';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger surveys_updated_at
before update on surveys
for each row
execute function update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table surveys enable row level security;
alter table questions enable row level security;
alter table choices enable row level security;
alter table responses enable row level security;
alter table answers enable row level security;

-- Students (anon): read only Active surveys and their questions/choices.
create policy "students read active surveys"
on surveys for select to anon
using (status = 'active');

create policy "students read active survey questions"
on questions for select to anon
using (
    exists (
        select 1 from surveys
        where surveys.id = questions.survey_id
          and surveys.status = 'active'
    )
);

create policy "students read active survey choices"
on choices for select to anon
using (
    exists (
        select 1
        from questions
        join surveys on surveys.id = questions.survey_id
        where questions.id = choices.question_id
          and surveys.status = 'active'
    )
);

-- Students get NO direct access to responses/answers; they submit via RPC.

-- Instructor (single-instructor deployment): any authenticated user has full access.
create policy "authenticated users manage surveys"
on surveys for all to authenticated using (true) with check (true);

create policy "authenticated users manage questions"
on questions for all to authenticated using (true) with check (true);

create policy "authenticated users manage choices"
on choices for all to authenticated using (true) with check (true);

create policy "authenticated users manage responses"
on responses for all to authenticated using (true) with check (true);

create policy "authenticated users manage answers"
on answers for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- RPC: activate_survey
-- Closes any Active survey, assigns a public slug if missing, activates target.
-- ---------------------------------------------------------------------------

create or replace function activate_survey(p_survey_id uuid)
returns table (id uuid, status text, public_slug text)
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_slug text;
    v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
    i int;
begin
    if not exists (select 1 from surveys s where s.id = p_survey_id) then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    if not exists (select 1 from questions q where q.survey_id = p_survey_id) then
        raise exception 'SURVEY_HAS_NO_QUESTIONS';
    end if;

    select s.public_slug into v_slug from surveys s where s.id = p_survey_id;

    while v_slug is null or exists (
        select 1 from surveys s where s.public_slug = v_slug and s.id <> p_survey_id
    ) loop
        v_slug := '';
        for i in 1..6 loop
            v_slug := v_slug || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
        end loop;
    end loop;

    update surveys s set status = 'closed'
    where s.status = 'active' and s.id <> p_survey_id;

    update surveys s set status = 'active', public_slug = v_slug
    where s.id = p_survey_id;

    return query
        select s.id, s.status, s.public_slug from surveys s where s.id = p_survey_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: close_survey
-- ---------------------------------------------------------------------------

create or replace function close_survey(p_survey_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
    update surveys set status = 'closed'
    where id = p_survey_id and status = 'active';
$$;

-- ---------------------------------------------------------------------------
-- RPC: submit_survey_response (callable by anon)
-- Validates and inserts response + answers atomically.
-- p_answers: [{"question_id": "uuid", "choice_id": "uuid"}, ...]
-- ---------------------------------------------------------------------------

create or replace function submit_survey_response(
    p_survey_id uuid,
    p_anonymous_token text,
    p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_response_id uuid;
    v_answer jsonb;
    v_question_id uuid;
    v_choice_id uuid;
begin
    if not exists (select 1 from surveys where id = p_survey_id and status = 'active') then
        raise exception 'SURVEY_NOT_ACTIVE';
    end if;

    if p_anonymous_token is not null and exists (
        select 1 from responses
        where survey_id = p_survey_id and anonymous_token = p_anonymous_token
    ) then
        raise exception 'DUPLICATE_RESPONSE';
    end if;

    if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
        raise exception 'MISSING_REQUIRED_ANSWER';
    end if;

    -- Every question in the survey must be answered exactly once.
    if exists (
        select 1 from questions q
        where q.survey_id = p_survey_id
          and (
            select count(*) from jsonb_array_elements(p_answers) a
            where (a->>'question_id')::uuid = q.id
          ) <> 1
    ) then
        raise exception 'MISSING_REQUIRED_ANSWER';
    end if;

    insert into responses (survey_id, anonymous_token)
    values (p_survey_id, p_anonymous_token)
    returning id into v_response_id;

    for v_answer in select * from jsonb_array_elements(p_answers) loop
        v_question_id := (v_answer->>'question_id')::uuid;
        v_choice_id := (v_answer->>'choice_id')::uuid;

        if not exists (
            select 1 from questions where id = v_question_id and survey_id = p_survey_id
        ) then
            raise exception 'INVALID_QUESTION';
        end if;

        if v_choice_id is null or not exists (
            select 1 from choices where id = v_choice_id and question_id = v_question_id
        ) then
            raise exception 'INVALID_CHOICE';
        end if;

        insert into answers (response_id, question_id, choice_id)
        values (v_response_id, v_question_id, v_choice_id);
    end loop;

    return jsonb_build_object('success', true, 'response_id', v_response_id);
exception
    when unique_violation then
        raise exception 'DUPLICATE_RESPONSE';
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke all on function activate_survey(uuid) from public, anon;
revoke all on function close_survey(uuid) from public, anon;
revoke all on function submit_survey_response(uuid, text, jsonb) from public;

grant execute on function activate_survey(uuid) to authenticated;
grant execute on function close_survey(uuid) to authenticated;
grant execute on function submit_survey_response(uuid, text, jsonb) to anon, authenticated;
