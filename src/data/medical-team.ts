export type MedicalTeamMember = {
  id: string;
  name: string;
  crm: string;
  crmState: string;
  rqe: string;
  initials: string;
  specialty: string;
  subspecialties: readonly string[];
  role: "Corpo Médico INNEURO";
  image: string;
  imageAlt: string;
};

// Dados institucionais fornecidos e validados para publicação.
// Especialidades permanecem vazias até que haja confirmação oficial.
export const medicalTeam: readonly MedicalTeamMember[] = [
  {
    id: "waldonio-brito-vieira",
    name: "Waldonio de Brito Vieira",
    crm: "7658",
    crmState: "PA",
    rqe: "7780",
    initials: "WB",
    specialty: "",
    subspecialties: [],
    role: "Corpo Médico INNEURO",
    image: "/images/equipe-medica/waldonio-brito-vieira.jpg",
    imageAlt: "Waldonio de Brito Vieira — Corpo Médico INNEURO",
  },
  {
    id: "karen-margarete-franco",
    name: "Karen Margarete Vieira da Silva Franco",
    crm: "9695",
    crmState: "PA",
    rqe: "4985",
    initials: "KF",
    specialty: "",
    subspecialties: [],
    role: "Corpo Médico INNEURO",
    image: "/images/equipe-medica/karen-margarete-franco.jpg",
    imageAlt: "Karen Margarete Vieira da Silva Franco — Corpo Médico INNEURO",
  },
  {
    id: "jorge-henrique-safady",
    name: "Jorge Henrique Safady",
    crm: "3100",
    crmState: "AP",
    rqe: "1098",
    initials: "JS",
    specialty: "",
    subspecialties: [],
    role: "Corpo Médico INNEURO",
    image: "/images/equipe-medica/jorge-henrique-safady.jpg",
    imageAlt: "Jorge Henrique Safady — Corpo Médico INNEURO",
  },
  {
    id: "luiz-nunes-rego-filho",
    name: "Luiz Nunes Rego Filho",
    crm: "872",
    crmState: "AP",
    rqe: "468",
    initials: "LR",
    specialty: "",
    subspecialties: [],
    role: "Corpo Médico INNEURO",
    image: "/images/equipe-medica/luiz-nunes-rego-filho.jpg",
    imageAlt: "Luiz Nunes Rego Filho — Corpo Médico INNEURO",
  },
  {
    id: "emilio-roberto-escobar",
    name: "Emílio Roberto Gonçalves Escobar",
    crm: "905",
    crmState: "AP",
    rqe: "467",
    initials: "EE",
    specialty: "",
    subspecialties: [],
    role: "Corpo Médico INNEURO",
    image: "/images/equipe-medica/emilio-roberto-escobar.jpg",
    imageAlt: "Emílio Roberto Gonçalves Escobar — Corpo Médico INNEURO",
  },
  {
    id: "rafael-oliveira-cruz",
    name: "Rafael Oliveira da Cruz",
    crm: "1448",
    crmState: "AP",
    rqe: "581",
    initials: "RC",
    specialty: "",
    subspecialties: [],
    role: "Corpo Médico INNEURO",
    image: "/images/equipe-medica/rafael-oliveira-cruz.jpg",
    imageAlt: "Rafael Oliveira da Cruz — Corpo Médico INNEURO",
  },
  {
    id: "rilton-diniz-cruz-junior",
    name: "Rilton Diniz da Cruz Junior",
    crm: "1538",
    crmState: "AP",
    rqe: "730",
    initials: "RJ",
    specialty: "",
    subspecialties: [],
    role: "Corpo Médico INNEURO",
    image: "/images/equipe-medica/rilton-diniz-cruz-junior.jpg",
    imageAlt: "Rilton Diniz da Cruz Junior — Corpo Médico INNEURO",
  },
];
