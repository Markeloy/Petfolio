export const procedureKinds={grooming:'Груминг',bath:'Купание',nails:'Стрижка когтей',ears:'Чистка ушей',teeth:'Уход за зубами',brushing:'Расчёсывание',other:'Своя процедура'} as const;
export type CareProcedure={id:string;pet_id:string;household_id:string;title:string;kind:keyof typeof procedureKinds;next_on:string|null;repeat_days:number|null;timezone:string;notes:string;created_by:string|null;created_at:string;updated_at:string;archived_at:string|null};
export type ProcedureLog={id:string;procedure_id:string;pet_id:string;household_id:string;scheduled_on:string;title:string;status:'done'|'skipped';recorded_at:string;actor_id:string|null;actor_name:string};
export function parseProcedure(form:FormData){
 const title=String(form.get('title')??'').trim(),kind=String(form.get('kind')??''),next_on=String(form.get('next_on')??''),repeat=String(form.get('repeat_days')??''),notes=String(form.get('notes')??'').trim();
 if(!title||title.length>100||!Object.hasOwn(procedureKinds,kind)||notes.length>2000||!/^\d{4}-\d{2}-\d{2}$/.test(next_on)||next_on<'1900-01-01'||next_on>'2100-12-31'||!Number.isFinite(Date.parse(next_on))||new Date(next_on).toISOString().slice(0,10)!==next_on||(repeat&&(!/^\d+$/.test(repeat)||Number(repeat)<1||Number(repeat)>365)))throw new Error('Проверьте поля процедуры');
 return {title,kind:kind as CareProcedure['kind'],next_on,repeat_days:repeat?Number(repeat):null,notes};
}
