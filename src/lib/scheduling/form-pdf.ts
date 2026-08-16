import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

type ProfileName =
  { full_name: string | null } | Array<{ full_name: string | null }> | null;

export type SchedulingFormData = {
  protocol: string;
  patient_name: string;
  cpf: string | null;
  birth_date: string;
  phone: string;
  email: string | null;
  service_type: string;
  insurance_name: string | null;
  insurance_card_number: string | null;
  insurance_card_expiry: string | null;
  insurer_reference: string | null;
  authorization_number: string | null;
  authorization_valid_until: string | null;
  preferred_dates: string[] | null;
  preferred_periods: string[] | null;
  notes: string | null;
  workflow_status: string;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
  unit_name: string;
  assigned: ProfileName;
  completed: ProfileName;
  appointment_request_exams: Array<{
    exam_name: string;
    modality: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    preparation_text: string | null;
    documents_to_bring: string[] | null;
  }>;
  appointment_request_documents: Array<{
    document_type: string;
    file_name: string;
  }>;
};

const serviceLabels: Record<string, string> = {
  PARTICULAR: "Particular",
  INSURANCE: "Convênio",
  SUS: "SUS",
};

const workflowLabels: Record<string, string> = {
  NOVO: "Novo",
  EM_ANALISE: "Em análise",
  AGUARDANDO_CONVENIO: "Aguardando convênio",
  PENDENCIA: "Pendência",
  RECUSADO: "Recusado",
  AUTORIZADO: "Autorizado",
  CONCLUIDO: "Atendido",
  CANCELADO: "Cancelado",
};

const preferredPeriodLabels: Record<string, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  EVENING: "Noite",
  ANY: "Qualquer período",
};

export const schedulingDocumentLabels: Record<string, string> = {
  photo_id: "Documento com foto",
  medical_request: "Pedido médico",
  sus_authorization: "Autorização SUS",
  sus_card: "Cartão SUS",
  insurance_card_front: "Carteirinha do convênio",
  insurance_card_back: "Carteirinha do convênio — verso",
  insurance_authorization: "Autorização do convênio",
  other: "Outro documento",
};

function relationName(relation: ProfileName) {
  return Array.isArray(relation)
    ? relation[0]?.full_name || null
    : relation?.full_name || null;
}

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "Não informado";
  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return withTime
    ? date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Belem",
      })
    : date.toLocaleDateString("pt-BR");
}

function safePdfText(value: unknown) {
  return String(value ?? "")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("‘", "'")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("•", "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

export function sanitizeDownloadName(value: string, fallback = "arquivo") {
  const safe = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 140);
  return safe || fallback;
}

export function schedulingFormFileName(protocol: string, patientName: string) {
  const safeProtocol = sanitizeDownloadName(protocol, "protocolo");
  const safePatient = sanitizeDownloadName(patientName, "paciente");
  return `INNEURO_PreAgendamento_${safeProtocol}_${safePatient}.pdf`;
}

function splitLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const parts: string[] = [];
  let current = "";
  for (const character of word) {
    const candidate = current + character;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      parts.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const result: string[] = [];
  for (const paragraph of safePdfText(text).split(/\r?\n/)) {
    if (!paragraph.trim()) {
      result.push("");
      continue;
    }
    let line = "";
    const words = paragraph
      .trim()
      .split(/\s+/)
      .flatMap((word) =>
        font.widthOfTextAtSize(word, size) > maxWidth
          ? splitLongWord(word, font, size, maxWidth)
          : [word],
      );
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        result.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

export async function buildSchedulingFormPdf(data: SchedulingFormData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const brand = rgb(0.015, 0.31, 0.23);
  const muted = rgb(0.35, 0.4, 0.39);
  let page: PDFPage;
  let y = 0;

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    page.drawRectangle({
      x: 0,
      y: pageHeight - 12,
      width: pageWidth,
      height: 12,
      color: brand,
    });
  };

  const ensureSpace = (height: number) => {
    if (y - height < 58) addPage();
  };

  const line = (
    text: string,
    options?: {
      bold?: boolean;
      size?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
    },
  ) => {
    const font = options?.bold ? bold : regular;
    const size = options?.size ?? 10;
    const indent = options?.indent ?? 0;
    const lines = wrapText(text, font, size, contentWidth - indent);
    const lineHeight = size + 4;
    for (const item of lines.length ? lines : [""]) {
      ensureSpace(lineHeight);
      page.drawText(item, {
        x: margin + indent,
        y,
        size,
        font,
        color: options?.color ?? rgb(0.08, 0.15, 0.13),
      });
      y -= lineHeight;
    }
  };

  const section = (title: string) => {
    ensureSpace(56);
    y -= 8;
    page.drawLine({
      start: { x: margin, y: y + 8 },
      end: { x: pageWidth - margin, y: y + 8 },
      thickness: 0.7,
      color: rgb(0.82, 0.87, 0.85),
    });
    line(title.toUpperCase(), { bold: true, size: 11, color: brand });
    y -= 3;
  };

  const field = (label: string, value: unknown) => {
    ensureSpace(38);
    line(label.toUpperCase(), { bold: true, size: 7.5, color: muted });
    line(String(value || "Não informado"), { size: 10 });
    y -= 3;
  };

  addPage();
  line("INNEURO", { bold: true, size: 22, color: brand });
  line("PRÉ-AGENDAMENTO", { bold: true, size: 13 });
  y -= 8;
  field("Protocolo", data.protocol);
  field("Data da solicitação", formatDate(data.created_at, true));

  section("Paciente");
  field("Nome", data.patient_name);
  field("CPF", data.cpf);
  field("Data de nascimento", formatDate(data.birth_date));
  field("Telefone", data.phone);
  field("E-mail", data.email);

  section("Atendimento");
  field("Tipo", serviceLabels[data.service_type] || data.service_type);
  if (data.service_type === "INSURANCE") {
    field("Convênio", data.insurance_name);
    field("Carteirinha", data.insurance_card_number);
    field("Validade da carteirinha", formatDate(data.insurance_card_expiry));
    if (data.insurer_reference)
      field("Número/referência", data.insurer_reference);
    if (data.authorization_number)
      field("Autorização", data.authorization_number);
    if (data.authorization_valid_until)
      field(
        "Validade da autorização",
        formatDate(data.authorization_valid_until),
      );
  }

  section("Exames solicitados");
  if (data.appointment_request_exams.length) {
    data.appointment_request_exams.forEach((exam, index) =>
      line(
        `${index + 1}. ${exam.exam_name}${exam.modality ? ` (${exam.modality})` : ""}`,
      ),
    );
  } else {
    line("Nenhum exame informado.");
  }

  section("Preferências informadas pelo paciente");
  field(
    "Datas",
    data.preferred_dates?.length
      ? data.preferred_dates.map((date) => formatDate(date)).join(", ")
      : "Não informadas",
  );
  field(
    "Períodos",
    data.preferred_periods?.length
      ? data.preferred_periods
          .map((period) => preferredPeriodLabels[period] || period)
          .join(", ")
      : "Não informados",
  );

  section("Observações do paciente");
  line(data.notes || "Nenhuma observação enviada.");

  section("Documentos enviados");
  if (data.appointment_request_documents.length) {
    data.appointment_request_documents.forEach((document, index) =>
      line(
        `${index + 1}. ${schedulingDocumentLabels[document.document_type] || "Documento"} - ${document.file_name}`,
      ),
    );
  } else {
    line("Nenhum documento enviado.");
  }

  const assignedName = relationName(data.assigned);
  if (data.claimed_at || assignedName || data.completed_at) {
    section("Situação do atendimento");
    field(
      "Status",
      workflowLabels[data.workflow_status] || data.workflow_status,
    );
    field("Atendente responsável", assignedName);
    field("Assumido em", formatDate(data.claimed_at, true));
  }

  const scheduledExams = data.appointment_request_exams.filter(
    (exam) => exam.scheduled_date,
  );
  if (scheduledExams.length) {
    section("Agendamento");
    scheduledExams.forEach((exam, index) => {
      line(`${index + 1}. ${exam.exam_name}`, { bold: true });
      field("Data", formatDate(exam.scheduled_date));
      field("Horário", exam.scheduled_time?.slice(0, 5));
      field("Unidade", data.unit_name);
      field("Preparo", exam.preparation_text || "Não informado");
      field(
        "Documentos/orientações para comparecimento",
        exam.documents_to_bring?.length
          ? exam.documents_to_bring.join("; ")
          : "Nenhuma orientação adicional.",
      );
    });
  }

  if (data.completed_at) {
    section("Atendimento concluído");
    field("Atendido por", relationName(data.completed));
    field("Concluído em", formatDate(data.completed_at, true));
  }

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Página ${index + 1} de ${pages.length}`, {
      x: margin,
      y: 28,
      size: 8,
      font: regular,
      color: muted,
    });
    pdfPage.drawText("Documento administrativo confidencial", {
      x: pageWidth - margin - 166,
      y: 28,
      size: 8,
      font: regular,
      color: muted,
    });
  });

  return pdf.save();
}
