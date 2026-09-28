-- Update only plan fields so a concurrent practice sync cannot be overwritten.
create or replace function public.queue_coach_focus(p_user uuid, p_ids jsonb, p_now bigint)
returns void language sql security definer set search_path = public as $$
  insert into public.progress(user_id, doc, updated_at)
  values (p_user, jsonb_build_object('version', 1, 'focus', p_ids, 'focusUpdatedAt', p_now, 'updatedAt', p_now), now())
  on conflict (user_id) do update set
    doc = progress.doc || jsonb_build_object('focus', p_ids, 'focusUpdatedAt', p_now, 'updatedAt', p_now),
    updated_at = now();
$$;
revoke all on function public.queue_coach_focus(uuid, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.queue_coach_focus(uuid, jsonb, bigint) to service_role;
