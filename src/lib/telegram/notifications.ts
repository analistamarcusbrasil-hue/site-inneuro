type TelegramDocument = {
  kind: string;
};

type NewSchedulingRequestTelegramInput = {
  requestId: string;
  protocol: string;
  patientName: string;
  phone: string;
  email: string;
  serviceType: "PARTICULAR" | "INSURANCE" | "SUS";
  insuranceName: string | null;
  exams: string[];
  preferredDates: string[];
  preferredPeriods: string[];
  documents: TelegramDocument[];
  siteUrl: string;
};

const periodLabels: Record<string, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  EVENING: "Noite",
  ANY: "Sem preferência",
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

function documentLine(attached: boolean, label: string, missing: string) {
  return `${attached ? "✅" : "⚠️"} ${attached ? label : missing}`;
}

export function buildNewSchedulingRequestTelegramNotification(
  input: NewSchedulingRequestTelegramInput,
) {
  const documentKinds = new Set(input.documents.map((item) => item.kind));
  const attendance =
    input.serviceType === "INSURANCE"
      ? `Convênio${input.insuranceName ? ` — ${input.insuranceName}` : ""}`
      : input.serviceType === "SUS"
        ? "SUS"
        : "Particular";
  const documentLines = [
    documentLine(
      documentKinds.has("medicalOrder"),
      "Pedido médico",
      "Pedido médico não anexado",
    ),
    documentLine(
      documentKinds.has("photoId"),
      "Documento com foto",
      "Documento com foto não anexado",
    ),
  ];
  if (input.serviceType === "INSURANCE") {
    documentLines.push(
      documentLine(
        documentKinds.has("insuranceCardFront"),
        "Carteirinha",
        "Carteirinha não anexada",
      ),
      documentLine(
        documentKinds.has("insuranceAuthorization"),
        "Guia",
        "Guia não anexada",
      ),
    );
  }
  if (input.serviceType === "SUS") {
    documentLines.push(
      documentLine(
        documentKinds.has("susAuthorization"),
        "Regulação SUS",
        "Regulação SUS não anexada",
      ),
      documentLine(
        documentKinds.has("susCard"),
        "Cartão SUS",
        "Cartão SUS não anexado",
      ),
    );
  }

  const text = [
    "🔔 NOVA SOLICITAÇÃO DE AGENDAMENTO",
    "",
    `Protocolo: ${input.protocol}`,
    "",
    "👤 PACIENTE",
    input.patientName,
    "",
    "📱 WhatsApp",
    formatPhone(input.phone),
    "",
    "📧 E-mail",
    input.email,
    "",
    "🏥 ATENDIMENTO",
    attendance,
    "",
    "🩺 EXAMES",
    ...input.exams.map((exam) => `• ${exam}`),
    "",
    "📅 PREFERÊNCIA",
    input.preferredDates.map(formatDate).join(" • "),
    input.preferredPeriods
      .map((period) => periodLabels[period] ?? period)
      .join(" • "),
    "",
    "📎 DOCUMENTOS",
    ...documentLines,
    "",
    "Nova solicitação aguardando análise da recepção.",
  ].join("\n");
  const adminDeepLink = `${input.siteUrl.replace(/\/$/, "")}/admin/solicitacoes?solicitacao=${encodeURIComponent(input.requestId)}`;

  return { text, adminDeepLink };
}

export async function sendNewSchedulingRequestTelegramNotification(
  input: NewSchedulingRequestTelegramInput,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!token || !chatId) throw new Error("TELEGRAM_NOT_CONFIGURED");

  const notification = buildNewSchedulingRequestTelegramNotification(input);
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: notification.text,
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📋 ABRIR SOLICITAÇÃO",
                url: notification.adminDeepLink,
              },
            ],
          ],
        },
      }),
      signal: AbortSignal.timeout(4_500),
    },
  );
  if (!response.ok) throw new Error("TELEGRAM_NOTIFICATION_FAILED");
  const result = (await response.json()) as { ok?: boolean };
  if (result.ok !== true) throw new Error("TELEGRAM_NOTIFICATION_FAILED");
}
