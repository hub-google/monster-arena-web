
-- Profile compatibility: preserve existing Supabase Auth usernames.
create or replace function public.game_ensure_profile()
returns public.users
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_auth record;
  v_profile public.users%rowtype;
  v_name text;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  select * into v_profile from public.users where user_id=v_uid;
  if found then return v_profile; end if;
  select email, raw_user_meta_data into v_auth from auth.users where id=v_uid;
  if not found then raise exception '登入帳號不存在'; end if;
  v_name:=left(trim(coalesce(v_auth.raw_user_meta_data->>'username','')),24);
  if v_name='' then v_name:='玩家_'||left(replace(v_uid::text,'-',''),8); end if;
  if exists(select 1 from public.users where username=v_name and user_id<>v_uid) then
    v_name:=left(v_name,15)||'_'||left(replace(v_uid::text,'-',''),8);
  end if;
  insert into public.users(user_id,username,email,gold,premium_gems,stamina,max_stamina)
    values(v_uid,v_name,coalesce(v_auth.email,v_uid::text||'@monsterarena.app'),500,0,100,100)
    on conflict(user_id) do nothing;
  select * into v_profile from public.users where user_id=v_uid;
  return v_profile;
end; $$;
revoke all on function public.game_ensure_profile() from public,anon;
grant execute on function public.game_ensure_profile() to authenticated;

create or replace function public.game_friend_action(p_mode text,p_peer uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_peer_name text;
  v_own_name text;
  v_changed int;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  if p_peer is null or v_uid=p_peer then raise exception '好友帳號無效'; end if;
  select username into v_peer_name from public.users where user_id=p_peer;
  select username into v_own_name from public.users where user_id=v_uid;
  if v_peer_name is null or v_own_name is null then raise exception '找不到玩家'; end if;
  if p_mode='request' then
    if exists(select 1 from public.friends where user_id=v_uid and friend_uid=p_peer and status=1) then
      raise exception '已經是好友'; end if;
    insert into public.friends(user_id,friend_uid,friend_name,status)
      values(v_uid,p_peer,v_peer_name,0)
      on conflict(user_id,friend_uid) do nothing;
    return jsonb_build_object('message','好友邀請已送出');
  elsif p_mode='accept' then
    update public.friends set status=1 where user_id=p_peer and friend_uid=v_uid and status=0;
    get diagnostics v_changed=row_count;
    if v_changed=0 then raise exception '找不到待處理的好友邀請'; end if;
    insert into public.friends(user_id,friend_uid,friend_name,status)
      values(v_uid,p_peer,v_peer_name,1)
      on conflict(user_id,friend_uid) do update set status=1,friend_name=excluded.friend_name;
    return jsonb_build_object('message','好友邀請已接受');
  else
    raise exception '未知好友操作';
  end if;
end; $$;
revoke all on function public.game_friend_action(text,uuid) from public,anon;
grant execute on function public.game_friend_action(text,uuid) to authenticated;

create or replace function public.game_claim_gifts()
returns integer
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_count int;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  perform 1 from public.users where user_id=v_uid for update;
  with pending as (
    select gift_id from public.gifts where receiver=v_uid::text and claimed=false for update
  ), credited as (
    update public.gifts set claimed=true where gift_id in(select gift_id from pending)
    returning gift_id
  )
  select count(*) into v_count from credited;
  if v_count>0 then
    update public.users set stamina=least(coalesce(max_stamina,100),coalesce(stamina,0)+20*v_count)
      where user_id=v_uid;
  end if;
  return v_count;
end; $$;
revoke all on function public.game_claim_gifts() from public,anon;
grant execute on function public.game_claim_gifts() to authenticated;
