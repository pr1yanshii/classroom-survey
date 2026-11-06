-- Classroom Survey — editor, duplication, results, and public status functions
-- Run after 20261105000000_initial_schema.sql.

-- ---------------------------------------------------------------------------
-- RPC: save_survey (instructor)
-- Creates or updates a survey with its questions and choices in one transaction.
-- Existing question/choice IDs are preserved so recorded answers stay linked.
--
-- p_questions: [
--   { "id": "uuid|null", "question_text": "...", "question_type": "multiple_choice",
--     "choices": [ { "id": "uuid|null", "choice_text": "..." } ] }
-- ]
-- Array order defines position (1-based).
-- ---------------------------------------------------------------------------

create or replace function save_survey(
    p_survey_id uuid,
    p_title text,
    p_description text,
    p_questions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
    v_survey_id uuid := p_survey_id;
    v_status text;
    v_question jsonb;
    v_question_id uuid;
    v_choice jsonb;
    v_choice_id uuid;
    v_qpos int := 0;
    v_cpos int;
    v_keep_questions uuid[] := '{}';
    v_keep_choices uuid[];
begin
    if p_title is null or length(trim(p_title)) = 0 then
        raise exception 'INVALID_SURVEY: title is required';
    end if;

    if p_questions is null or jsonb_typeof(p_questions) <> 'array'
       or jsonb_array_length(p_questions) = 0 then
        raise exception 'INVALID_SURVEY: at least one question is required';
    end if;

    if v_survey_id is null then
        insert into surveys (title, description)
        values (trim(p_title), nullif(trim(p_description), ''))
        returning id into v_survey_id;
    else
        select status into v_status from surveys where id = v_survey_id for update;
        if not found then
            raise exception 'SURVEY_NOT_FOUND';
        end if;
        if v_status = 'active' then
            raise exception 'SURVEY_IS_ACTIVE';
        end if;
        update surveys
        set title = trim(p_title), description = nullif(trim(p_description), '')
        where id = v_survey_id;
    end if;

    -- Collect IDs of questions that remain, then delete the rest.
    select coalesce(array_agg((q->>'id')::uuid), '{}') into v_keep_questions
    from jsonb_array_elements(p_questions) q
    where q->>'id' is not null;

    delete from questions
    where survey_id = v_survey_id and not (id = any(v_keep_questions));

    for v_question in select * from jsonb_array_elements(p_questions) loop
        v_qpos := v_qpos + 1;

        if coalesce(length(trim(v_question->>'question_text')), 0) = 0 then
            raise exception 'INVALID_SURVEY: question % has no text', v_qpos;
        end if;
        if v_question->>'question_type' not in ('multiple_choice', 'true_false') then
            raise exception 'INVALID_SURVEY: question % has an invalid type', v_qpos;
        end if;
        if jsonb_typeof(v_question->'choices') <> 'array'
           or jsonb_array_length(v_question->'choices') < 2 then
            raise exception 'INVALID_SURVEY: question % needs at least two choices', v_qpos;
        end if;

        v_question_id := (v_question->>'id')::uuid;

        if v_question_id is not null then
            update questions
            set question_text = trim(v_question->>'question_text'),
                question_type = v_question->>'question_type',
                position = v_qpos
            where id = v_question_id and survey_id = v_survey_id;
            if not found then
                raise exception 'INVALID_QUESTION';
            end if;
        else
            insert into questions (survey_id, question_text, question_type, position)
            values (v_survey_id, trim(v_question->>'question_text'),
                    v_question->>'question_type', v_qpos)
            returning id into v_question_id;
        end if;

        select coalesce(array_agg((c->>'id')::uuid), '{}') into v_keep_choices
        from jsonb_array_elements(v_question->'choices') c
        where c->>'id' is not null;

        delete from choices
        where question_id = v_question_id and not (id = any(v_keep_choices));

        v_cpos := 0;
        for v_choice in select * from jsonb_array_elements(v_question->'choices') loop
            v_cpos := v_cpos + 1;

            if coalesce(length(trim(v_choice->>'choice_text')), 0) = 0 then
                raise exception 'INVALID_SURVEY: question % has an empty choice', v_qpos;
            end if;

            v_choice_id := (v_choice->>'id')::uuid;

            if v_choice_id is not null then
                update choices
                set choice_text = trim(v_choice->>'choice_text'), position = v_cpos
                where id = v_choice_id and question_id = v_question_id;
                if not found then
                    raise exception 'INVALID_CHOICE';
                end if;
            else
                insert into choices (question_id, choice_text, position)
                values (v_question_id, trim(v_choice->>'choice_text'), v_cpos);
            end if;
        end loop;
    end loop;

    return v_survey_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: duplicate_survey (instructor)
-- Copies title ("Copy of ..."), description, questions, choices. Not responses.
-- ---------------------------------------------------------------------------

create or replace function duplicate_survey(p_survey_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
    v_new_id uuid;
    v_question record;
    v_new_question_id uuid;
begin
    insert into surveys (title, description, status)
    select 'Copy of ' || title, description, 'draft'
    from surveys where id = p_survey_id
    returning id into v_new_id;

    if v_new_id is null then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    for v_question in
        select * from questions where survey_id = p_survey_id order by position
    loop
        insert into questions (survey_id, question_text, question_type, position)
        values (v_new_id, v_question.question_text, v_question.question_type, v_question.position)
        returning id into v_new_question_id;

        insert into choices (question_id, choice_text, position)
        select v_new_question_id, choice_text, position
        from choices where question_id = v_question.id;
    end loop;

    return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: survey_choice_counts (instructor)
-- Answer count per choice for a survey. Runs under RLS (anon gets nothing).
-- ---------------------------------------------------------------------------

create or replace function survey_choice_counts(p_survey_id uuid)
returns table (question_id uuid, choice_id uuid, answer_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
    select q.id, c.id, count(a.id)
    from questions q
    join choices c on c.question_id = q.id
    left join answers a on a.choice_id = c.id
    where q.survey_id = p_survey_id
    group by q.id, c.id;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_survey_status (public)
-- Lets the student page tell "closed" apart from "not found" without
-- exposing anything else about non-active surveys.
-- ---------------------------------------------------------------------------

create or replace function get_survey_status(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select status from surveys where public_slug = p_slug;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke all on function save_survey(uuid, text, text, jsonb) from public, anon;
revoke all on function duplicate_survey(uuid) from public, anon;
revoke all on function survey_choice_counts(uuid) from public, anon;
revoke all on function get_survey_status(text) from public;

grant execute on function save_survey(uuid, text, text, jsonb) to authenticated;
grant execute on function duplicate_survey(uuid) to authenticated;
grant execute on function survey_choice_counts(uuid) to authenticated;
grant execute on function get_survey_status(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges (explicit, so security does not depend on project defaults)
-- RLS policies above still decide which rows each role can see or change.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

revoke all on surveys, questions, choices, responses, answers from anon;
grant select on surveys, questions, choices to anon;

grant select, insert, update, delete
    on surveys, questions, choices, responses, answers to authenticated;
