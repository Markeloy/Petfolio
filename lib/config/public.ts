export type PublicConfig={supabaseUrl:string;publishableKey:string;environment:string;appVersion:string;surface:string};
export function serverPublicConfig(env:Record<string,string|undefined>=process.env):PublicConfig {
 const raw=env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']??'';
 // Only the modern PUBLIC key format is accepted for this deployment.
 const publishableKey=/^sb_publishable_[A-Za-z0-9_-]+$/.test(raw)?raw:'';
 return {supabaseUrl:env['NEXT_PUBLIC_SUPABASE_URL']??'',publishableKey,
 environment:env['NEXT_PUBLIC_APP_ENV']??'development',appVersion:env['NEXT_PUBLIC_APP_VERSION']??'0.1.0',surface:env['NEXT_PUBLIC_APP_SURFACE']??'pwa'};
}
export function publicConfig():PublicConfig {
 if(typeof document!=='undefined'){
  const node=document.getElementById('petfolio-public-config');
  if(node?.textContent) return JSON.parse(node.textContent) as PublicConfig;
 }
 return serverPublicConfig();
}
export function serializePublicConfig(config:PublicConfig):string {
 return JSON.stringify(config).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
}
