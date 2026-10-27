create or replace function public.game_set_appearance(p_appearance jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor(); value jsonb; k text;
begin
 if p_appearance is null or jsonb_typeof(p_appearance)<>'object' or octet_length(p_appearance::text)>1024 or p_appearance-array['color','outfit','skin','hc','ec','lc']<>'{}'::jsonb then raise exception 'INVALID_APPEARANCE'; end if;
 if p_appearance ? 'color' and coalesce(p_appearance->>'color','') not in ('blue','green','pink','orange','purple','white') then raise exception 'INVALID_APPEARANCE'; end if;
 if p_appearance ? 'outfit' then
  if jsonb_typeof(p_appearance->'outfit')<>'array' then raise exception 'INVALID_APPEARANCE'; end if;
  if jsonb_array_length(p_appearance->'outfit')<>10 then raise exception 'INVALID_APPEARANCE'; end if;
  for value in select * from jsonb_array_elements(p_appearance->'outfit') loop
   if jsonb_typeof(value)<>'number' or value::text !~ '^[0-9]{1,7}$' or (value::text)::numeric>1000000 then raise exception 'INVALID_APPEARANCE'; end if;
  end loop;
 end if;
 if p_appearance ? 'skin' and p_appearance->'skin'<>'null'::jsonb then
  if jsonb_typeof(p_appearance->'skin')<>'array' then raise exception 'INVALID_APPEARANCE'; end if;
  if jsonb_array_length(p_appearance->'skin')<>3 then raise exception 'INVALID_APPEARANCE'; end if;
  for value in select * from jsonb_array_elements(p_appearance->'skin') loop
   if jsonb_typeof(value)<>'number' or value::text !~ '^[0-9]{1,3}$' or (value::text)::numeric>255 then raise exception 'INVALID_APPEARANCE'; end if;
  end loop;
 end if;
 foreach k in array array['hc','ec','lc'] loop
  if p_appearance ? k and (jsonb_typeof(p_appearance->k)<>'string' or p_appearance->>k !~ '^(#[a-fA-F0-9]{6})?$') then raise exception 'INVALID_APPEARANCE'; end if;
 end loop;
 if not public.game_rate('appearance:'||actor,10,10) then raise exception 'RATE_LIMIT'; end if;
 update public.game_profiles set appearance=p_appearance where id=actor;
 insert into public.game_events(world_id,kind,payload) select world_id,'appearance',jsonb_build_object('user_id',actor,'appearance',p_appearance) from public.game_memberships where user_id=actor;
 return p_appearance;
end $$;
