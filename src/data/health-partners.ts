export type HealthPartner = {
  id: string;
  slug: string;
  name: string;
  category: "convenio" | "parceria";
  logo?: string;
  logoStatus: "official" | "pending";
  officialWebsite?: string;
  assetSource?: string;
  active: boolean;
  displayOrder: number;
};

export const healthPartners: HealthPartner[] = [
  {
    id: "sulamerica",
    slug: "sulamerica",
    name: "SulAmérica",
    category: "convenio",
    logoStatus: "pending",
    officialWebsite: "https://www.sulamerica.com.br/",
    active: true,
    displayOrder: 1,
  },
  {
    id: "geap-saude",
    slug: "geap-saude",
    name: "GEAP Saúde",
    category: "convenio",
    logoStatus: "pending",
    officialWebsite: "https://www.geap.org.br/",
    active: true,
    displayOrder: 2,
  },
  {
    id: "unimed",
    slug: "unimed",
    name: "Unimed",
    category: "convenio",
    logoStatus: "pending",
    officialWebsite: "https://www.unimed.coop.br/",
    active: true,
    displayOrder: 3,
  },
  {
    id: "amil",
    slug: "amil",
    name: "Amil",
    category: "convenio",
    logoStatus: "pending",
    officialWebsite: "https://www.amil.com.br/",
    active: true,
    displayOrder: 4,
  },
  {
    id: "assefaz",
    slug: "assefaz",
    name: "ASSEFAZ",
    category: "convenio",
    logoStatus: "pending",
    officialWebsite: "https://www.assefaz.org.br/",
    active: true,
    displayOrder: 5,
  },
  {
    id: "bradesco-saude",
    slug: "bradesco-saude",
    name: "Bradesco Saúde",
    category: "convenio",
    logoStatus: "pending",
    officialWebsite:
      "https://www.bradescoseguros.com.br/clientes/produtos/plano-saude",
    active: true,
    displayOrder: 6,
  },
  // A logo oficial da CAPSAÚDE deve ser fornecida pela INNEURO.
  {
    id: "capsaude",
    slug: "capsaude",
    name: "CAPSAÚDE",
    category: "convenio",
    logoStatus: "pending",
    active: true,
    displayOrder: 7,
  },
  {
    id: "amorsaude",
    slug: "amorsaude",
    name: "AmorSaúde",
    category: "parceria",
    logoStatus: "pending",
    officialWebsite: "https://www.amorsaude.com.br/",
    active: true,
    displayOrder: 8,
  },
];

export const activeHealthPartners = healthPartners
  .filter((item) => item.active)
  .sort((a, b) => a.displayOrder - b.displayOrder);
