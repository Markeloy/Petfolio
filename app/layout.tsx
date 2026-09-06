import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

export const metadata: Metadata = {
  title: "Petfolio — всё о питомце",
  description: "Здоровье, забота и важные события ваших питомцев в одном месте",
  applicationName: "Petfolio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Petfolio",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f4ee",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
