'use client';
import {usePathname,useSearchParams} from 'next/navigation';
import {BottomNav} from './petfolio-home';

// The root layout survives route transitions, including their loading states.
export function GlobalNavigation(){
  const pathname=usePathname(),params=useSearchParams();
  if(!(/^\/(calendar|stock|family|settings)(\/|$)/.test(pathname)||pathname==='/'||pathname.startsWith('/pets/')))return null;
  const active=pathname.startsWith('/calendar')?'calendar':pathname.startsWith('/stock')?'stock':pathname.startsWith('/family')?'family':pathname.startsWith('/settings')||params.get('tab')==='more'?'more':'home';
  return <BottomNav active={active}/>;
}
