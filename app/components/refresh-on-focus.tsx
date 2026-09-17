'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Keep another family member's marks and day boundaries fresh while open.
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh=Date.now();
    const refresh = () => {
      if(document.visibilityState!=='visible'||Date.now()-lastRefresh<30000)return;
      lastRefresh=Date.now();
      router.refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [router]);
  return null;
}
