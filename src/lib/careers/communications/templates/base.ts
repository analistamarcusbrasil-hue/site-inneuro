import type { RenderedCareerCommunication } from "../types";

export function escapeCareerHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function textToCareerHtml(value: string) {
  return escapeCareerHtml(value).replaceAll("\n", "<br>");
}

export function renderCareerBase({
  subject,
  heading,
  text,
  bodyHtml,
  cta,
  replyTo,
}: {
  subject: string;
  heading: string;
  text: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  replyTo?: string;
}): RenderedCareerCommunication {
  const ctaText = cta ? `\n\n${cta.label}: ${cta.url}` : "";
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f4f8f6;font-family:Arial,sans-serif;color:#10231b;">
    <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
      <div style="background:#03251b;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
        <p style="margin:0 0 7px;color:#dff8ec;font-size:12px;font-weight:700;letter-spacing:.14em;">INNEURO</p>
        <h1 style="margin:0;font-size:22px;line-height:1.3;">${escapeCareerHtml(heading)}</h1>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #dde9e2;border-top:0;border-radius:0 0 18px 18px;line-height:1.65;">
        ${bodyHtml}
        ${
          cta
            ? `<p style="margin:24px 0 0;"><a href="${escapeCareerHtml(cta.url)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#087a4d;color:#fff;text-decoration:none;font-weight:700;">${escapeCareerHtml(cta.label)}</a></p>`
            : ""
        }
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #dde9e2;color:#65736d;font-size:12px;line-height:1.6;">
          INNEURO<br>Macapá - AP<br><a href="https://inneuroap.com.br" style="color:#087a4d;">https://inneuroap.com.br</a>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return {
    subject,
    text: `${text}${ctaText}\n\nINNEURO\nMacapá - AP\nhttps://inneuroap.com.br`,
    html,
    replyTo,
  };
}

export function greeting(name: string) {
  return `Olá, ${name}.`;
}
