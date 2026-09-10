'use client';
import Link from 'next/link';
import {useRef,useSyncExternalStore} from 'react';
import {useT} from '@/lib/i18n/client';
import {readIds,unreadCount,type Notice} from '@/lib/notifications/model';

const changeEvent='petfolio-notices-read';
const memory=new Map<string,string>();
function subscribe(callback:()=>void){window.addEventListener(changeEvent,callback);window.addEventListener('storage',callback);return ()=>{window.removeEventListener(changeEvent,callback);window.removeEventListener('storage',callback);};}
function snapshot(key:string){try{return localStorage.getItem(key)??memory.get(key)??'[]';}catch{return memory.get(key)??'[]';}}
const emptySnapshot=()=>'[]';

export function NotificationCenter({items,scope,error=false}:{items:Notice[];scope:string;error?:boolean}){
  const t=useT(),dialog=useRef<HTMLDialogElement>(null);
  const storageKey=`petfolio-read:${scope}`;
  const raw=useSyncExternalStore(subscribe,()=>snapshot(storageKey),emptySnapshot);
  const read=new Set(readIds(raw)),count=unreadCount(items,read);
  function mark(ids:string[]){
    const active=new Set(items.map(item=>item.id));
    const next=new Set([...readIds(snapshot(storageKey)),...ids].filter(id=>active.has(id)));
    const value=JSON.stringify([...next]);
    memory.set(storageKey,value);
    try{localStorage.setItem(storageKey,value);}catch{/* Keep the receipt for this session if storage is disabled. */}
    window.dispatchEvent(new Event(changeEvent));
  }
  return <>
    <button className="iconButton notificationBell" type="button" onClick={()=>dialog.current?.showModal()} aria-label={`${t('Уведомления')}${count?`: ${t('Непрочитанные')} ${count}`:''}`} aria-haspopup="dialog">
      <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      {count>0&&<span className="notificationBadge" aria-hidden="true">{count>99?'99+':count}</span>}
    </button>
    <dialog ref={dialog} className="notificationSheet" aria-labelledby="notifications-title" onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <div className="notificationPanel"><header><div><p className="eyebrow">Petfolio</p><h2 id="notifications-title">{t('Уведомления')}</h2></div><button type="button" className="iconButton" aria-label={t('Закрыть уведомления')} onClick={()=>dialog.current?.close()}>×</button></header>
        <p className="notificationHint">{t('Текущие напоминания семьи. Прочтение сохраняется на этом устройстве.')}</p>
        {count>0&&<button className="noticeReadAll" type="button" onClick={()=>mark(items.map(item=>item.id))}>{t('Прочитать все')}</button>}
        {error&&<p role="status">{t('Часть уведомлений не удалось загрузить. Обновите страницу.')}</p>}
        {!items.length&&!error&&<div className="notificationEmpty"><strong>{t('Пока всё спокойно')}</strong><p>{t('Здесь появятся напоминания об уходе и покупках.')}</p></div>}
        <ul className="notificationList">{items.map(item=><li key={item.id} className={read.has(item.id)?'isRead':''}><Link href={item.href} onClick={()=>{mark([item.id]);dialog.current?.close();}}><span className="noticeDot" aria-label={read.has(item.id)?t('Прочитано'):t('Непрочитанное')}/><span><small>{item.kind==='stock'?t('Пора купить'):t('Уход за питомцем')}</small><strong>{item.title}</strong><span>{item.detail}</span></span><span aria-hidden="true">›</span></Link>{!read.has(item.id)&&<button type="button" onClick={()=>mark([item.id])}>{t('Отметить прочитанным')}</button>}</li>)}</ul>
      </div>
    </dialog>
  </>;
}
