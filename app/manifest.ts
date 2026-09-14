import type { MetadataRoute } from "next";
import {getPreferences,getT} from '@/lib/i18n/server';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const {locale,theme}=await getPreferences(),t=await getT();
  return {
    name: "Petfolio",
    short_name: "Petfolio",
    description: t("Здоровье, уход и важные события ваших питомцев в одном месте"),
    start_url: "/",
    display: "standalone",
    background_color: theme==='dark'?'#181818':'#f7f7f8',
    theme_color: theme==='dark'?'#181818':'#f7f7f8',
    lang: locale,
    orientation: "portrait-primary",
    id: '/',
    scope: '/',
    icons: [
      {src:'/icons/192',sizes:'192x192',type:'image/png',purpose:'any'},
      {src:'/icons/512',sizes:'512x512',type:'image/png',purpose:'any'},
      {
        src: "/petfolio-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
