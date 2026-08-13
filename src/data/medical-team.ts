export type MedicalTeamMember = {
  id: string;
  name: string;
  crm: string;
  crmState: string;
  rqe?: string;
  specialty: string;
  subspecialties?: string[];
  role: string;
  bio?: string;
  image: string;
  imageAlt: string;
};

// Adicione somente profissionais com dados institucionais já validados.
export const medicalTeam: readonly MedicalTeamMember[] = [];
