import type { HealthKind, HealthStatus } from './types';
function validDate(value:string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value; }
export function parseHealth(form:FormData,today:string) {
  const str=(key:string,max=300)=> {const s=String(form.get(key)??'').trim();if(s.length>max) throw new Error(`Слишком длинное поле: максимум ${max} символов.`);return s;};
  const kind=str('kind'),status=str('status'),title=str('title',200),date=str('event_on'),next=str('next_due_on');
  if(!['vaccination','parasite','visit','symptom','other'].includes(kind)) throw new Error('Выберите категорию.');
  if(!['planned','completed','cancelled'].includes(status)) throw new Error('Выберите состояние события.');
  if(!title) throw new Error('Укажите название события.');
  if(!validDate(date)) throw new Error('Укажите корректную дату.');
  if(status==='completed' && date>today) throw new Error('Выполненное событие не может быть в будущем.');
  if(next && (!validDate(next)||next<date)) throw new Error('Следующая дата не может быть раньше события.');
  return {kind:kind as HealthKind,status:status as HealthStatus,title,event_on:date,next_due_on:next||null,
    product:str('product')||null,clinic:str('clinic')||null,veterinarian:str('veterinarian')||null,notes:str('notes',5000)||null};
}
export function parseWeight(form:FormData) {
  const value=String(form.get('weight_kg')??'').trim().replace(',','.');
  const weight=Number(value), notes=String(form.get('notes')??'').trim();
  if(!value || !Number.isFinite(weight)||weight<0.001||weight>5000) throw new Error('Укажите вес от 0,001 до 5000 кг.');
  if(notes.length>5000) throw new Error('Комментарий должен быть не длиннее 5000 символов.');
  const datetime=String(form.get('measured_at')??'');
  if(!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(datetime)||!validDate(datetime.slice(0,10))) throw new Error('Проверьте дату и время измерения.');
  return {weight_kg:weight,notes:notes||null,datetime};
}
export function pageIndex(raw?:string) {const n=Number(raw);return Number.isFinite(n)?Math.max(0,Math.min(100000,Math.floor(n))):0;}
