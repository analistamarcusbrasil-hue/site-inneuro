import type { NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { createWhatsAppUrl } from "@/lib/whatsapp";
import {
  createManifestExpiration,
  ensureSchedulingBucket,
  getSchedulingAdminClient,
  isSecureSchedulingRequest,
  readUploadSessionToken,
  saveSchedulingManifest,
  verifyUploadedDocuments,
  type SchedulingManifest,
} from "@/lib/scheduling/server";
import { sanitizeSchedulingText } from "@/lib/scheduling/shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: responseHeaders });
}

function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  const [year, month, day] = value.split("-").map(Number);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day &&
    parsed <= new Date()
  );
}

function formatBirthDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!isSecureSchedulingRequest(request))
      return json({ error: "O envio seguro requer uma conexão HTTPS." }, 400);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 64 * 1024)
      return json({ error: "Solicitação inválida." }, 413);

    const body = (await request.json()) as Record<string, unknown>;
    if (sanitizeSchedulingText(body.website, 80)) return json({ ok: true });
    if (body.consent !== true)
      return json(
        { error: "Autorize o uso dos dados e documentos para continuar." },
        400,
      );

    const sessionToken = String(body.sessionToken ?? "");
    const session = readUploadSessionToken(sessionToken);
    if (!session)
      return json(
        { error: "A sessão de envio expirou. Tente novamente." },
        400,
      );

    const patientName = sanitizeSchedulingText(body.name, 120);
    const phone = sanitizeSchedulingText(body.phone, 24);
    const birthDate = sanitizeSchedulingText(body.birthDate, 10);
    const attendance = sanitizeSchedulingText(body.attendance, 20);
    const insuranceName = sanitizeSchedulingText(body.insuranceName, 100);
    const exam = sanitizeSchedulingText(body.exam, 160);
    const preferredPeriod = sanitizeSchedulingText(body.period, 40);
    const observations = sanitizeSchedulingText(body.observations, 500);
    const channel = body.channel;

    if (patientName.length < 2)
      return json({ error: "Informe seu nome." }, 400);
    if (!/^\d{10,11}$/.test(phone.replace(/\D/g, "")))
      return json({ error: "Informe um telefone válido com DDD." }, 400);
    if (!isValidBirthDate(birthDate))
      return json({ error: "Informe uma data de nascimento válida." }, 400);
    if (attendance !== "Particular" && attendance !== "Convênio")
      return json({ error: "Selecione o tipo de atendimento." }, 400);
    if (attendance !== session.attendance)
      return json(
        { error: "O tipo de atendimento mudou. Tente o envio novamente." },
        400,
      );
    if (attendance === "Convênio" && !insuranceName)
      return json({ error: "Informe o nome do convênio." }, 400);
    if (!exam)
      return json(
        { error: "Informe o exame ou procedimento solicitado." },
        400,
      );
    if (!["Manhã", "Tarde", "Sem preferência"].includes(preferredPeriod))
      return json({ error: "Selecione o melhor período." }, 400);
    if (channel !== "primary" && channel !== "secondary")
      return json({ error: "Selecione um canal de WhatsApp válido." }, 400);

    const admin = getSchedulingAdminClient();
    await ensureSchedulingBucket(admin);
    const documents = await verifyUploadedDocuments(admin, session.documents);
    const createdAt = new Date().toISOString();
    const expiresAt = createManifestExpiration();
    const manifest: SchedulingManifest = {
      version: 1,
      protocol: session.protocol,
      patientName,
      birthDate,
      phone,
      attendance,
      insuranceName: attendance === "Convênio" ? insuranceName : null,
      exam,
      preferredPeriod,
      observations: observations || null,
      documents,
      createdAt,
      expiresAt,
    };
    await saveSchedulingManifest(admin, session.accessToken, manifest);

    const protectedUrl = `${siteConfig.url.replace(/\/$/, "")}/solicitacao/${session.accessToken}`;
    const hasInsuranceCard = documents.some(
      (document) => document.kind === "insuranceCard",
    );
    const message = [
      "Olá, equipe INNEURO! Gostaria de solicitar um pré-agendamento.",
      "",
      "*PROTOCOLO*",
      session.protocol,
      "",
      "*DADOS DO PACIENTE*",
      `Nome: ${patientName}`,
      `Data de nascimento: ${formatBirthDate(birthDate)}`,
      `Telefone: ${phone}`,
      "",
      "*ATENDIMENTO*",
      `Modalidade: ${attendance}`,
      `Convênio: ${attendance === "Convênio" ? insuranceName : "Não se aplica"}`,
      `Exame ou procedimento: ${exam}`,
      `Período preferido: ${preferredPeriod}`,
      `Observações: ${observations || "Não informadas"}`,
      "",
      "*DOCUMENTOS ENVIADOS*",
      "Documento com foto: Sim",
      "Pedido médico: Sim",
      `Carteirinha do convênio: ${hasInsuranceCard ? "Sim" : "Não se aplica"}`,
      "",
      "Acesso seguro aos dados e documentos:",
      protectedUrl,
      "",
      "Os documentos ficarão disponíveis temporariamente.",
      "",
      "Aguardo a confirmação da data e do horário. Obrigado(a)!",
    ].join("\n");
    const whatsappUrl = createWhatsAppUrl(
      siteConfig.whatsapp[channel].number,
      message,
    );
    return json({ protocol: session.protocol, protectedUrl, whatsappUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message && !message.startsWith("SCHEDULING_") && message.length <= 160)
      return json({ error: message }, 400);
    if (message === "SCHEDULING_NOT_CONFIGURED")
      return json(
        { error: "O envio de documentos está temporariamente indisponível." },
        503,
      );
    return json(
      {
        error:
          "Não foi possível concluir o envio. Seus dados foram mantidos; tente novamente.",
      },
      500,
    );
  }
}
