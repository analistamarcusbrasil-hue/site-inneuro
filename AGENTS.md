# Regras permanentes do projeto INNEURO

- Utilizar português do Brasil nos textos públicos.
- Não inventar dados da clínica nem criar promessas médicas.
- Não alterar, redesenhar ou criar versões da logo oficial.
- Não armazenar dados médicos sem solicitação expressa.
- Priorizar componentes reutilizáveis, acessibilidade e responsividade.
- Não adicionar bibliotecas sem necessidade.
- Executar lint, verificação de tipos e build antes de concluir tarefas.
- Não modificar funcionalidades fora do escopo solicitado.
- Antes de qualquer mudança que altere fluxo de usuário, regras de negócio, estados, etapas ou ações operacionais, executar o Flow Review conforme `docs/product-flows/`; só implementar com resultado `APPROVED` ou `APPROVED WITH CONDITIONS`.
- Toda funcionalidade que armazene arquivo, crie upload/preview, processe PDF ou gere mídia temporária deve consultar `docs/portal-guardian/storage-retention.md` e executar o Storage & Retention Review da skill `.agents/skills/portal-guardian/`; nenhuma exclusão física pode usar SQL direto em `storage.objects`.
- Preservar o padrão visual da INNEURO.
- Não criar portal próprio do paciente; o Portal de Exames será um link externo para o Image2Doc.
- Registrar novas solicitações digitais de agendamento exclusivamente pelo Portal em `/contato#pre-agendamento`, usando `appointment_requests` como fonte única de verdade. O WhatsApp institucional pode ser usado para contato geral e continuidade operacional, mas não como entrada paralela de agendamento.
- Conteúdo institucional público não deve usar APIs dinâmicas sem justificativa documentada; leituras públicas do CMS exigem cache compartilhado e invalidação explícita.
- Não publicar automaticamente.
- Não criar commits nem enviar alterações para repositórios remotos sem autorização expressa.
