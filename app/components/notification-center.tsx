'use client';
import Link from 'next/link';
import {useRef,useState,useEffect,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {noticeReceipts,type Receipt} from '@/lib/notifications/actions';
import {useT} from '@/lib/i18n/client';
import {readIds,unreadCount,mergeReceipts,type Notice} from '@/lib/notifications/model';

export function NotificationCenter({items,scope,error=false}:{items:Notice[];scope:string;error?:boolean}){
  const t=useT(),dialog=useRef<HTMLDialogElement>(null),router=useRouter();
  const [receipts,setReceipts]=useState<Receipt[]>([]),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const [pending,startTransition]=useTransition();
  const household=scope.split(':')[1]??'';
  const idsKey=JSON.stringify(items.map(item=>item.id));
  useEffect(()=>{
    let active=true;
    async function load(){
      const ids:string[]=JSON.parse(idsKey);
      // Import earlier device-only read receipts once, without reviving dismissed items.
      let legacy:string[]=[];
      try{legacy=readIds(localStorage.getItem(`petfolio-read:${scope}`)??'[]').filter(id=>ids.includes(id));}catch{}
      if(legacy.length){const saved=await noticeReceipts(household,legacy,'read');if(saved.ok)try{localStorage.removeItem(`petfolio-read:${scope}`);}catch{}}
      const result=await noticeReceipts(household,ids);
      if(active){if(result.ok)setReceipts(previous=>mergeReceipts(previous,result.rows));setReady(result.ok);setFailed(!result.ok);}
    }
    void load();
    window.addEventListener('focus',load);
    return ()=>{active=false;window.removeEventListener('focus',load);};
  },[household,scope,idsKey]);
  const dismissed=new Set(receipts.filter(r=>r.dismissed).map(r=>r.notice_id));
  const visible=items.filter(item=>!dismissed.has(item.id));
  const read=new Set(receipts.filter(r=>r.is_read).map(r=>r.notice_id)),count=unreadCount(visible,read);
  function update(ids:string[],action:'read'|'dismiss'|'clear_read',href?:string){
    startTransition(async()=>{
      const result=await noticeReceipts(household,ids,action);
      if(result.ok){setReceipts(previous=>mergeReceipts(previous,result.rows));setFailed(false);}
      else setFailed(true);
      if(href){dialog.current?.close();router.push(href);}
    });
  }
  return <>
    <button className="iconButton notificationBell" type="button" onClick={()=>dialog.current?.showModal()} aria-label={`${t('Уведомления')}${ready&&count?`: ${t('Непрочитанные')} ${count}`:''}`} aria-haspopup="dialog">
      <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      {ready&&count>0&&<span className="notificationBadge" aria-hidden="true">{count>99?'99+':count}</span>}
    </button>
    <dialog ref={dialog} className="notificationSheet" aria-labelledby="notifications-title" onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <div className="notificationPanel"><header><div><p className="eyebrow">Petfolio</p><h2 id="notifications-title">{t('Уведомления')}</h2></div><button type="button" className="iconButton" aria-label={t('Закрыть уведомления')} onClick={()=>dialog.current?.close()}>×</button></header>
        <p className="notificationHint">{t('Прочтение и скрытие сохраняются в вашем аккаунте. События ухода остаются на месте.')}</p>
        {ready&&count>0&&<button className="noticeReadAll" type="button" disabled={pending} onClick={()=>update(visible.map(item=>item.id),'read')}>{t('Прочитать все')}</button>}
        {ready&&visible.some(item=>read.has(item.id))&&<button className="noticeReadAll" type="button" disabled={pending} onClick={()=>update(visible.filter(item=>read.has(item.id)).map(item=>item.id),'clear_read')}>{t('Очистить прочитанные')}</button>}
        {!ready&&!failed&&<p role="status">{t('Загрузка уведомлений…')}</p>}
        {failed&&<p role="alert">{t('Не удалось сохранить или загрузить уведомления. Обновите страницу.')}</p>}
        {error&&<p role="status">{t('Часть уведомлений не удалось загрузить. Обновите страницу.')}</p>}
        {ready&&!visible.length&&!error&&<div className="notificationEmpty"><strong>{t('Пока всё спокойно')}</strong><p>{t('Здесь появятся напоминания об уходе и покупках.')}</p></div>}
        <ul className="notificationList">{visible.map(item=><li key={item.id} className={read.has(item.id)?'isRead':''}><Link href={item.href} onClick={event=>{event.preventDefault();if(!pending)update([item.id],'read',item.href);}}><span className="noticeDot" aria-label={read.has(item.id)?t('Прочитано'):t('Непрочитанное')}/><span><small>{item.kind==='stock'?t('Пора купить'):t('Уход за питомцем')}</small><strong>{item.title}</strong><span>{item.detail}</span></span><span aria-hidden="true">›</span></Link>{!read.has(item.id)&&<button type="button" disabled={!ready||pending} onClick={()=>update([item.id],'read')}>{t('Отметить прочитанным')}</button>}<button type="button" disabled={!ready||pending} onClick={()=>update([item.id],'dismiss')} aria-label={`${t('Скрыть уведомление')}: ${item.title}`}>{t('Скрыть уведомление')}</button></li>)}</ul>
      </div>
    </dialog>
  </>;
}
