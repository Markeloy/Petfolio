import test from 'node:test';
import assert from 'node:assert/strict';
import { todayOccurrence, nextOccurrence, doseKey, wallToInstant, localDate } from '../lib/medications/schedule.ts';
const course = { starts_on: '2026-01-01', ends_on: null, status: 'active' };
const schedule = { id: 's1', medication_id: 'm1', schedule_type: 'daily_time', scheduled_time: '08:00:00', days_of_week: [1,2,3,4,5,6,7], timezone: 'Europe/Moscow', active_from: '2026-01-01', active_until: null, is_active: true };
test('today follows schedule timezone across UTC midnight', () => {
  const now = new Date('2026-09-06T22:30:00Z');
  assert.equal(localDate(now, schedule.timezone), '2026-09-07');
  assert.equal(todayOccurrence(schedule, course, now), '2026-09-07T05:00:00.000Z');
});
test('ISO weekdays and inclusive course/schedule dates', () => {
  const now = new Date('2026-09-07T08:00:00Z');
  assert.equal(todayOccurrence({...schedule, days_of_week:[7]}, course, now), null);
  assert.equal(todayOccurrence({...schedule, days_of_week:[1], active_until:'2026-09-07'}, {...course, ends_on:'2026-09-07'}, now), '2026-09-07T05:00:00.000Z');
  assert.equal(todayOccurrence({...schedule, active_from:'2026-09-08'}, course, now), null);
  assert.equal(todayOccurrence(schedule, {...course, ends_on:'2026-09-06'}, now), null);
});
test('paused, inactive and unsupported schedules never generate doses', () => {
  const now = new Date('2026-09-07T00:00:00Z');
  assert.equal(todayOccurrence(schedule, {...course,status:'paused'}, now), null);
  for (const type of ['interval','as_needed']) assert.equal(todayOccurrence({...schedule,schedule_type:type}, course, now), null);
  assert.equal(todayOccurrence({...schedule,is_active:false}, course, now), null);
});
test('nearest is future, skips given/skipped timestamps irrespective of serialization', () => {
  const now = new Date('2026-09-07T05:00:00Z');
  const recorded = new Set([doseKey('s1','2026-09-08T08:00:00+03:00')]);
  assert.equal(nextOccurrence(schedule, course, recorded, now), '2026-09-09T05:00:00.000Z');
  assert.equal(nextOccurrence(schedule, {...course, ends_on:'2026-09-08'}, recorded, now), null);
});
test('future course starts months away and Sunday-only schedule', () => {
  assert.equal(nextOccurrence({...schedule, days_of_week:[7]}, {...course, starts_on:'2027-01-01'}, new Set(), new Date('2026-09-07T00:00:00Z')), '2027-01-03T05:00:00.000Z');
});
test('DST gap is not shifted; repeated local time represents one canonical dose', () => {
  assert.equal(wallToInstant('2026-03-08','02:30:00','America/New_York'), null);
  assert.equal(wallToInstant('2026-11-01','01:30:00','America/New_York'), '2026-11-01T05:30:00.000Z');
  assert.equal(wallToInstant('2026-09-07','08:00:00','Asia/Kathmandu'), '2026-09-07T02:15:00.000Z');
});
