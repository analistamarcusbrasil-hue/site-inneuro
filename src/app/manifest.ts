import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "INNEURO | Instituto de Neurologia do Amapá",
    short_name: "INNEURO",
    description:
      "Diagnóstico por imagem, neurologia e medicina nuclear com tecnologia, precisão e cuidado.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7FAF8",
    theme_color: "#03251B",
  };
}
