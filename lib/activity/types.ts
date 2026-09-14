export const activityKinds={walk:'Прогулка',training:'Тренировка',play:'Игра',other:'Другое'} as const;
export const activityStatuses={planned:'Запланировано',completed:'Выполнено',cancelled:'Отменено'} as const;
export type PetActivity={id:string;pet_id:string;household_id:string;kind:keyof typeof activityKinds;title:string;status:keyof typeof activityStatuses;started_at:string;timezone:string;duration_minutes:number;distance_km:number|null;notes:string;created_by:string|null;author_name:string;updated_by:string|null;editor_name:string;created_at:string;updated_at:string;archived_at:string|null};
export function parseActivity(form:FormData) {
  const title=String(form.get('title')??'').trim(),kind=String(form.get('kind')??''),status=String(form.get('status')??''),datetime=String(form.get('started_at')??''),notes=String(form.get('notes')??'').trim();
  const duration=String(form.get('duration_minutes')??'').trim(),distance=String(form.get('distance_km')??'').trim().replace(',','.');
  if(!title||title.length>100||!Object.hasOwn(activityKinds,kind)||!Object.hasOwn(activityStatuses,status)||notes.length>2000)throw new Error('Проверьте название, тип и состояние активности');
  if(!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(datetime)||!Number.isFinite(Date.parse(datetime+'Z'))||new Date(datetime+'Z').toISOString().slice(0,16)!==datetime)throw new Error('Укажите корректные дату и время');
  if(!/^\d+$/.test(duration)||Number(duration)<1||Number(duration)>1440)throw new Error('Длительность — от 1 до 1440 минут');
  if(distance&&(!/^\d+(\.\d{1,3})?$/.test(distance)||Number(distance)>1000))throw new Error('Расстояние — от 0 до 1000 км, до трёх знаков после запятой');
  return {title,kind:kind as PetActivity['kind'],status:status as PetActivity['status'],datetime,duration_minutes:Number(duration),distance_km:distance?Number(distance):null,notes};
}
export function activitySummary(rows:PetActivity[]) {
  const completed=rows.filter(row=>row.status==='completed'&&!row.archived_at);
  return {count:completed.length,minutes:completed.reduce((sum,row)=>sum+row.duration_minutes,0),km:completed.reduce((sum,row)=>sum+Number(row.distance_km??0),0),distanceCount:completed.filter(row=>row.distance_km!==null).length};
}
