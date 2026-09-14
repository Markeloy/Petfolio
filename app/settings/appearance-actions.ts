'use server';
import {cookies} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {localeValue,themeValue} from '@/lib/i18n/core';
export async function saveAppearance(form:FormData){
  const jar=await cookies(),options={httpOnly:true,sameSite:'lax' as const,secure:process.env.NODE_ENV==='production',path:'/',maxAge:31536000};
  jar.set('petfolio-language',localeValue(form.get('locale')),options);
  jar.set('petfolio-theme',themeValue(form.get('theme')),options);
  revalidatePath('/','layout');
}
