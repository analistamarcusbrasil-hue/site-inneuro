"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  candidateStageLabels,
  type CareerJobApplication,
} from "@/lib/careers/applications";

type CandidateStage = CareerJobApplication["candidate_stage"];

export type CandidatePipelineMovement = {
  jobId: string;
  fromStage: CandidateStage;
  toStage: CandidateStage;
  movedCount: number;
};

const pipelineMovementEvent = "inneuro:candidate-pipeline-movement";

export function notifyCandidatePipelineMovement(
  movement: CandidatePipelineMovement,
) {
  window.dispatchEvent(
    new CustomEvent<CandidatePipelineMovement>(pipelineMovementEvent, {
      detail: movement,
    }),
  );
}

const stageDescriptions: Record<CandidateStage, (count: number) => string> = {
  resume: (count) => `${count} aguardando análise`,
  interview: (count) => `${count} candidato${count === 1 ? "" : "s"}`,
  practical_test: (count) => `${count} candidato${count === 1 ? "" : "s"}`,
  hiring: (count) => `${count} candidato${count === 1 ? "" : "s"}`,
  hired: (count) => `${count} contratado${count === 1 ? "" : "s"}`,
  not_approved: (count) =>
    `${count} não aprovado${count === 1 ? "" : "s"}`,
};

export function CandidatePipelineNav({
  jobId,
  activeStage,
  initialCounts,
  allCount,
  allHref,
  stageHrefs,
}: {
  jobId: string;
  activeStage: CandidateStage | null;
  initialCounts: Record<CandidateStage, number>;
  allCount: number;
  allHref: string;
  stageHrefs: Record<CandidateStage, string>;
}) {
  const [counts, setCounts] = useState(initialCounts);

  useEffect(() => {
    function updatePipeline(event: Event) {
      const movement = (event as CustomEvent<CandidatePipelineMovement>)
        .detail;
      if (!movement || movement.jobId !== jobId) return;
      setCounts((current) => ({
        ...current,
        [movement.fromStage]: Math.max(
          0,
          current[movement.fromStage] - movement.movedCount,
        ),
        [movement.toStage]:
          current[movement.toStage] + movement.movedCount,
      }));
    }

    window.addEventListener(pipelineMovementEvent, updatePipeline);
    return () =>
      window.removeEventListener(pipelineMovementEvent, updatePipeline);
  }, [jobId]);

  const stages = Object.keys(candidateStageLabels) as CandidateStage[];

  return (
    <nav
      aria-label="Etapas do processo seletivo"
      className="border-border-light mb-5 flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2"
    >
      <Link
        href={allHref}
        className={`flex min-h-14 shrink-0 flex-col justify-center rounded-xl px-3 py-2 text-xs font-bold ${!activeStage ? "bg-brand text-white" : "text-brand-dark hover:bg-surface"}`}
      >
        <span className="flex items-center justify-between gap-3">
          Todos
          <span className="rounded-full bg-black/5 px-2 py-0.5">
            {allCount}
          </span>
        </span>
        <span className="mt-0.5 text-[10px] font-medium opacity-75">
          {allCount} candidatura{allCount === 1 ? "" : "s"}
        </span>
      </Link>
      {stages.map((stage) => (
        <Link
          key={stage}
          href={stageHrefs[stage]}
          className={`flex min-h-14 min-w-32 shrink-0 flex-col justify-center rounded-xl px-3 py-2 text-xs font-bold ${activeStage === stage ? "bg-brand text-white" : "text-brand-dark hover:bg-surface"}`}
        >
          <span className="flex items-center justify-between gap-3">
            {candidateStageLabels[stage]}
            <span className="rounded-full bg-black/5 px-2 py-0.5">
              {counts[stage]}
            </span>
          </span>
          <span className="mt-0.5 text-[10px] font-medium opacity-75">
            {stageDescriptions[stage](counts[stage])}
          </span>
        </Link>
      ))}
    </nav>
  );
}
