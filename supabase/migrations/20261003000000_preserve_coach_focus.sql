-- A headset with an older local plan must not erase a newly queued phone plan.
create or replace function public.preserve_newer_coach_focus()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce((old.doc->>'focusUpdatedAt')::numeric, 0) > coalesce((new.doc->>'focusUpdatedAt')::numeric, 0) then
    new.doc := new.doc || jsonb_build_object(
      'focus', coalesce(old.doc->'focus', '[]'::jsonb),
      'focusUpdatedAt', old.doc->'focusUpdatedAt'
    );
  end if;
  return new;
end;
$$;
create trigger preserve_newer_coach_focus
before update on public.progress
for each row execute function public.preserve_newer_coach_focus();
