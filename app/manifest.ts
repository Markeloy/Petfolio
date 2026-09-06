import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Petfolio",
    short_name: "Petfolio",
    description: "Здоровье, уход и важные события ваших питомцев в одном месте",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#f7f4ee",
    lang: "ru",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/petfolio-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
