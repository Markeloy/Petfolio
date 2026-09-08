export const healthKinds = { vaccination:'Вакцинация', parasite:'Обработка от паразитов', visit:'Визит к ветеринару', symptom:'Самочувствие и симптомы', other:'Другое' } as const;
export const healthStatuses = { planned:'Запланировано', completed:'Выполнено', cancelled:'Отменено' } as const;
export type HealthKind = keyof typeof healthKinds;
export type HealthStatus = keyof typeof healthStatuses;
export type HealthEvent = {
  id:string; pet_id:string; kind:HealthKind; title:string; event_on:string; status:HealthStatus;
  next_due_on:string|null; product:string|null; clinic:string|null; veterinarian:string|null; notes:string|null;
  created_by:string; updated_by:string|null; created_at:string; updated_at:string; archived_at:string|null;
};
export function dateLabel(value:string) { return value.split('-').reverse().join('.'); }
export function dueDate(event: Pick<HealthEvent,'status'|'event_on'|'next_due_on'|'archived_at'>): string|null {
  if(event.archived_at || event.status==='cancelled') return null;
  return event.status==='planned' ? event.event_on : event.next_due_on;
}
