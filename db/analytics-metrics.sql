-- Read-only, operator SQL. Never expose this query through a public RPC.
-- Telemetry is best-effort and client context is self-reported. Count care from
-- authoritative business rows/audit transitions, not arbitrary event submissions.
WITH parameters AS (
 SELECT now()-interval '30 days' AS cohort_start, now() AS as_of
), cohort AS (
 SELECT e.user_id,min(e.occurred_at) AS signup_at
 FROM private.analytics_events e,parameters p
 WHERE e.event_name='signup_completed' AND e.environment='production'
 AND e.user_id IS NOT NULL AND e.occurred_at>=p.cohort_start AND e.occurred_at<=p.as_of
 GROUP BY e.user_id
), setups AS (
 SELECT m.pet_id,m.created_by AS user_id,m.created_at AS at FROM public.medications m
 UNION ALL SELECT w.pet_id,w.created_by,w.created_at FROM public.weight_records w
 UNION ALL SELECT h.pet_id,h.created_by,h.created_at FROM public.health_events h
), setup_activated AS (
 SELECT c.user_id,c.signup_at,min(greatest(p.created_at,s.at)) AS setup_at
 FROM cohort c JOIN public.pets p ON p.created_by=c.user_id
 JOIN setups s ON s.pet_id=p.id AND s.user_id=c.user_id
 WHERE p.created_at BETWEEN c.signup_at AND c.signup_at+interval '24 hours'
 AND s.at BETWEEN c.signup_at AND c.signup_at+interval '24 hours'
 GROUP BY c.user_id,c.signup_at
), care AS (
 SELECT m.pet_id,d.recorded_by AS user_id,d.recorded_at AS at
 FROM public.medication_doses d JOIN public.medication_schedules s ON s.id=d.schedule_id
 JOIN public.medications m ON m.id=s.medication_id WHERE d.status IN ('given','skipped')
 UNION ALL SELECT w.pet_id,w.created_by,w.created_at FROM public.weight_records w
 UNION ALL SELECT a.pet_id,a.actor_id,a.created_at FROM public.activity_log a
 WHERE a.entity_type='health_events' AND a.details->'after'->>'status'='completed'
 AND (a.action='created' OR (a.action='updated' AND a.details->'before'->>'status' IS DISTINCT FROM 'completed'))
 UNION ALL SELECT l.pet_id,l.actor_id,l.recorded_at FROM public.care_procedure_logs l WHERE l.status='done'
), value_activated AS (
 SELECT DISTINCT s.user_id FROM setup_activated s JOIN care c ON c.user_id=s.user_id
 WHERE c.at>s.setup_at AND c.at<=s.signup_at+interval '7 days'
), weekly_pets AS (
 SELECT DISTINCT date_trunc('week',c.at AT TIME ZONE 'UTC') AS week,c.pet_id
 FROM care c JOIN public.pets p ON p.id=c.pet_id JOIN cohort u ON u.user_id=p.created_by
 WHERE c.at>=u.signup_at AND c.at<=(SELECT as_of FROM parameters)
)
SELECT jsonb_build_object(
 'cohort_users',(SELECT count(*) FROM cohort),
 'setup_activated_users',(SELECT count(*) FROM setup_activated),
 'value_activated_users',(SELECT count(*) FROM value_activated),
 'waap_by_utc_week',coalesce((SELECT jsonb_agg(t ORDER BY week) FROM
   (SELECT week,count(*) AS assisted_pets FROM weekly_pets GROUP BY week) t),'[]'::jsonb)
) AS activation;
