-- Run after migration inside a transaction which the caller rolls back.
do $$
begin
  assert to_regclass('public.game_profiles') is not null, 'profiles missing';
  assert not has_table_privilege('anon','public.game_profiles','INSERT'), 'anon can create profiles';
  assert not has_table_privilege('authenticated','public.game_profiles','UPDATE'), 'player can mutate identity';
  assert not has_table_privilege('authenticated','public.game_account_identities','SELECT'), 'identity mapping exposed';
  assert not has_function_privilege('authenticated','public.game_register(uuid,text,text,boolean)','EXECUTE'), 'player can provision roles';
  assert (select relrowsecurity from pg_class where oid='public.game_profiles'::regclass), 'RLS missing';
end $$;
