"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { surveyCategoryLabels } from "@/lib/surveys/logic";
import type { SurveyDashboardMetrics } from "@/lib/surveys/types";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

function Chart({
  label,
  option,
  height = 300,
}: {
  label: string;
  option: echarts.EChartsCoreOption;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);
  return <div ref={ref} style={{ height }} role="img" aria-label={label} />;
}

export function SurveyOverviewCharts({
  metrics,
}: {
  metrics: SurveyDashboardMetrics;
}) {
  const dimensionOption: echarts.EChartsCoreOption = {
    grid: { left: 8, right: 24, top: 20, bottom: 70, containLabel: true },
    tooltip: { trigger: "axis", valueFormatter: (value: unknown) => `${String(value)}/5` },
    xAxis: {
      type: "category",
      axisLabel: { interval: 0, rotate: 28, color: "#64748b" },
      data: metrics.dimensions.map(
        (item) => surveyCategoryLabels[item.category] ?? item.category,
      ),
    },
    yAxis: { type: "value", min: 0, max: 5, interval: 1 },
    series: [
      {
        type: "bar",
        data: metrics.dimensions.map((item) => item.average),
        itemStyle: { color: "#087a4d", borderRadius: [8, 8, 0, 0] },
        barMaxWidth: 36,
      },
    ],
  };
  const nps = metrics.npsBreakdown;
  const npsOption: echarts.EChartsCoreOption = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "43%"],
        label: { formatter: "{b}\n{c}" },
        data: [
          { name: "Promotores", value: nps.promoters, itemStyle: { color: "#087a4d" } },
          { name: "Neutros", value: nps.passives, itemStyle: { color: "#eab308" } },
          { name: "Detratores", value: nps.detractors, itemStyle: { color: "#be123c" } },
        ],
      },
    ],
  };
  const problemsOption: echarts.EChartsCoreOption = {
    grid: { left: 8, right: 24, top: 15, bottom: 10, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", minInterval: 1 },
    yAxis: {
      type: "category",
      inverse: true,
      data: metrics.problems.slice(0, 7).map((item) => item.label),
    },
    series: [
      {
        type: "bar",
        data: metrics.problems.slice(0, 7).map((item) => item.total),
        itemStyle: { color: "#0f766e", borderRadius: [0, 7, 7, 0] },
      },
    ],
  };
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <section className="border-border-light rounded-3xl border bg-white p-5 xl:col-span-3">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Jornada do cliente
        </h2>
        <p className="text-muted mt-1 text-sm">Média por dimensão no período.</p>
        <Chart label="Notas da jornada do cliente" option={dimensionOption} height={330} />
      </section>
      <section className="border-border-light rounded-3xl border bg-white p-5 xl:col-span-2">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">NPS</h2>
        <p className="text-muted mt-1 text-sm">Promotores, neutros e detratores.</p>
        <Chart label="Distribuição de NPS" option={npsOption} height={330} />
      </section>
      <section className="border-border-light rounded-3xl border bg-white p-5 xl:col-span-5">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Principais problemas relatados
        </h2>
        <p className="text-muted mt-1 text-sm">
          Frequência das opções selecionadas, sem inferir causalidade.
        </p>
        {metrics.problems.length ? (
          <Chart label="Principais problemas" option={problemsOption} height={280} />
        ) : (
          <p className="mt-8 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
            Nenhum problema estruturado foi registrado neste período.
          </p>
        )}
      </section>
    </div>
  );
}
