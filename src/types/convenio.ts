export type Convenio = {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  website?: string;
  source?: string;
  active: boolean;
  logoStatus: "official" | "pending";
  category: "convenio" | "parceria";
};
