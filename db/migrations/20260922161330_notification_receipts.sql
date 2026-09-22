-- Receipts only: never delete or update the source care/health/stock records.
create table public.notification_receipts (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 household_id uuid not null references public.households(id) on delete cascade,
 notice_id text not null check(length(notice_id) between 1 and 499),
 is_read boolean not null default false,
 dismissed boolean not null default false,
 primary key(user_id,household_id,notice_id)
);
create index notification_receipts_household_idx on public.notification_receipts(household_id);
alter table public.notification_receipts enable row level security;
revoke all on public.notification_receipts from public,anon,authenticated;
grant select,insert,update on public.notification_receipts to authenticated;
create policy receipts_owner on public.notification_receipts for all to authenticated
 using (user_id=(select auth.uid()) and (select private.is_household_member(household_id)))
 with check (user_id=(select auth.uid()) and (select private.is_household_member(household_id)));
create or replace function public.update_notification_receipts(p_household uuid,p_ids text[],p_action text default 'list')
returns table(notice_id text,is_read boolean,dismissed boolean)
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.is_household_member(p_household) then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_action is null or p_action not in ('list','read','dismiss','clear_read') or p_ids is null or cardinality(p_ids)>500
 or exists(select 1 from unnest(p_ids) x where x is null or length(x) not between 1 and 499) then raise exception 'invalid_receipts' using errcode='22023'; end if;
 if p_action in ('read','dismiss') then
  insert into public.notification_receipts as r(user_id,household_id,notice_id,is_read,dismissed)
   select auth.uid(),p_household,x,p_action='read',p_action='dismiss' from (select distinct unnest(p_ids) x) s
   on conflict on constraint notification_receipts_pkey do update
   set is_read=r.is_read or excluded.is_read,dismissed=r.dismissed or excluded.dismissed;
 elsif p_action='clear_read' then
  update public.notification_receipts r set dismissed=true where r.user_id=auth.uid() and r.household_id=p_household and r.notice_id=any(p_ids) and r.is_read;
 end if;
 return query select r.notice_id,r.is_read,r.dismissed from public.notification_receipts r
 where r.user_id=auth.uid() and r.household_id=p_household and r.notice_id=any(p_ids);
end;$$;
revoke all on function public.update_notification_receipts(uuid,text[],text) from public,anon;
grant execute on function public.update_notification_receipts(uuid,text[],text) to authenticated;
