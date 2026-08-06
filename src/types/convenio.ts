export type Convenio = {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  logoAlt?: string;
  website?: string;
  source?: string;
  active: boolean;
  logoStatus: "official" | "provided" | "pending";
  category: "convenio" | "parceria";
  notes?: string;
  restrictions?: string;
};
