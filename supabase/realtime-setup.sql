begin;
alter publication supabase_realtime add table public.game_events;
create policy "Game private channels" on realtime.messages for select to authenticated
using (
 realtime.topic() ~ '^game:[a-f0-9-]{36}$'
 and public.game_member(substring(realtime.topic() from 6)::uuid)
);
commit;
