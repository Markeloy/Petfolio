export function quantity(value:unknown,positive=false):number {
  const text=typeof value==='string'?value.trim().replace(',','.'):'';
  if(!/^\d+(\.\d{1,3})?$/.test(text))throw new Error('Введите число с точностью до трёх знаков после запятой');
  const number=Number(text);
  if(!Number.isFinite(number)||number>1_000_000_000||(positive&&number<=0))throw new Error('Проверьте количество');
  return number;
}
