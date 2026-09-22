import type {FeedingPlan} from './types';
import {wallToInstant} from '@/lib/medications/schedule';
export function feedingOn(plan:FeedingPlan,day:string):string|null {
  if(plan.archived_at||day<plan.active_from||(plan.active_until&&day>plan.active_until))return null;
  return wallToInstant(day,plan.scheduled_time,plan.timezone);
}
