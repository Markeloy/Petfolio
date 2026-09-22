import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {feedingContext} from '@/lib/feeding/server';
import {getT} from '@/lib/i18n/server';
import {localDate} from '@/lib/medications/schedule';
import {ProcedureForm} from '../forms';
export default async function NewProcedure({params}:{params:Promise<{petId:string}>}){
 const {petId}=await params;const {pet,canEdit,timezone}=await feedingContext(petId);const t=await getT();
 return <main className="detailShell"><Link href={`/pets/${petId}/care`}>{t('← Уход')}</Link><p className="eyebrow">{pet.name}</p><h1>{t('Новая процедура')}</h1>{canEdit?<ProcedureForm petId={petId} id={randomUUID()} today={localDate(new Date(),timezone)}/>:<p>{t('Нет права изменять процедуры')}</p>}</main>;
}
