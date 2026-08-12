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
  inferSchedulingModality,
  isValidCpf,
  preferredPeriods,
  sanitizeSchedulingText,
  schedulingModalities,
  type PreferredPeriod,
  type SchedulingExamInput,
  type SchedulingModality,
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

function parseExams(value: unknown): SchedulingExamInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20)
    return null;
  const allowedModalities = new Set(
    schedulingModalities.map((item) => item.id as string),
  );
  const parsed = value.map((item, order) => {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const modality = sanitizeSchedulingText(source.modality, 30);
    const description = sanitizeSchedulingText(source.description, 180);
    const examId = sanitizeSchedulingText(source.examId, 40) || null;
    if (
      !allowedModalities.has(modality) ||
      description.length < 2 ||
      (examId &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          examId,
        ))
    )
      return null;
    return {
      modality: modality as SchedulingModality,
      description,
      examId,
      order,
    };
  });
  if (parsed.some((item) => item === null)) return null;
  const exams = parsed as SchedulingExamInput[];
  const unique = new Set(
    exams.map(
      (item) =>
        `${item.modality}:${item.description.toLocaleLowerCase("pt-BR")}`,
    ),
  );
  return unique.size === exams.length ? exams : null;
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
    const insuranceId = sanitizeSchedulingText(body.insuranceId, 40);
    const insuranceName = sanitizeSchedulingText(body.insuranceName, 100);
    const observations = sanitizeSchedulingText(body.observations, 500);
    const exams = parseExams(body.exams);
    const dates = sanitizeArray(body.preferredDates, 2, 10);
    const periods = sanitizeArray(body.preferredPeriods, 4, 20);
    const channel = body.channel;

    if (patientName.length < 2)
      return json({ error: "Informe o nome do paciente." }, 400);
    if (!isValidCpf(cpf))
      return json({ error: "Confira o CPF informado." }, 400);
    if (!isValidDate(birthDate, false))
      return json({ error: "Informe uma data de nascimento válida." }, 400);
    if (!/^\d{10,11}$/.test(phone.replace(/\D/g, "")))
      return json({ error: "Informe um telefone válido com DDD." }, 400);
    if (!exams)
      return json(
        { error: "Informe pelo menos um exame e sua modalidade." },
        400,
      );
    if (dates.length < 1 || dates.some((date) => !isValidDate(date, true)))
      return json({ error: "Escolha uma data preferencial válida." }, 400);
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
    if (
      session.serviceType === "SUS" &&
      susAuthorizationRequired &&
      session.authorizationPending
    )
      return json(
        {
          error:
            "A autorização da regulação é obrigatória para concluir esta solicitação.",
        },
        400,
      );

    const officialExamIds = [
      ...new Set(exams.map((exam) => exam.examId).filter(Boolean)),
    ] as string[];
    const { data: officialRows, error: examsError } = officialExamIds.length
      ? await admin
          .from("exams")
          .select("id,name,modality")
          .in("id", officialExamIds)
          .eq("active", true)
          .eq("status", "published")
          .is("deleted_at", null)
      : { data: [], error: null };
    if (examsError || officialRows?.length !== officialExamIds.length)
      return json(
        { error: "Uma das sugestões selecionadas não está mais disponível." },
        400,
      );
    for (const exam of exams) {
      if (!exam.examId) continue;
      const official = officialRows?.find((item) => item.id === exam.examId);
      if (
        !official ||
        inferSchedulingModality(String(official.modality)) !== exam.modality
      )
        return json(
          { error: "Revise a modalidade dos exames informados." },
          400,
        );
    }
    const manifestExams = exams.map((exam) => ({
      id: exam.examId,
      name: exam.description,
      modality: exam.modality,
      officialName:
        officialRows?.find((item) => item.id === exam.examId)?.name ?? null,
      order: exam.order,
    }));

    const documents = await verifyUploadedDocuments(admin, session.documents);
    uploadedPaths = documents.map((document) => document.path);
    const createdAt = new Date().toISOString();
    const expiresAt = createManifestExpiration();
    const attendance = serviceLabels[session.serviceType];
    const manifest: SchedulingManifest = {
      version: 3,
      protocol: session.protocol,
      patientName,
      birthDate,
      phone,
      attendance,
      insuranceName: session.serviceType === "INSURANCE" ? insuranceName : null,
      exam: exams.map((exam) => exam.description).join(", "),
      preferredPeriod: periods
        .map((period) => periodLabels[period as PreferredPeriod])
        .join(", "),
      observations: observations || null,
      documents,
      serviceType: session.serviceType,
      exams: manifestExams,
      preferredDates: dates,
      preferredPeriods: periods,
      email: null,
      cpf,
      city: null,
      responsibleName: null,
      insuranceCardNumber: null,
      insuranceCardExpiry: null,
      insuranceHolderName: null,
      susCardNumber: null,
      susAuthorizationNumber: null,
      regulationNumber: null,
      susRequestNumber: null,
      sisregCode: null,
      originCity: null,
      requestingUnit: null,
      requestingProfessional: null,
      authorizationDate: null,
      authorizationExpiry: null,
      authorizationPending: session.authorizationPending,
      createdAt,
      expiresAt,
    };
    const databaseInput: SchedulingDatabaseInput = {
      patientName,
      cpf,
      birthDate,
      phone,
      email: null,
      city: null,
      responsibleName: null,
      serviceType: session.serviceType,
      insuranceId: insuranceId || null,
      insuranceName: session.serviceType === "INSURANCE" ? insuranceName : null,
      insuranceCardNumber: null,
      insuranceCardExpiry: null,
      insuranceHolderName: null,
      susCardNumber: null,
      susAuthorizationNumber: null,
      regulationNumber: null,
      susRequestNumber: null,
      sisregCode: null,
      originCity: null,
      requestingUnit: null,
      requestingProfessional: null,
      authorizationDate: null,
      authorizationExpiry: null,
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
    const documentKinds = new Set(documents.map((document) => document.kind));
    const groupedExamLines = schedulingModalities.flatMap((modality) => {
      const items = exams.filter((exam) => exam.modality === modality.id);
      return items.length
        ? [
            `*${modality.label.toLocaleUpperCase("pt-BR")}*`,
            ...items.map((exam) => `- ${exam.description}`),
          ]
        : [];
    });
    const message = [
      "*NOVA SOLICITAÇÃO DE AGENDAMENTO*",
      "",
      `Protocolo: ${session.protocol}`,
      "",
      "*PACIENTE*",
      `Nome: ${patientName}`,
      `CPF: ${cpf}`,
      `Nascimento: ${formatDate(birthDate)}`,
      `WhatsApp: ${phone}`,
      "",
      `*FORMA DE ATENDIMENTO:* ${attendance}`,
      session.serviceType === "INSURANCE" ? `Convênio: ${insuranceName}` : null,
      "",
      "*EXAMES*",
      ...groupedExamLines,
      "",
      "*DOCUMENTOS*",
      `- ${documentLabels.medicalOrder}: ${documentKinds.has("medicalOrder") ? "anexado" : "pendente"}`,
      `- ${documentLabels.photoId}: ${documentKinds.has("photoId") ? "anexado" : "pendente"}`,
      `- Carteirinha do convênio: ${session.serviceType === "INSURANCE" ? (documentKinds.has("insuranceCardFront") ? "anexada" : "pendente") : "não aplicável"}`,
      `- Guia do convênio: ${session.serviceType === "INSURANCE" ? (documentKinds.has("insuranceAuthorization") ? "anexada" : "não anexada") : "não aplicável"}`,
      `- Regulação SUS: ${session.serviceType === "SUS" ? (documentKinds.has("susAuthorization") ? "anexada" : "pendente") : "não aplicável"}`,
      `- Cartão SUS: ${session.serviceType === "SUS" ? (documentKinds.has("susCard") ? "anexado" : "não anexado") : "não aplicável"}`,
      "",
      `Data preferencial: ${dates.map(formatDate).join("; ")}`,
      `Períodos: ${periods.map((period) => periodLabels[period as PreferredPeriod]).join(", ")}`,
      `Observação: ${observations || "Não informada"}`,
      "",
      "Acesso seguro aos dados e documentos:",
      protectedUrl,
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
