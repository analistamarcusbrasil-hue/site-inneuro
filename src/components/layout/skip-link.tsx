"use client";

import type { MouseEvent } from "react";

export function SkipLink() {
  const focusMain = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const main = document.getElementById("main-content");
    if (!main) return;
    main.focus();
    main.scrollIntoView({ block: "start" });
    window.history.replaceState(null, "", "#main-content");
  };

  return (
    <a href="#main-content" className="skip-link" onClick={focusMain}>
      Ir para o conteúdo principal
    </a>
  );
}
