import {validDate} from '../medications/edit-validation.ts';
export const speciesLabels={dog:'Собака',cat:'Кошка',bird:'Птица',rodent:'Грызун',reptile:'Рептилия',other:'Другой вид'};
export const sexLabels={male:'Самец',female:'Самка',unknown:'Не указан'};
export function parsePetProfile(form:FormData,today:string) {
  const name=String(form.get('name')??'').trim();
  const species=String(form.get('species')??''),sex=String(form.get('sex')??'');
  const birth_date=String(form.get('birth_date')??'').trim()||null;
  if(!name||name.length>100)throw new Error('Укажите имя — до 100 символов');
  if(!Object.hasOwn(speciesLabels,species)||!Object.hasOwn(sexLabels,sex))throw new Error('Выберите вид и пол питомца');
  if(birth_date&&(!validDate(birth_date)||birth_date>today))throw new Error('Проверьте дату рождения: она не может быть в будущем');
  const optional=(key:string,max=300)=>{const value=String(form.get(key)??'').trim();if(value.length>max)throw new Error(`Слишком длинное поле: максимум ${max} символов`);return value||null;};
  return {name,species:species as keyof typeof speciesLabels,sex:sex as keyof typeof sexLabels,birth_date,
    breed:optional('breed'),color:optional('color'),microchip_number:optional('microchip_number'),passport_number:optional('passport_number'),vet_clinic:optional('vet_clinic'),veterinarian:optional('veterinarian'),notes:optional('notes',5000)};
}
