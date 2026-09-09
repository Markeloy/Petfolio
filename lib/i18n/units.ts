// Stored values stay unchanged; only known display units are localized.
export function unitLabel(unit:string,locale='ru-RU'){
  const english:Record<string,string>={'г':'g','кг':'kg','мл':'ml','л':'L','шт':'pcs','табл':'tabs','упак':'packs','мг':'mg','капли':'drops','капля':'drop','капель':'drops'};
  return locale.startsWith('en')?(english[unit]??unit):unit;
}
