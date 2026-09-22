import Link from 'next/link';
import {notFound} from 'next/navigation';
import {feedingContext} from '@/lib/feeding/server';
import {getT} from '@/lib/i18n/server';
import {localDate,formatMoment} from '@/lib/medications/schedule';
import {dateLabel} from '@/lib/health/types';
import {pageIndex} from '@/lib/health/validation';
import {procedureKinds} from '@/lib/procedures/types';
import {ProcedureForm} from '../forms';
export default async function ProcedurePage({params,searchParams}:{params:Promise<{petId:string;procedureId:string}>;searchParams:Promise<{page?:string}>}){
 const {petId,procedureId}=await params;const {client,pet,canEdit}=await feedingContext(petId);const t=await getT(),page=pageIndex((await searchParams).page);
 const {data:p,error}=await client.from('care_procedures').select('*').eq('pet_id',petId).eq('id',procedureId).maybeSingle();if(error)throw new Error('Не удалось загрузить процедуры');if(!p)notFound();
 const {data:logs,error:logError,count}=await client.from('care_procedure_logs').select('*',{count:'exact'}).eq('procedure_id',p.id).order('recorded_at',{ascending:false}).order('id').range(page*30,page*30+29);if(logError)throw new Error('Не удалось загрузить историю');
 const today=localDate(new Date(),p.timezone),formProps={petId,id:p.id,procedure:p,today};
 return <main className="detailShell"><Link href={`/pets/${petId}/care`}>{t('← Уход')}</Link><p className="eyebrow">{pet.name} · {t(procedureKinds[p.kind])}</p><h1>{p.title}</h1><section className="careSection"><p>{p.archived_at?t('В архиве'):p.next_on?`${p.next_on<today?t('Просрочено'):t('Следующая дата')} · ${dateLabel(p.next_on,t('ru-RU'))}`:t('Следующая процедура не запланирована')}</p><p>{p.repeat_days?`${t('Повторять каждые, дней')}: ${p.repeat_days}`:t('Без повтора')}</p>{p.notes&&<p style={{whiteSpace:'pre-wrap'}}>{p.notes}</p>}{canEdit&&!p.archived_at&&p.next_on&&(p.next_on<=today?<ProcedureForm key={p.updated_at} {...formProps} mode="mark"/>:<p>{t('Отметить можно в назначенный день или позже.')}</p>)}</section>
 {canEdit&&<section className="careSection">{!p.archived_at&&<details><summary>{t('Редактировать')}</summary><ProcedureForm key={p.updated_at} {...formProps} mode="edit"/></details>}<details><summary>{p.archived_at?t('Восстановить'):t('В архив')}</summary><ProcedureForm key={p.updated_at} {...formProps} mode={p.archived_at?'restore':'archive'}/></details></section>}
 <section className="careSection"><h2>{t('История')}</h2>{!logs?.length&&<p>{t('Отметок пока нет')}</p>}<div className="procedureHistory">{logs?.map(log=><article key={log.id}><strong>{log.status==='done'?t('Выполнено'):t('Пропущено')} · {dateLabel(log.scheduled_on,t('ru-RU'))}</strong><p>{log.title}</p><small>{log.actor_name} · {formatMoment(log.recorded_at,p.timezone,t('ru-RU'))}</small></article>)}</div><nav className="procedureActions">{page>0&&<Link href={`?page=${page-1}`}>{t('← Назад')}</Link>}{(page+1)*30<(count??0)&&<Link href={`?page=${page+1}`}>{t('Далее →')}</Link>}</nav></section></main>;
}
