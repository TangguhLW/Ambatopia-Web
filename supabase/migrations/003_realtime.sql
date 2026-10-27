begin;
create table public.game_messages (
 id uuid primary key default gen_random_uuid(),world_id uuid not null references public.game_worlds(id) on delete cascade,
 user_id uuid not null references public.game_profiles(id),text text not null check(char_length(text) between 1 and 240),
 request_id uuid not null,created_at timestamptz not null default now(),unique(user_id,request_id)
);
create index game_messages_world on public.game_messages(world_id,created_at);
alter table public.game_messages enable row level security;
revoke all on public.game_messages from anon,authenticated;
grant all on public.game_messages to service_role;

create function public.game_move(p_world uuid,p_x numeric,p_y numeric,p_facing text,p_animation text,p_sequence bigint) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();m public.game_memberships;god boolean;
begin
 if p_x is null or p_y is null or p_x::text in ('NaN','Infinity','-Infinity') or p_y::text in ('NaN','Infinity','-Infinity') or p_x<0 or p_x>99 or p_y<0 or p_y>59 then raise exception 'INVALID_POSITION'; end if;
 if p_facing not in ('left','right') or p_animation not in ('idle','walk','jump') or p_sequence is null or p_sequence<1 then raise exception 'INVALID_POSITION'; end if;
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED'; end if;
 select * into m from public.game_memberships where user_id=actor for update;
 if p_sequence<=m.sequence then return false; end if;
 select role='superadmin' and god_mode into god from public.game_profiles where id=actor;
 if not god and (abs(p_x-m.x)>greatest(2,extract(epoch from(clock_timestamp()-m.moved_at))*12) or abs(p_y-m.y)>greatest(3,extract(epoch from(clock_timestamp()-m.moved_at))*20)) then raise exception 'MOVE_TOO_FAST'; end if;
 if not public.game_rate('move:'||actor,1,8) then raise exception 'RATE_LIMITED'; end if;
 update public.game_memberships set x=p_x,y=p_y,facing=p_facing,animation=p_animation,sequence=p_sequence,seen_at=now(),moved_at=clock_timestamp() where user_id=actor;
 insert into public.game_events(world_id,kind,payload) values(p_world,'move',jsonb_build_object('user_id',actor,'x',p_x,'y',p_y,'facing',p_facing,'animation',p_animation,'sequence',p_sequence));
 return true;
end $$;
create function public.game_chat(p_world uuid,p_text text,p_request_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();msg uuid;v_name text;
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select id into msg from public.game_messages where user_id=actor and request_id=p_request_id;
 if found then return msg; end if;
 if p_text is null or char_length(trim(p_text)) not between 1 and 240 then raise exception 'INVALID_MESSAGE'; end if;
 if not public.game_rate('chat:'||actor,10,5) then raise exception 'RATE_LIMITED'; end if;
 insert into public.game_messages(world_id,user_id,text,request_id) values(p_world,actor,p_text,p_request_id) returning id into msg;
 select grow_id into v_name from public.game_profiles where id=actor;
 insert into public.game_events(world_id,kind,payload) values(p_world,'chat',jsonb_build_object('id',msg,'user_id',actor,'grow_id',v_name,'text',p_text,'created_at',now()));
 return msg;
end $$;
create function public.game_chat_history(p_world uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from (
 select m.id,m.user_id,p.grow_id,m.text,m.created_at from public.game_messages m join public.game_profiles p on p.id=m.user_id where m.world_id=p_world order by m.created_at desc limit 50)t),'[]'::jsonb);
end $$;
create function public.game_set_appearance(p_appearance jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();color text;
begin
 if jsonb_typeof(p_appearance)<>'object' or p_appearance-'color'<>'{}'::jsonb then raise exception 'INVALID_APPEARANCE'; end if;
 color:=p_appearance->>'color';
 if color is null or color not in ('blue','green','pink','orange','purple','white') then raise exception 'INVALID_APPEARANCE'; end if;
 update public.game_profiles set appearance=p_appearance where id=actor;
 insert into public.game_events(world_id,kind,payload) select world_id,'appearance',jsonb_build_object('user_id',actor,'appearance',p_appearance) from public.game_memberships where user_id=actor;
 return p_appearance;
end $$;
create function public.game_prune() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from public.game_memberships where seen_at<now()-interval '60 seconds';
 delete from public.game_events where created_at<now()-interval '10 minutes';
 delete from public.game_messages where created_at<now()-interval '7 days';
 delete from public.game_rate_limits where window_start<now()-interval '2 days';
 delete from public.game_requests where created_at<now()-interval '7 days';
end $$;
revoke all on function public.game_move(uuid,numeric,numeric,text,text,bigint),public.game_chat(uuid,text,uuid),public.game_chat_history(uuid),public.game_set_appearance(jsonb),public.game_prune() from public,anon,authenticated;
grant execute on function public.game_move(uuid,numeric,numeric,text,text,bigint),public.game_chat(uuid,text,uuid),public.game_chat_history(uuid),public.game_set_appearance(jsonb) to authenticated;
grant execute on function public.game_prune() to service_role;
-- Supabase-specific publication and private channel policies are installed separately,
-- allowing these migrations to execute against an isolated Postgres test database.
insert into public.game_schema_versions(version) values(3);
commit;
