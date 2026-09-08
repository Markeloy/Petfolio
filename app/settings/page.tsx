import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {SettingsForm} from './form';
export const dynamic='force-dynamic';
export default async function Settings({searchParams}:{searchParams:Promise<{saved?:string}>}) {
  const client=await createClient(),{data,error}=await client.auth.getClaims();
  if(error||typeof data?.claims?.sub!=='string')redirect('/login');
  const profile=await client.from('profiles').select('display_name,timezone,updated_at').eq('id',data.claims.sub).single();
  if(profile.error)throw new Error('Не удалось загрузить настройки');
  const {display_name,timezone,updated_at}=profile.data;
  const zones=[...new Set([timezone,'Europe/Moscow','UTC',...Intl.supportedValuesOf('timeZone')])];
  return <main className="detailShell formDetailShell"><Link href="/?tab=more">← Ещё</Link><h1>Настройки аккаунта</h1>
    <section className="formSectionCard"><p>Имя видно вашей семье. Часовой пояс определяет даты и отображение времени.</p><p>Уже созданные расписания лекарств и кормлений сохраняют свой часовой пояс. Прошлые отметки не меняются.</p>
    {(await searchParams).saved==='1'&&<p role="status" className="formNotice successNotice">Настройки сохранены</p>}
    <SettingsForm name={display_name??''} timezone={timezone} version={updated_at} zones={zones} key={updated_at}/></section>
    <section className="formSectionCard"><h2>Напоминания</h2><p>Ближайшие события доступны на главной и в календаре. Уведомления при закрытом приложении пока не подключены.</p><Link href="/calendar">Открыть календарь →</Link></section>
  </main>;
}
