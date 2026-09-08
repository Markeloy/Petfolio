'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { quantity } from '@/lib/stock/validation';
import { categories,units } from '@/lib/stock/types';
import type { Json } from '@/lib/supabase/database.types';
export type StockState={error?:string;success?:string};
export async function saveStock(mode:string,household:string,itemId:string,requestId:string,version:string,_state:StockState,form:FormData):Promise<StockState> {
  let values:Record<string,Json>={version};
  try {
    if(mode==='create'||mode==='edit') {
      const name=String(form.get('name')??'').trim(),category=String(form.get('category')??''),notes=String(form.get('notes')??'').trim();
      if(!name||name.length>100||!Object.hasOwn(categories,category)||notes.length>2000)throw new Error('Проверьте название, категорию и примечание');
      values={...values,name,category,notes,threshold:quantity(form.get('threshold'))};
      if(mode==='create') {
        const unit=String(form.get('unit')??'');
        if(!units.includes(unit as typeof units[number]))throw new Error('Выберите единицу измерения');
        values={...values,unit,quantity:quantity(form.get('quantity'))};
      }
    } else if(mode==='adjust') {
      const direction=form.get('direction');
      if(direction!=='add'&&direction!=='subtract')throw new Error('Выберите пополнение или списание');
      const reason=String(form.get('reason')??'').trim();
      if(!reason||reason.length>500)throw new Error('Укажите причину — до 500 символов');
      values={delta:quantity(form.get('quantity'),true)*(direction==='add'?1:-1),reason};
    } else if(mode==='archive'||mode==='restore') {
      if(form.get('confirm')!=='yes')throw new Error('Подтвердите действие');
    } else throw new Error('Неизвестное действие');
  } catch(error) {return {error:error instanceof Error?error.message:'Проверьте поля'};}
  const client=await createClient();
  const {error}=await client.rpc('stock_action',{p_action:mode,p_household:household,p_item:itemId,p_request:requestId,p_values:values});
  if(error)return {error:error.code==='P0001'?error.message:'Не удалось сохранить. Обновите страницу и проверьте доступ к семье'};
  revalidatePath('/stock','layout');
  if(mode==='create')redirect(`/stock/${itemId}`);
  return {success:'Сохранено'};
}
