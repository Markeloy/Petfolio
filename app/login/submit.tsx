'use client';
import {useFormStatus} from 'react-dom';
import {useT} from '@/lib/i18n/client';
export function AuthSubmit({signup}:{signup:boolean}){
  const {pending}=useFormStatus();
  const t=useT();
  return <button className="primaryAction" type="submit" disabled={pending} aria-busy={pending}>{pending?t('Загрузка…'):signup?t('Создать аккаунт'):t('Войти')}</button>;
}
