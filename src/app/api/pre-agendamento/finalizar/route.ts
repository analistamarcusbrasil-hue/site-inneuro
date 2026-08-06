import type { NextRequest } from "next/server";
import { getPublicInstitutionalContent } from "@/lib/cms/public-content";
import { createWhatsAppUrl } from "@/lib/whatsapp";
import {
  createManifestExpiration,
  deleteSchedulingRequestRecord,
  ensureSchedulingBucket,
  getSchedulingAdminClient,
  isSecureSchedulingRequest,
  readUploadSessionToken,
  removeDocuments,
  saveSchedulingManifest,
  saveSchedulingRequestRecord,
  verifyUploadedDocuments,
  type SchedulingDatabaseInput,
  type SchedulingManifest,
} from "@/lib/scheduling/server";
import {
  documentLabels,
  preferredPeriods,
  sanitizeSchedulingText,
  type PreferredPeriod,
} from "@/lib/scheduling/shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

const serviceLabels = {
  PARTICULAR: "Particular",
  INSURANCE: "Convênio",
  SUS: "SUS",
} as const;
const periodLabels: Record<PreferredPeriod, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  EVENING: "Noite",
  ANY: "Sem preferência",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: responseHeaders });
}

function isValidDate(value: string, allowFuture: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  const [year, month, day] = value.split("-").map(Number);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  )
    return false;
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  return allowFuture
    ? parsed >= new Date(new Date().toISOString().slice(0, 10))
    : parsed <= today;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function sanitizeArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => sanitizeSchedulingText(item, maxLength))
        .filter(Boolean),
    ),
  ].slice(0, maxItems);
}

export async function POST(request: NextRequest) {
  let uploadedPaths: string[] = [];
  try {
    if (!isSecureSchedulingRequest(request))
      return json({ error: "O envio seguro requer uma conexão HTTPS." }, 400);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 96 * 1024)
      return json({ error: "Solicitação inválida." }, 413);

    const body = (await request.json()) as Record<string, unknown>;
    if (sanitizeSchedulingText(body.website, 80)) return json({ ok: true });
    if (body.consent !== true)
      return json(
        { error: "Autorize o uso dos dados e documentos para continuar." },
        400,
      );

    const session = readUploadSessionToken(String(body.sessionToken ?? ""));
    if (!session)
      return json(
        { error: "A sessão de envio expirou. Tente novamente." },
        400,
      );

    const patientName = sanitizeSchedulingText(body.name, 120);
    const cpf = sanitizeSchedulingText(body.cpf, 18).replace(/\D/g, "");
    const birthDate = sanitizeSchedulingText(body.birthDate, 10);
    const phone = sanitizeSchedulingText(body.phone, 24);
    const email = sanitizeSchedulingText(body.email, 160).toLowerCase();
    const city = sanitizeSchedulingText(body.city, 100);
    const responsibleName = sanitizeSchedulingText(body.responsibleName, 120);
    const insuranceId = sanitizeSchedulingText(body.insuranceId, 40);
    const insuranceName = sanitizeSchedulingText(body.insuranceName, 100);
    const insuranceCardNumber = sanitizeSchedulingText(
      body.insuranceCardNumber,
      80,
    );
    const insuranceCardExpiry = sanitizeSchedulingText(
      body.insuranceCardExpiry,
      10,
    );
    const insuranceHolderName = sanitizeSchedulingText(
      body.insuranceHolderName,
      120,
    );
    const susCardNumber = sanitizeSchedulingText(
      body.susCardNumber,
      30,
    ).replace(/\D/g, "");
    const susAuthorizationNumber = sanitizeSchedulingText(
      body.susAuthorizationNumber,
      100,
    );
    const regulationNumber = sanitizeSchedulingText(body.regulationNumber, 100);
    const susRequestNumber = sanitizeSchedulingText(body.susRequestNumber, 100);
    const sisregCode = sanitizeSchedulingText(body.sisregCode, 100);
    const originCity = sanitizeSchedulingText(body.originCity, 100);
    const requestingUnit = sanitizeSchedulingText(body.requestingUnit, 160);
    const requestingProfessional = sanitizeSchedulingText(
      body.requestingProfessional,
      160,
    );
    const authorizationDate = sanitizeSchedulingText(
      body.authorizationDate,
      10,
    );
    const authorizationExpiry = sanitizeSchedulingText(
      body.authorizationExpiry,
      10,
    );
    const observations = sanitizeSchedulingText(body.observations, 1000);
    const examIds = sanitizeArray(body.examIds, 12, 40);
    const dates = sanitizeArray(body.preferredDates, 3, 10);
    const periods = sanitizeArray(body.preferredPeriods, 4, 20);
    const channel = body.channel;

    if (patientName.length < 2)
      return json({ error: "Informe o nome do paciente." }, 400);
    if (cpf && cpf.length !== 11)
      return json(
        { error: "Informe um CPF válido ou deixe o campo em branco." },
        400,
      );
    if (!isValidDate(birthDate, false))
      return json({ error: "Informe uma data de nascimento válida." }, 400);
    if (!/^\d{10,11}$/.test(phone.replace(/\D/g, "")))
      return json({ error: "Informe um telefone válido com DDD." }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json(
        { error: "Informe um e-mail válido ou deixe o campo em branco." },
        400,
      );
    if (examIds.length < 1)
      return json({ error: "Selecione pelo menos um exame." }, 400);
    if (dates.length < 1 || dates.some((date) => !isValidDate(date, true)))
      return json({ error: "Escolha de uma a três datas válidas." }, 400);
    if (
      periods.length < 1 ||
      periods.some(
        (period) => !(preferredPeriods as readonly string[]).includes(period),
      )
    )
      return json({ error: "Selecione ao menos um período." }, 400);
    if (periods.includes("ANY") && periods.length > 1)
      return json(
        { error: "Escolha períodos específicos ou marque sem preferência." },
        400,
      );
    if (channel !== "primary" && channel !== "secondary")
      return json({ error: "Selecione um canal de WhatsApp válido." }, 400);

    const admin = getSchedulingAdminClient();
    await ensureSchedulingBucket(admin);

    const { data: schedulingSetting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "scheduling")
      .maybeSingle();
    const settingValue = (schedulingSetting?.value ?? {}) as Record<
      string,
      unknown
    >;
    const susAuthorizationRequired =
      settingValue.sus_authorization_required === true;
    if (session.serviceType === "INSURANCE" && !insuranceName)
      return json({ error: "Informe o convênio." }, 400);
    if (session.serviceType === "INSURANCE" && insuranceId) {
      const { data: partner } = await admin
        .from("health_partners")
        .select("id,name")
        .eq("id", insuranceId)
        .eq("kind", "convenio")
        .eq("active", true)
        .eq("status", "published")
        .is("deleted_at", null)
        .maybeSingle();
      if (!partner || partner.name !== insuranceName)
        return json(
          { error: "O convênio selecionado não está disponível." },
          400,
        );
    }
    if (insuranceCardExpiry && !isValidDate(insuranceCardExpiry, true))
      return json(
        { error: "Informe uma validade válida para a carteirinha." },
        400,
      );
    if (session.serviceType === "SUS") {
      if (susCardNumber && susCardNumber.length !== 15)
        return json({ error: "O Cartão SUS deve ter 15 números." }, 400);
      if (
        !regulationNumber &&
        !susAuthorizationNumber &&
        !susRequestNumber &&
        !sisregCode &&
        !session.authorizationPending
      )
        return json(
          {
            error:
              "Informe o número da autorização ou regulação, ou marque que o documento está pendente.",
          },
          400,
        );
      if (susAuthorizationRequired && session.authorizationPending)
        return json(
          {
            error:
              "A autorização da regulação é obrigatória para concluir esta solicitação.",
          },
          400,
        );
      if (authorizationDate && !isValidDate(authorizationDate, false))
        return json(
          { error: "Informe uma data válida para a autorização." },
          400,
        );
      if (authorizationExpiry && !isValidDate(authorizationExpiry, true))
        return json(
          { error: "Informe uma validade válida para a autorização." },
          400,
        );
    }

    const { data: examRows, error: examsError } = await admin
      .from("exams")
      .select("id,name,modality")
      .in("id", examIds)
      .eq("active", true)
      .eq("status", "published")
      .is("deleted_at", null);
    if (examsError || !examRows || examRows.length !== examIds.length)
      return json(
        { error: "Um dos exames selecionados não está mais disponível." },
        400,
      );
    const exams = examIds.map((id) => {
      const exam = examRows.find((item) => item.id === id)!;
      return {
        id: exam.id as string,
        name: String(exam.name),
        modality: exam.modality ? String(exam.modality) : null,
      };
    });

    const documents = await verifyUploadedDocuments(admin, session.documents);
    uploadedPaths = documents.map((document) => document.path);
    const createdAt = new Date().toISOString();
    const expiresAt = createManifestExpiration();
    const attendance = serviceLabels[session.serviceType];
    const manifest: SchedulingManifest = {
      version: 2,
      protocol: session.protocol,
      patientName,
      birthDate,
      phone,
      attendance,
      insuranceName: session.serviceType === "INSURANCE" ? insuranceName : null,
      exam: exams.map((exam) => exam.name).join(", "),
      preferredPeriod: periods
        .map((period) => periodLabels[period as PreferredPeriod])
        .join(", "),
      observations: observations || null,
      documents,
      serviceType: session.serviceType,
      exams,
      preferredDates: dates,
      preferredPeriods: periods,
      email: email || null,
      cpf: cpf || null,
      city: city || null,
      responsibleName: responsibleName || null,
      insuranceCardNumber: insuranceCardNumber || null,
      insuranceCardExpiry: insuranceCardExpiry || null,
      insuranceHolderName: insuranceHolderName || null,
      susCardNumber: susCardNumber || null,
      susAuthorizationNumber: susAuthorizationNumber || null,
      regulationNumber: regulationNumber || null,
      susRequestNumber: susRequestNumber || null,
      sisregCode: sisregCode || null,
      originCity: originCity || null,
      requestingUnit: requestingUnit || null,
      requestingProfessional: requestingProfessional || null,
      authorizationDate: authorizationDate || null,
      authorizationExpiry: authorizationExpiry || null,
      authorizationPending: session.authorizationPending,
      createdAt,
      expiresAt,
    };
    const databaseInput: SchedulingDatabaseInput = {
      patientName,
      cpf: cpf || null,
      birthDate,
      phone,
      email: email || null,
      city: city || null,
      responsibleName: responsibleName || null,
      serviceType: session.serviceType,
      insuranceId: insuranceId || null,
      insuranceName: session.serviceType === "INSURANCE" ? insuranceName : null,
      insuranceCardNumber: insuranceCardNumber || null,
      insuranceCardExpiry: insuranceCardExpiry || null,
      insuranceHolderName: insuranceHolderName || null,
      susCardNumber: susCardNumber || null,
      susAuthorizationNumber: susAuthorizationNumber || null,
      regulationNumber: regulationNumber || null,
      susRequestNumber: susRequestNumber || null,
      sisregCode: sisregCode || null,
      originCity: originCity || null,
      requestingUnit: requestingUnit || null,
      requestingProfessional: requestingProfessional || null,
      authorizationDate: authorizationDate || null,
      authorizationExpiry: authorizationExpiry || null,
      authorizationPending: session.authorizationPending,
      preferredDates: dates,
      preferredPeriods: periods,
      observations: observations || null,
      exams,
    };
    const requestId = await saveSchedulingRequestRecord(
      admin,
      session.accessToken,
      manifest,
      databaseInput,
    );
    try {
      await saveSchedulingManifest(admin, session.accessToken, manifest);
    } catch (error) {
      await deleteSchedulingRequestRecord(admin, requestId);
      await removeDocuments(admin, uploadedPaths);
      throw error;
    }

    const { config } = await getPublicInstitutionalContent();
    const protectedUrl = `${config.url.replace(/\/$/, "")}/solicitacao/${session.accessToken}`;
    const documentSummary = documents.reduce<Record<string, number>>(
      (result, document) => {
        result[document.kind] = (result[document.kind] ?? 0) + 1;
        return result;
      },
      {},
    );
    const message = [
      "Olá, equipe INNEURO! Enviei uma solicitação de agendamento pelo site.",
      "",
      `*PROTOCOLO:* ${session.protocol}`,
      "",
      "*PACIENTE*",
      `Nome: ${patientName}`,
      `Nascimento: ${formatDate(birthDate)}`,
      `Telefone: ${phone}`,
      `E-mail: ${email || "Não informado"}`,
      `Cidade: ${city || "Não informada"}`,
      responsibleName ? `Responsável: ${responsibleName}` : null,
      "",
      "*SOLICITAÇÃO*",
      `Atendimento: ${attendance}`,
      session.serviceType === "INSURANCE" ? `Convênio: ${insuranceName}` : null,
      session.serviceType === "SUS"
        ? `CNS: ${susCardNumber || "Não informado"}`
        : null,
      session.serviceType === "SUS"
        ? `Autorização/regulação: ${session.authorizationPending ? "Pendente" : regulationNumber || susAuthorizationNumber || "Não informada"}`
        : null,
      session.serviceType === "SUS"
        ? `SISREG: ${sisregCode || "Não informado"}`
        : null,
      session.serviceType === "SUS"
        ? `Município: ${originCity || city || "Não informado"}`
        : null,
      session.serviceType === "SUS"
        ? `Unidade solicitante: ${requestingUnit || "Não informada"}`
        : null,
      `Exames: ${exams.map((exam) => exam.name).join("; ")}`,
      `Datas preferidas: ${dates.map(formatDate).join("; ")}`,
      `Períodos: ${periods.map((period) => periodLabels[period as PreferredPeriod]).join(", ")}`,
      `Observações: ${observations || "Não informadas"}`,
      "",
      `*DOCUMENTOS:* ${documents.length} arquivo(s) — ${Object.entries(
        documentSummary,
      )
        .map(
          ([kind, count]) =>
            `${documentLabels[kind as keyof typeof documentLabels]}: ${count}`,
        )
        .join(", ")}`,
      "Acesso seguro aos dados e documentos:",
      protectedUrl,
      "",
      "Aguardo a confirmação da equipe. Obrigado(a)!",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
    const whatsappUrl = createWhatsAppUrl(
      config.whatsapp[channel].number,
      message,
    );
    return json({ protocol: session.protocol, protectedUrl, whatsappUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message && !message.startsWith("SCHEDULING_") && message.length <= 180)
      return json({ error: message }, 400);
    if (message === "SCHEDULING_NOT_CONFIGURED")
      return json(
        { error: "O envio de documentos está temporariamente indisponível." },
        503,
      );
    return json(
      {
        error:
          "Não foi possível concluir o envio. Revise os dados e tente novamente.",
      },
      500,
    );
  }
}
