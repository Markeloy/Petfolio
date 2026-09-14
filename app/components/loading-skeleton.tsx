'use client';
import {useT} from '@/lib/i18n/client';
export function LoadingSkeleton(){
  const t=useT();
  return <div className="loadingSkeleton" role="status" aria-live="polite"><span className="srOnly">{t('Загрузка…')}</span><div aria-hidden="true"><div className="skeletonLine"/><div className="skeletonCard"/><div className="skeletonCard"/></div></div>;
}
