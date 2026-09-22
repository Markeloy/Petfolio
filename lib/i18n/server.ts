import {cache} from 'react';
import {cookies} from 'next/headers';
import {localeValue,themeValue,translator} from './core';
export const getPreferences=cache(async()=>{const jar=await cookies();return {locale:localeValue(jar.get('petfolio-language')?.value),theme:themeValue(jar.get('petfolio-theme')?.value)};});
export const getT=cache(async()=>translator((await getPreferences()).locale));
