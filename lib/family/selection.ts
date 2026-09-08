export function chooseHousehold<T extends {household_id:string}>(memberships:T[], preferred:string|undefined): T|null {
  return memberships.find(m=>m.household_id===preferred) ?? memberships[0] ?? null;
}
export function invitationCode(value:unknown):string|null {
  if(typeof value!=='string')return null;
  const code=value.trim().toLowerCase();
  return /^[a-f0-9]{48}$/.test(code)?code:null;
}
