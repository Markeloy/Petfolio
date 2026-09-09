import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./detail.css";
import { PwaRegister } from "./pwa-register";
import {getT,getPreferences} from '@/lib/i18n/server';
import {LanguageProvider} from '@/lib/i18n/client';
import './appearance.css';
import {Suspense} from 'react';
import {GlobalNavigation} from './components/global-navigation';

export async function generateMetadata():Promise<Metadata>{
 const t=await getT();
 return {
  title:t("Petfolio — всё о питомце"),
  description:t("Здоровье, забота и важные события ваших питомцев в одном месте"),
  applicationName: "Petfolio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Petfolio",
    statusBarStyle: "default",
  },
};
}

export async function generateViewport():Promise<Viewport> {
  const {theme}=await getPreferences();
  return {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: theme==='system'?[{media:'(prefers-color-scheme: light)',color:'#f7f4ee'},{media:'(prefers-color-scheme: dark)',color:'#171d19'}]:theme==='dark'?'#171d19':'#f7f4ee',
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const {locale,theme}=await getPreferences();
  return (
    <html lang={locale} data-theme={theme}>
      <body>
        <LanguageProvider locale={locale}>{children}<Suspense fallback={null}><GlobalNavigation/></Suspense></LanguageProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
