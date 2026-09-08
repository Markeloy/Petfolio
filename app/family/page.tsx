import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { familyMemberships } from '@/lib/family/server';
import { BottomNav } from '@/app/components/petfolio-home';
import { RefreshOnFocus } from '@/app/components/refresh-on-focus';
import { FamilyForm } from './forms';
import './family.css';
export const dynamic='force-dynamic';
type Invite={id:string;created_at:string;expires_at:string;accepted_at:string|null;revoked_at:string|null};
export default async function FamilyPage() {
  const client=await createClient();
  const {data:claims,error:authError}=await client.auth.getClaims();
  const userId=claims?.claims?.sub;
  if(authError||typeof userId!=='string')redirect('/login');
  const {memberships,active}=await familyMemberships(client,userId);
  const families=memberships.length?await client.from('households').select('id,name').in('id',memberships.map(m=>m.household_id)):{data:[],error:null};
  if(families.error)throw new Error('Не удалось загрузить семьи');
  const family=families.data?.find(f=>f.id===active?.household_id);
  const members=active?await client.from('household_members').select('user_id,role,joined_at').eq('household_id',active.household_id).order('joined_at').order('user_id'):{data:[],error:null};
  if(members.error)throw new Error('Не удалось загрузить участников');
  const profiles=members.data?.length?await client.from('profiles').select('id,display_name').in('id',members.data.map(m=>m.user_id)):{data:[],error:null};
  if(profiles.error)throw new Error('Не удалось загрузить имена');
  const names=new Map(profiles.data?.map(p=>[p.id,p.display_name||'Участник']));
  const invites=active?.role==='owner'?await client.rpc('family_action',{p_action:'invites',p_household:active.household_id}):{data:[],error:null};
  if(invites.error)throw new Error('Не удалось загрузить приглашения');
  const invitations=invites.data as Invite[];
  return <main className="appShell"><RefreshOnFocus/><div className="content familyContent"><header><p className="eyebrow">Petfolio</p><h1>Семья</h1><p>Ухаживайте за питомцами вместе</p></header>
    {memberships.length>1&&<section><h2>Выбранная семья</h2><FamilyForm action="switch" label="Выбрать" key={active?.household_id}><label>Семья<select name="household" defaultValue={active?.household_id}>{memberships.map(m=><option value={m.household_id} key={m.household_id}>{families.data?.find(f=>f.id===m.household_id)?.name} · {m.role==='owner'?'владелец':'участник'}</option>)}</select></label></FamilyForm><p>Главная, календарь и добавление питомца используют выбранную семью. Питомцы других семей сохраняются.</p></section>}
    {family&&active&&<>
      <section><h2>{family.name}</h2><p>{active.role==='owner'?'Вы владелец: управляете участниками и приглашениями.':'Вы участник: можете вести совместный уход.'}</p><Link href="/">Питомцы этой семьи</Link>
        {active.role==='owner'&&<details><summary>Изменить название</summary><FamilyForm action="rename" household={family.id} label="Сохранить название"><label>Название<input name="name" defaultValue={family.name} required maxLength={80}/></label></FamilyForm></details>}
      </section>
      <section><h2>Участники · {members.data?.length}</h2><ul className="familyMembers">{members.data?.map(member=><li key={member.user_id}><strong>{names.get(member.user_id)??'Участник'}{member.user_id===userId?' · Вы':''}</strong><span>{member.role==='owner'?'Владелец':'Участник'}</span>{active.role==='owner'&&member.user_id!==userId&&member.role!=='owner'&&<details><summary>Управление участником</summary><FamilyForm action="remove" household={family.id} target={member.user_id} label="Удалить из семьи" confirm="Закрыть участнику доступ к питомцам и записям семьи. История ухода сохранится."/><FamilyForm action="transfer" household={family.id} target={member.user_id} label="Передать управление" confirm="Этот участник станет владельцем, а я — обычным участником. Мои неиспользованные приглашения будут отменены."/></details>}</li>)}</ul></section>
      {active.role==='owner'&&<section><h2>Пригласить близкого</h2><p>Новый участник получит доступ ко всем питомцам этой семьи и сможет отмечать уход. Отправьте код самостоятельно.</p><FamilyForm action="create" household={family.id} label="Создать приглашение" key={family.id}/>
        {invitations.length>0&&<details><summary>Последние приглашения · {invitations.length}</summary><ul className="familyMembers">{invitations.map(invite=>{const status=invite.accepted_at?'Использовано':invite.revoked_at?'Отменено':Date.parse(invite.expires_at)<=Date.now()?'Истекло':'Действует';return <li key={invite.id}><strong>{status}</strong><span>Создано {new Date(invite.created_at).toLocaleDateString('ru-RU',{timeZone:'UTC'})} · № {invite.id.slice(0,8)}</span>{status==='Действует'&&<FamilyForm action="revoke" household={family.id} target={invite.id} label="Отменить приглашение"/>}</li>;})}</ul></details>}
      </section>}
      <section><details><summary>Выйти из семьи</summary><p>Записи ухода останутся у семьи. Для возвращения потребуется новое приглашение. Последний владелец должен сначала передать управление.</p><FamilyForm action="leave" household={family.id} label="Выйти из семьи" confirm="Я понимаю, что потеряю доступ к питомцам этой семьи."/></details></section>
    </>}
    <section><h2>Присоединиться по коду</h2><p>Вставьте код от владельца семьи. Ваши прежние семьи и питомцы сохранятся.</p><FamilyForm action="join" label="Присоединиться"><label>Код приглашения<input name="code" required minLength={48} maxLength={64} autoComplete="off" spellCheck={false} placeholder="Вставьте полученный код"/></label></FamilyForm></section>
  </div><BottomNav active="family"/></main>;
}
