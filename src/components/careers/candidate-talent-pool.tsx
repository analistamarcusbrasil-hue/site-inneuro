import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import Link from "next/link";
import {
  leaveTalentPoolAction,
  requestTalentPoolDeletionAction,
  saveTalentPoolMembershipAction,
} from "@/app/carreiras/talent-pool-actions";
import type {
  TalentPoolArea,
  TalentPoolMembership,
} from "@/lib/careers/talent-pool";

export function CandidateTalentPool({
  areas,
  membership,
  selectedAreaIds,
  hasResume,
}: {
  areas: TalentPoolArea[];
  membership: TalentPoolMembership | null;
  selectedAreaIds: string[];
  hasResume: boolean;
}) {
  if (membership?.status === "deletion_requested") {
    return (
      <div className="bg-mint/50 text-brand-dark rounded-2xl p-5">
        <p className="font-bold">Solicitação de exclusão recebida</p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Sua participação foi removida das buscas do RH. A solicitação será
          concluída pela equipe responsável sem apagar suas candidaturas ou sua
          conta.
        </p>
      </div>
    );
  }

  const active = membership?.status === "active";
  const membershipControls = active ? (
    <div className="border-border-light mt-6 flex flex-wrap gap-4 border-t pt-5">
      <ConfirmCommandForm
        action={leaveTalentPoolAction}
        message="Deseja sair do Banco de Talentos INNEURO? Seus interesses serão removidos das buscas do RH."
      >
        <button className="text-warning text-sm font-bold hover:underline">
          Sair do Banco de Talentos
        </button>
      </ConfirmCommandForm>
      <ConfirmCommandForm
        action={requestTalentPoolDeletionAction}
        message="Solicitar a exclusão definitiva da sua participação no Banco de Talentos? Esta solicitação não apaga sua conta nem suas candidaturas."
      >
        <button className="text-error text-sm font-bold hover:underline">
          Solicitar exclusão da participação
        </button>
      </ConfirmCommandForm>
    </div>
  ) : membership?.status === "left" ? (
    <ConfirmCommandForm
      action={requestTalentPoolDeletionAction}
      message="Solicitar a exclusão definitiva do registro da sua participação anterior no Banco de Talentos?"
    >
      <button className="text-error mt-5 text-sm font-bold hover:underline">
        Solicitar exclusão da participação anterior
      </button>
    </ConfirmCommandForm>
  ) : null;

  if (!hasResume) {
    return (
      <div>
        <div className="bg-warning/10 text-ink rounded-2xl p-5">
          <p className="font-bold">
            Envie seu currículo antes de participar do Banco de Talentos.
          </p>
          <Link
            className="bg-brand hover:bg-brand-dark mt-4 inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold text-white"
            href="/carreiras/perfil?onboarding=resume"
          >
            Enviar currículo
          </Link>
        </div>
        {membershipControls}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 size-3 shrink-0 rounded-full ${active ? "bg-brand" : "bg-border-light"}`}
        />
        <div>
          <p className="text-ink font-bold">
            Quero fazer parte do Banco de Talentos INNEURO
          </p>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            A participação é voluntária. Escolha apenas áreas profissionais de
            seu interesse e atualize ou encerre sua participação quando quiser.
          </p>
        </div>
      </div>

      {areas.length ? (
        <form action={saveTalentPoolMembershipAction} className="mt-5">
          <fieldset>
            <legend className="text-ink text-sm font-bold">
              Áreas de interesse
            </legend>
            <p className="text-muted mt-1 text-xs">
              As opções são as mesmas áreas cadastradas pelo RH.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map((area) => (
                <label
                  key={area.id}
                  className="border-border-light text-ink flex min-h-12 items-center gap-3 rounded-2xl border bg-white px-4 text-sm font-semibold"
                >
                  <input
                    type="checkbox"
                    name="area_id"
                    value={area.id}
                    defaultChecked={selectedAreaIds.includes(area.id)}
                    className="accent-brand size-4"
                  />
                  {area.name}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="bg-brand hover:bg-brand-dark mt-5 min-h-11 rounded-full px-6 text-sm font-bold text-white">
            {active ? "Atualizar interesses" : "Entrar no Banco de Talentos"}
          </button>
        </form>
      ) : (
        <p className="text-warning mt-4 text-sm font-bold">
          As áreas profissionais estão temporariamente indisponíveis.
        </p>
      )}

      {membershipControls}
    </div>
  );
}
