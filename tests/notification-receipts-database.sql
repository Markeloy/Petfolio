begin;
insert into auth.users(id) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'),('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4');
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',true);
set local role authenticated;
do $$ declare h uuid; n integer; begin
 select household_id into h from household_members where user_id=auth.uid();
 perform update_notification_receipts(h,array['care:test:1'],'read');
 perform update_notification_receipts(h,array['care:test:1','care:test:2'],'clear_read');
 if not (select dismissed from notification_receipts where notice_id='care:test:1') then raise exception 'clear read failed';end if;
 if exists(select 1 from notification_receipts where notice_id='care:test:2') then raise exception 'unread cleared';end if;
 perform update_notification_receipts(h,array['care:test:1'],'read');
 if not (select dismissed from notification_receipts where notice_id='care:test:1') then raise exception 'read resurrected dismissed';end if;
 perform update_notification_receipts(h,array['care:test:2','care:test:2'],'dismiss');
 select count(*) into n from update_notification_receipts(h,array['care:test:1','care:test:2']);
 if n<>2 then raise exception 'repeat dismiss not idempotent';end if;
 begin
 insert into notification_receipts(user_id,household_id,notice_id) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',h,'spoof');
 raise exception 'spoof accepted'; exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from notification_receipts) then raise exception 'cross user leak';end if;
end $$;
reset role;
-- Same household still cannot see another member's personal dismiss receipts.
insert into household_members(household_id,user_id) select household_id,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4' from household_members where user_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3';
set local role authenticated;
do $$ begin if exists(select 1 from notification_receipts) then raise exception 'same household personal receipt leak';end if;end $$;
reset role;
select 'PASS: receipts persist, are idempotent, clear only read, survive late reads, reject spoofing and isolate same/different household users' as result;
rollback;
