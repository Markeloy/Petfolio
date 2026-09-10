export const documentCategories={passport:'Паспорт',test:'Анализы',report:'Выписка / заключение',prescription:'Назначение',insurance:'Страховка',other:'Другое'} as const;
export type PetDocument={id:string;pet_id:string;household_id:string;title:string;category:keyof typeof documentCategories;notes:string;original_name:string;mime_type:string;file_size:number;storage_path:string;state:'pending'|'ready';created_by:string|null;author_name:string;created_at:string;updated_at:string;archived_at:string|null};
export const MAX_DOCUMENT_SIZE=8*1024*1024;
export function detectedMime(bytes:Uint8Array):string|null {
  const start=(values:number[])=>values.every((v,i)=>bytes[i]===v);
  if(start([0x25,0x50,0x44,0x46,0x2d]))return 'application/pdf';
  if(start([0xff,0xd8,0xff]))return 'image/jpeg';
  if(start([137,80,78,71,13,10,26,10]))return 'image/png';
  if(start([82,73,70,70])&&[87,69,66,80].every((v,i)=>bytes[i+8]===v))return 'image/webp';
  return null;
}
