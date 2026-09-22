'use client';
import {useActionState} from 'react';
import {useT} from '@/lib/i18n/client';
import {procedureKinds,type CareProcedure} from '@/lib/procedures/types';
import {saveProcedure} from './actions';
export function ProcedureForm({petId,id,procedure,mode='create',today}:{petId:string;id:string;procedure?:CareProcedure;mode?:string;today:string}){
 const t=useT();const [state,action,pending]=useActionState(saveProcedure.bind(null,mode,petId,id,procedure?.updated_at??'',procedure?.next_on??''),{});
 const editing=mode==='create'||mode==='edit';
 return <form action={action} className="procedureForm">
 {editing?<><label>{t('Процедура')}<select name="kind" defaultValue={procedure?.kind??'grooming'}>{Object.entries(procedureKinds).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label><label>{t('Название')}<input name="title" required maxLength={100} defaultValue={procedure?.title}/></label><label>{t('Следующая дата')}<input type="date" name="next_on" required min="1900-01-01" max="2100-12-31" defaultValue={procedure?.next_on??today}/></label><label>{t('Повторять каждые, дней')}<input type="number" name="repeat_days" min={1} max={365} step={1} placeholder={t('Без повтора')} defaultValue={procedure?.repeat_days??''}/></label><p className="formSectionHint">{t('Оставьте пустым для разовой процедуры. Следующая дата отсчитывается от дня отметки, в том числе при пропуске.')}</p><label>{t('Заметки')}<textarea name="notes" maxLength={2000} defaultValue={procedure?.notes}/></label><button disabled={pending}>{pending?t('Сохранение…'):t('Сохранить')}</button></>:mode==='mark'?<div className="procedureActions"><button name="status" value="done" disabled={pending}>{t('Выполнено')}</button><button name="status" value="skipped" disabled={pending}>{t('Пропущено')}</button></div>:<><label className="procedureConfirm"><input type="checkbox" name="confirm" value="yes" required/>{t('Подтвердите действие')}</label><button disabled={pending}>{mode==='archive'?t('В архив'):t('Восстановить')}</button></>}
 {state.error&&<p role="alert">{t(state.error)}</p>}{state.success&&<p role="status">{t(state.success)}</p>}
 </form>;
}
