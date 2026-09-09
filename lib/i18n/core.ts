import english from './en.json' with {type:'json'};
export type Locale='ru'|'en';
export type Theme='light'|'dark'|'system';
export function localeValue(value:unknown):Locale{return value==='en'?'en':'ru';}
export function themeValue(value:unknown):Theme{return value==='dark'||value==='light'?value:'system';}
export function translator(locale:Locale){return (source:string|null|undefined)=>{
  if(!source)return '';
  if(locale==='ru')return source;
  const limit=source.match(/^Слишком длинное поле: максимум (\d+) символов(\.)?$/);
  if(limit)return `This field must be no longer than ${limit[1]} characters${limit[2]??''}`;
  if(source.startsWith('Не удалось загрузить фотографию: '))return 'Unable to upload the photo. Please try again.';
  const key=source.trim(),translated=(english as Record<string,string>)[key];
  return translated===undefined?source:source.replace(key,()=>translated);
};}
