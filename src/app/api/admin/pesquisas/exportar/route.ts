import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/cms/auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { surveyDateRange, surveyCategoryLabels } from "@/lib/surveys/logic";
import {
  auditSurveyAction,
  getSurveyAdminContext,
  getSurveyMetrics,
} from "@/lib/surveys/server";
import type {
  SurveyDashboardMetrics,
  SurveyPeriodPreset,
} from "@/lib/surveys/types";
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (
    !session.user ||
    !session.profile ||
    !hasAdminPermission(session.profile, "surveys.reports")
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const context = await getSurveyAdminContext(session.user.id);
  if (!context)
    return NextResponse.json({ error: "NO_SCOPE" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const format = params.get("formato") === "xlsx" ? "xlsx" : "pdf";
  const preset = (params.get("periodo") ?? "30d") as SurveyPeriodPreset;
  let range = surveyDateRange(preset);
  let metrics = await getSurveyMetrics({
    organizationId: context.organization.id,
    unitId: context.unit?.id ?? null,
    start: range.start,
    exclusiveEnd: range.exclusiveEnd,
  });
  const snapshotId = params.get("snapshot");
  if (snapshotId) {
    const { data: snapshot } = await context.admin
      .from("survey_monthly_snapshots")
      .select("snapshot_data")
      .eq("id", snapshotId)
      .eq("organization_id", context.organization.id)
      .maybeSingle();
    const payload = snapshot?.snapshot_data as
      | {
          metrics?: SurveyDashboardMetrics;
          period?: { start?: string; end?: string };
        }
      | undefined;
    if (!payload?.metrics)
      return NextResponse.json(
        { error: "SNAPSHOT_NOT_FOUND" },
        { status: 404 },
      );
    metrics = payload.metrics;
    if (payload.period?.start && payload.period.end)
      range = {
        start: new Date(payload.period.start),
        end: new Date(new Date(payload.period.end).getTime() - 1),
        exclusiveEnd: new Date(payload.period.end),
      };
  }
  await auditSurveyAction({
    actorId: session.user.id,
    action: "SURVEY_EXPORT_GENERATED",
    entityType: "survey_report",
    entityId: context.campaign.id,
    after: {
      format,
      start: range.start.toISOString(),
      end: range.exclusiveEnd.toISOString(),
    },
  });
  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "INNEURO";
    const summary = workbook.addWorksheet("Resumo");
    summary.columns = [
      { header: "Indicador", key: "indicator", width: 32 },
      { header: "Valor", key: "value", width: 22 },
    ];
    [
      ["Organização", context.organization.name],
      ["Unidade", context.unit?.name ?? "Todas"],
      ["Respostas", metrics.responseCount],
      ["Nota geral", metrics.overallScore ?? "Sem dados"],
      ["NPS", metrics.nps ?? "Sem dados"],
      [
        "Satisfação positiva",
        metrics.positiveRate === null
          ? "Sem dados"
          : `${metrics.positiveRate}%`,
      ],
      ["Avaliações críticas", metrics.criticalCount],
    ].forEach(([indicator, value]) => summary.addRow({ indicator, value }));
    summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    summary.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF087A4D" },
    };
    const dimensions = workbook.addWorksheet("Dimensões");
    dimensions.columns = [
      { header: "Dimensão", key: "dimension", width: 32 },
      { header: "Média", key: "average", width: 14 },
      { header: "Respostas", key: "responses", width: 14 },
      { header: "Nota 1", key: "one", width: 12 },
      { header: "Nota 2", key: "two", width: 12 },
      { header: "Nota 3", key: "three", width: 12 },
      { header: "Nota 4", key: "four", width: 12 },
      { header: "Nota 5", key: "five", width: 12 },
    ];
    metrics.dimensions.forEach((item) =>
      dimensions.addRow({
        dimension: surveyCategoryLabels[item.category] ?? item.category,
        average: item.average,
        responses: item.response_count,
        one: item.distribution["1"] ?? 0,
        two: item.distribution["2"] ?? 0,
        three: item.distribution["3"] ?? 0,
        four: item.distribution["4"] ?? 0,
        five: item.distribution["5"] ?? 0,
      }),
    );
    const indicators = workbook.addWorksheet("Indicadores");
    indicators.columns = [
      { header: "Indicador", key: "indicator", width: 30 },
      { header: "Valor", key: "value", width: 18 },
    ];
    indicators.addRows([
      { indicator: "Aberturas", value: metrics.completion.openings },
      { indicator: "Inícios", value: metrics.completion.starts },
      { indicator: "Conclusões", value: metrics.completion.completions },
      { indicator: "Taxa de conclusão", value: metrics.completion.rate },
    ]);
    const nps = workbook.addWorksheet("NPS");
    nps.columns = [
      { header: "Grupo", key: "group", width: 24 },
      { header: "Quantidade", key: "value", width: 18 },
    ];
    nps.addRows([
      { group: "Promotores", value: metrics.npsBreakdown.promoters },
      { group: "Neutros", value: metrics.npsBreakdown.passives },
      { group: "Detratores", value: metrics.npsBreakdown.detractors },
      { group: "NPS", value: metrics.nps },
    ]);
    const problems = workbook.addWorksheet("Problemas");
    problems.columns = [
      { header: "Problema", key: "label", width: 42 },
      { header: "Ocorrências", key: "total", width: 18 },
    ];
    problems.addRows(metrics.problems);
    const { data: responses } = await context.admin
      .from("survey_responses")
      .select("completed_at,overall_score,nps_score,critical,wants_contact")
      .eq("organization_id", context.organization.id)
      .eq("status", "COMPLETED")
      .gte("completed_at", range.start.toISOString())
      .lt("completed_at", range.exclusiveEnd.toISOString())
      .limit(5000);
    const responseSheet = workbook.addWorksheet("Respostas");
    responseSheet.columns = [
      { header: "Data/hora", key: "completed_at", width: 24 },
      { header: "Nota geral", key: "overall_score", width: 16 },
      { header: "NPS", key: "nps_score", width: 12 },
      { header: "Crítica", key: "critical", width: 12 },
      { header: "Contato autorizado", key: "wants_contact", width: 20 },
    ];
    responseSheet.addRows(responses ?? []);
    const { data: questions } = await context.admin
      .from("survey_questions")
      .select(
        "stable_key,sort_order,active,survey_question_versions!survey_questions_current_version_fkey(version_number,category,question_type,title,required,allow_na)",
      )
      .eq("campaign_id", context.campaign.id)
      .order("sort_order");
    const questionSheet = workbook.addWorksheet("Perguntas");
    questionSheet.columns = [
      { header: "Ordem", key: "sort_order", width: 10 },
      { header: "Chave", key: "stable_key", width: 26 },
      { header: "Pergunta/versão", key: "version", width: 72 },
      { header: "Ativa", key: "active", width: 12 },
    ];
    (questions ?? []).forEach((question) =>
      questionSheet.addRow({
        sort_order: question.sort_order,
        stable_key: question.stable_key,
        version: JSON.stringify(question.survey_question_versions),
        active: question.active,
      }),
    );
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition":
          'attachment; filename="relatorio-satisfacao-inneuro.xlsx"',
        "cache-control": "private, no-store",
      },
    });
  }
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const green = rgb(0.02, 0.35, 0.22);
  page.drawText("Relatório de satisfação INNEURO", {
    x: 50,
    y: 785,
    size: 23,
    font: bold,
    color: green,
  });
  page.drawText(
    `${range.start.toLocaleDateString("pt-BR")} a ${range.end.toLocaleDateString("pt-BR")}`,
    { x: 50, y: 755, size: 11, font: regular },
  );
  const rows = [
    ["Respostas", String(metrics.responseCount)],
    [
      "Nota geral",
      metrics.overallScore === null ? "Sem dados" : `${metrics.overallScore}/5`,
    ],
    ["NPS", metrics.nps === null ? "Sem dados" : String(metrics.nps)],
    [
      "Satisfação positiva",
      metrics.positiveRate === null ? "Sem dados" : `${metrics.positiveRate}%`,
    ],
    ["Avaliações críticas", String(metrics.criticalCount)],
  ];
  let y = 700;
  rows.forEach(([label, value]) => {
    page.drawText(label, { x: 50, y, size: 12, font: regular });
    page.drawText(value, { x: 390, y, size: 15, font: bold, color: green });
    y -= 42;
  });
  page.drawText("Jornada do cliente", {
    x: 50,
    y: y - 10,
    size: 17,
    font: bold,
    color: green,
  });
  y -= 45;
  metrics.dimensions.forEach((item) => {
    if (y < 70) {
      page = pdf.addPage([595.28, 841.89]);
      y = 780;
    }
    page.drawText(surveyCategoryLabels[item.category] ?? item.category, {
      x: 50,
      y,
      size: 11,
      font: regular,
    });
    page.drawText(`${item.average}/5 (${item.response_count})`, {
      x: 390,
      y,
      size: 11,
      font: bold,
    });
    y -= 28;
  });
  return new NextResponse(new Uint8Array(await pdf.save()), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition":
        'attachment; filename="relatorio-satisfacao-inneuro.pdf"',
      "cache-control": "private, no-store",
    },
  });
}
