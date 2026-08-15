export type CompanyUnit = {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export const commuteFeasibilities = ["yes", "no", "evaluate"] as const;
export type CommuteFeasibility = (typeof commuteFeasibilities)[number];
export const commuteFeasibilityLabels: Record<CommuteFeasibility, string> = {
  yes: "Sim",
  no: "Não",
  evaluate: "Preciso avaliar",
};

export const commuteTimes = [
  "up_to_30",
  "31_to_60",
  "61_to_90",
  "over_90",
  "unknown",
] as const;
export type CommuteTime = (typeof commuteTimes)[number];
export const commuteTimeLabels: Record<CommuteTime, string> = {
  up_to_30: "Até 30 minutos",
  "31_to_60": "31 a 60 minutos",
  "61_to_90": "61 a 90 minutos",
  over_90: "Mais de 90 minutos",
  unknown: "Não sei informar",
};

export const transportModes = [
  "public_transport",
  "car",
  "motorcycle",
  "bicycle",
  "walking",
  "ride_hailing",
  "other",
  "prefer_not_to_say",
] as const;
export type TransportMode = (typeof transportModes)[number];
export const transportModeLabels: Record<TransportMode, string> = {
  public_transport: "Transporte público",
  car: "Carro",
  motorcycle: "Moto",
  bicycle: "Bicicleta",
  walking: "A pé",
  ride_hailing: "Transporte por aplicativo",
  other: "Outro",
  prefer_not_to_say: "Prefiro não informar",
};

export const transitBenefitOptions = ["yes", "no", "unknown"] as const;
export type TransitBenefit = (typeof transitBenefitOptions)[number];
export const transitBenefitLabels: Record<TransitBenefit, string> = {
  yes: "Pretende utilizar",
  no: "Não pretende utilizar",
  unknown: "Ainda não sabe",
};

export const applicationSources = [
  "site_inneuro",
  "instagram",
  "linkedin",
  "referral",
  "campaign",
  "other",
] as const;
export type ApplicationSource = (typeof applicationSources)[number];
export const applicationSourceLabels: Record<ApplicationSource, string> = {
  site_inneuro: "Site INNEURO",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  referral: "Indicação",
  campaign: "Campanha",
  other: "Outro",
};

export type ApplicationLogistics = {
  application_id: string;
  unit_id: string | null;
  unit_snapshot: {
    id: string;
    name: string;
    address: string;
    neighborhood: string;
    city: string;
    state: string;
    postal_code: string | null;
  } | null;
  candidate_neighborhood_snapshot: string | null;
  candidate_city_snapshot: string | null;
  candidate_state_snapshot: string | null;
  commute_feasibility: CommuteFeasibility | null;
  commute_time: CommuteTime | null;
  transport_modes: TransportMode[];
  transit_benefit: TransitBenefit | null;
  created_at: string;
};

export function formatCompanyUnitLocation(
  unit: Pick<CompanyUnit, "neighborhood" | "city" | "state">,
) {
  return `${unit.neighborhood} · ${unit.city}/${unit.state}`;
}
