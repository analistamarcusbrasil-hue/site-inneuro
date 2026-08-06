import { saveInstitutionalSettingsAction } from "@/app/admin/actions";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { siteConfig } from "@/config/site";
import { requireAdmin } from "@/lib/cms/auth";

const groups = [
  {
    title: "Canais oficiais",
    fields: [
      ["full_name", "Nome institucional", "Nome completo exibido no site."],
      ["description", "Descrição institucional", "Resumo público da INNEURO."],
      ["phone", "Telefone", "Opcional. Use o formato exibido ao público."],
      ["email", "E-mail", "Opcional. Informe somente um endereço oficial."],
      [
        "opening_hours",
        "Horário geral",
        "Opcional. Horários por modalidade são editados em Preparos e horários.",
      ],
      [
        "whatsapp_primary_label",
        "Nome do WhatsApp principal",
        "Exemplo: WhatsApp principal.",
      ],
      [
        "whatsapp_primary_display",
        "WhatsApp principal — exibição",
        "Exemplo: (96) 98112-2434.",
      ],
      [
        "whatsapp_primary_number",
        "WhatsApp principal — número",
        "Somente números, incluindo 55 e DDD.",
      ],
      [
        "whatsapp_secondary_label",
        "Nome do WhatsApp alternativo",
        "Exemplo: WhatsApp alternativo.",
      ],
      [
        "whatsapp_secondary_display",
        "WhatsApp alternativo — exibição",
        "Exemplo: (96) 99113-4201.",
      ],
      [
        "whatsapp_secondary_number",
        "WhatsApp alternativo — número",
        "Somente números, incluindo 55 e DDD.",
      ],
      [
        "instagram_url",
        "Link do Instagram",
        "Endereço completo começando com https://.",
      ],
      ["instagram_handle", "Nome no Instagram", "Exemplo: @inneuroap."],
      [
        "patient_portal_url",
        "Portal de Exames",
        "Link externo oficial do Image2Doc.",
      ],
    ],
  },
  {
    title: "Endereço e mapa",
    fields: [
      ["address_street", "Rua", "Nome da rua."],
      ["address_number", "Número", "Número do imóvel."],
      ["address_neighborhood", "Bairro", "Bairro da clínica."],
      ["address_city", "Cidade", "Cidade da clínica."],
      ["address_state", "Estado", "Sigla com duas letras, por exemplo AP."],
      ["address_postal_code", "CEP", "Opcional."],
      [
        "address_reference",
        "Ponto de referência",
        "Orientação curta para localização.",
      ],
      ["maps_url", "Link do mapa", "Endereço completo do Google Maps."],
    ],
  },
  {
    title: "Sobre a INNEURO",
    fields: [
      ["about_title", "Título", "Aparece no topo da página Sobre."],
      ["about_description", "Texto de apoio", "Aparece logo abaixo do título."],
      ["about_purpose", "Propósito", "Conteúdo do card Propósito."],
      [
        "about_technology",
        "Atendimento e tecnologia",
        "Conteúdo do card Atendimento e tecnologia.",
      ],
    ],
  },
] as const;

const fallback: Record<string, string> = {
  full_name: siteConfig.fullName,
  description: siteConfig.description,
  phone: siteConfig.phone,
  email: siteConfig.email,
  opening_hours: siteConfig.openingHours,
  whatsapp_primary_label: siteConfig.whatsapp.primary.label,
  whatsapp_primary_display: siteConfig.whatsapp.primary.display,
  whatsapp_primary_number: siteConfig.whatsapp.primary.number,
  whatsapp_secondary_label: siteConfig.whatsapp.secondary.label,
  whatsapp_secondary_display: siteConfig.whatsapp.secondary.display,
  whatsapp_secondary_number: siteConfig.whatsapp.secondary.number,
  instagram_url: siteConfig.instagram.url,
  instagram_handle: siteConfig.instagram.handle,
  patient_portal_url: siteConfig.patientPortal.url,
  address_street: siteConfig.address.street,
  address_number: siteConfig.address.number,
  address_neighborhood: siteConfig.address.neighborhood,
  address_city: siteConfig.address.city,
  address_state: siteConfig.address.state,
  address_postal_code: siteConfig.address.postalCode,
  address_reference: siteConfig.address.reference,
  maps_url: siteConfig.mapsUrl,
  about_title: "Tecnologia, precisão e cuidado.",
  about_description:
    "O Instituto de Neurologia do Amapá reúne diagnóstico por imagem, neurologia e medicina nuclear em Macapá.",
  about_purpose:
    "Facilitar o acesso a informações sobre exames, preparos, convênios e canais oficiais da INNEURO.",
  about_technology:
    "Tecnologia, comunicação clara e acesso digital aos resultados apoiam a jornada de atendimento.",
};

export default async function InstitutionalPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { supabase, profile } = await requireAdmin();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "institutional")
    .maybeSingle();
  const values = {
    ...fallback,
    ...((data?.value && typeof data.value === "object"
      ? data.value
      : {}) as Record<string, string>),
  };
  const canSave = profile.role !== "editor";

  return (
    <>
      <AdminPageHeading
        title="Informações institucionais"
        description="Fonte única para telefones, WhatsApp, endereço, mapa, Portal de Exames e os principais textos da página Sobre. Revise cuidadosamente antes de salvar."
      />
      {query.success ? (
        <p
          role="status"
          className="bg-mint text-brand mb-6 rounded-xl p-4 font-bold"
        >
          Informações atualizadas no site.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-xl p-4 font-bold"
        >
          {query.error === "validation"
            ? "Revise os campos. Links devem começar com https:// e números de WhatsApp devem conter apenas dígitos."
            : "Não foi possível salvar as informações. Tente novamente."}
        </p>
      ) : null}
      <form action={saveInstitutionalSettingsAction} className="space-y-7">
        {groups.map((group) => (
          <section
            key={group.title}
            className="border-border-light rounded-3xl border bg-white p-5 sm:p-7"
          >
            <h2 className="font-heading text-xl font-semibold">
              {group.title}
            </h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {group.fields.map(([name, label, help]) => {
                const long = [
                  "description",
                  "opening_hours",
                  "address_reference",
                  "about_description",
                  "about_purpose",
                  "about_technology",
                ].includes(name);
                return (
                  <label
                    key={name}
                    className={`text-sm font-bold ${long ? "md:col-span-2" : ""}`}
                  >
                    {label}
                    {long ? (
                      <textarea
                        name={name}
                        defaultValue={values[name]}
                        rows={4}
                        required={
                          ![
                            "phone",
                            "email",
                            "opening_hours",
                            "address_postal_code",
                          ].includes(name)
                        }
                        className="border-border-light mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                      />
                    ) : (
                      <input
                        name={name}
                        defaultValue={values[name]}
                        required={
                          !["phone", "email", "address_postal_code"].includes(
                            name,
                          )
                        }
                        className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"
                      />
                    )}
                    <span className="text-muted mt-1 block text-xs font-normal">
                      {help}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
        {canSave ? (
          <button className="bg-brand min-h-12 rounded-full px-6 text-sm font-bold text-white">
            Salvar e atualizar o site
          </button>
        ) : (
          <p className="text-warning rounded-xl bg-white p-4 text-sm font-bold">
            Sua conta pode visualizar estas informações, mas somente
            administradores podem alterá-las.
          </p>
        )}
      </form>
    </>
  );
}
