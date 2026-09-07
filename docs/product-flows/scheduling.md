# FLOW REVIEW — GATE 0 — SCHEDULING SINGLE ENTRY POINT

## Evidências do sistema atual

- Rotas públicas de agendamento: os CTAs da Home, Header, menu móvel, exames,
  preparos, convênios e páginas institucionais apontam para o formulário existente
  em `/contato#pre-agendamento`.
- APIs: `/api/pre-agendamento/preparar` cria a sessão de upload e
  `/api/pre-agendamento/finalizar` valida os dados, confere os documentos e
  conclui a solicitação.
- Fonte operacional: `saveSchedulingRequestRecord` grava em
  `appointment_requests`, `appointment_request_exams`,
  `appointment_request_documents` e `appointment_request_history`.
- Desvio confirmado: após gravar a solicitação, a API ainda montava uma ficha
  com dados e documentos para WhatsApp, retornava `whatsappUrl` e a tela de
  sucesso oferecia esse redirecionamento.
- Protocolo e acompanhamento protegido já existem por `protocol`, token com hash
  e `/solicitacao/[token]`.
- O Admin já consome exclusivamente `appointment_requests`; não existe fila de
  entrada WhatsApp.
- WhatsApp no Admin é comunicação posterior da equipe e não fonte de entrada.
- O Portal Guardian já governa retenção, integridade e purge dos documentos
  ligados às solicitações do Portal.
- Fato: o campo de telefone é necessário para retorno da equipe. Inferência
  rejeitada: armazenar o número não transforma o WhatsApp em canal de entrada.
  Lacuna não impeditiva: a escolha operacional do canal usado pela equipe para
  retornar ao paciente permanece fora deste contrato.

## FLOW CONTRACT

### PROBLEMA

O Portal concluía a gravação no banco, mas ainda orientava o paciente a abrir o
WhatsApp com uma segunda ficha. Isso criava percepção de dois canais, repetição
de dados e risco de acompanhamento fora da fila oficial.

### ATOR

Paciente ou responsável que solicita exame pelo site; equipe autorizada da
INNEURO que recebe e processa a solicitação no Admin.

### OBJETIVO

Estabelecer `SCHEDULING SINGLE ENTRY POINT`: toda solicitação digital de
agendamento originada pelo site entra pelo Portal e possui
`appointment_requests` como única fonte operacional de verdade.

Regra permanente: solicitações de agendamento originadas pelo site devem ser
registradas exclusivamente pelo Portal de Agendamento. WhatsApp não é canal de
entrada operacional para agendamento. Qualquer novo canal exige outro Flow
Review.

### ENTRADA

CTA de agendamento do site ou acesso direto a `/contato#pre-agendamento`.

### PRÉ-CONDIÇÕES

- Modalidade selecionada.
- Identificação e dados de contato válidos.
- Forma de atendimento e documentos obrigatórios conforme o caso.
- Preferência de data/período e consentimento.
- Sessão segura de upload válida.

### ESTADO INICIAL

Formulário ainda não enviado; nenhum `appointment_request` criado.

### FLUXO PRINCIPAL

1. O paciente abre o Portal pelo CTA de agendamento.
2. Informa exames, identificação, contato, atendimento e preferências.
3. Anexa o pedido médico e demais documentos exigidos.
4. Revisa e envia uma única vez.
5. O servidor valida sessão, arquivos, dados e catálogo.
6. O servidor cria `appointment_requests` e registros relacionados.
7. A tela confirma o recebimento, mostra o protocolo e oferece o link protegido
   de acompanhamento.
8. A solicitação aparece na única fila do Admin.

### FLUXOS ALTERNATIVOS

- Validação inválida: permanecer no Portal e indicar o campo a corrigir.
- Upload ou gravação falha: não apresentar sucesso; preservar a possibilidade de
  nova tentativa e limpar somente artefatos não persistidos conforme o Guardian.
- WhatsApp institucional: continua disponível para dúvidas gerais; quando a
  dúvida for agendamento, a orientação padrão encaminha ao Portal sem receber a
  ficha pelo fluxo do site.
- Retorno da equipe: pode usar canais institucionais após a solicitação já existir,
  sem criar nova origem ou fila.

### ESTADOS

- `FORM_IN_PROGRESS`: dados ainda locais, sem solicitação operacional.
- `UPLOAD_PREPARED`: sessão temporária válida e uploads preparados.
- `REQUEST_CREATED`: `appointment_requests` criado com exames, documentos e
  histórico.
- Estados operacionais posteriores permanecem os já definidos no módulo de
  agendamentos e no Portal Guardian.

### TRANSIÇÕES

- Formulário válido prepara upload.
- Upload confirmado e finalização válida criam a solicitação.
- Sucesso encerra a entrada pública no Portal; não existe transição para
  “enviar ficha pelo WhatsApp”.
- A equipe movimenta somente a solicitação existente no Admin.

### SOURCE OF TRUTH

`appointment_requests` é a fonte oficial do estado atual. Exames, documentos,
histórico e comunicações usam as tabelas relacionadas. Mensagens, links e telas
públicas não são fonte de estado.

### REGRAS DE FILA

- Entrada: gravação bem-sucedida de um `appointment_request` pelo Portal.
- Saída: transições operacionais existentes da equipe ou do Portal Guardian.
- Não existe fila WhatsApp, origem paralela ou cadastro duplicado.
- O Telegram permanece somente como notificação interna da solicitação já
  persistida; sua falha não remove nem invalida o registro.

### PERMISSÕES

O paciente usa apenas as APIs públicas protegidas por HTTPS, sessão assinada,
validação, honeypot e limite de requisições. A leitura e as ações operacionais
continuam restritas às permissões administrativas existentes.

### CONFIRMAÇÕES

A revisão final do formulário precede o envio. Após o sucesso, a interface mostra
protocolo e informa que não é necessário reenviar dados pelo WhatsApp.

### AUDITORIA

A criação continua registrando `Solicitação recebida pelo site`. O histórico,
protocolo e registros do Guardian são preservados. Não se registra conteúdo em
log novo nem se inclui dado pessoal na documentação.

### FEEDBACK

Sucesso informa recebimento, análise pela equipe, protocolo e acompanhamento
protegido. Erro informa o próximo passo sem simular criação.

### ERROS

Falhas de validação, sessão, upload, catálogo e banco permanecem explícitas. A
falha da notificação interna não transforma a solicitação persistida em falha.

### EMPTY STATE

Não aplicável ao formulário público. No Admin, a fila vazia continua indicando
que não existem solicitações no filtro atual.

### CONCORRÊNCIA

A sessão e o token existentes continuam vinculando uploads à finalização. A
gravação parcial remove o registro incompleto e documentos não persistidos. A
mudança não adiciona uma segunda escrita nem ação repetível via WhatsApp.

### RESPONSIVIDADE

Os mesmos CTAs e a mesma rota são usados em desktop, Header e menu móvel. A tela
de sucesso mantém ações empilháveis no espaço compacto e acessíveis por teclado.

### CRITÉRIOS DE ACEITE

- Todo CTA cujo propósito é agendar abre `/contato#pre-agendamento`.
- A finalização cria `appointment_requests` e não gera `wa.me` ou ficha WhatsApp.
- A tela de sucesso não solicita novo envio e exibe o protocolo existente.
- O acompanhamento protegido fica disponível após o envio.
- O WhatsApp institucional permanece para contato geral e como comunicação
  posterior da equipe, sem virar origem operacional.
- A hierarquia de convênios mantém Portal como ação principal e WhatsApp como
  consulta secundária de cobertura.
- Regras atuais do Portal Guardian permanecem inalteradas.

## Diagrama

```text
Site → Portal `/contato#pre-agendamento` → APIs seguras
     → appointment_requests + relações → fila única do Admin
     → protocolo + acompanhamento protegido

WhatsApp institucional → dúvidas e orientação ao Portal
```

## MENSAGEM PADRÃO PARA ORIENTAÇÃO

> Para garantir a organização e o acompanhamento correto da sua solicitação,
> os agendamentos de exames da INNEURO são realizados exclusivamente pelo
> nosso Portal de Agendamento. Acesse o portal, informe seus dados e anexe o
> pedido médico. Após o envio, nossa equipe dará continuidade ao atendimento.

## Matriz de transição

| FROM             | ACTION                     | TO               | ALLOWED ROLE      | CONFIRM?      | REVERSIBLE?   |
| ---------------- | -------------------------- | ---------------- | ----------------- | ------------- | ------------- |
| FORM_IN_PROGRESS | Preparar uploads           | UPLOAD_PREPARED  | Público validado  | Não           | Sim           |
| UPLOAD_PREPARED  | Finalizar solicitação      | REQUEST_CREATED  | Sessão assinada   | Sim           | Não direto    |
| REQUEST_CREATED  | Abrir acompanhamento       | REQUEST_CREATED  | Token protegido   | Não           | N/A           |
| REQUEST_CREATED  | Processar na fila do Admin | Estado existente | Equipe autorizada | Conforme ação | Conforme ação |

## REDUNDÂNCIAS ENCONTRADAS

- `CRITICAL`: ficha completa gerada para WhatsApp depois da gravação oficial.
- `HIGH`: CTA de WhatsApp na confirmação competindo com o acompanhamento do
  Portal.
- `MEDIUM`: `channel` do WhatsApp enviado e validado sem participar da fonte de
  verdade.
- `LOW`: textos genéricos de FAQ e privacidade ainda sugerindo reenvio externo.

## SIMPLIFICATION REPORT

- Fluxo atual: Portal → gravação → abrir WhatsApp → possível reenvio/segunda
  conversa.
- Fluxo proposto: Portal → gravação → protocolo/acompanhamento.
- Economia: remove uma etapa externa, uma ficha duplicada e a escolha técnica de
  canal; mantém uma única submissão operacional.

## IMPACT ANALYSIS

- Frontend: tela de sucesso, prop obsoleta do formulário, FAQ, privacidade e
  hierarquia do CTA de convênios.
- Backend: remover montagem e retorno de `whatsappUrl`; manter validações e
  persistência.
- Banco: sem migration e sem mudança de dados.
- Permissões: sem alteração.
- Relatórios: permanecem baseados em `appointment_requests`.
- Auditoria: histórico de criação preservado.
- Integrações: Telegram interno e WhatsApp institucional preservados.
- Dados existentes: sem migração ou reclassificação.
- Migração: não aplicável.
- Compatibilidade: `protocol` e `protectedUrl` já existem na resposta.
- Storage/retention: buckets, caminhos, TTL, purge e monitoramento do Portal
  Guardian não mudam.

## FLOW REVIEW RESULT

APPROVED WITH CONDITIONS

## Condições ou bloqueio

1. Não remover WhatsApp institucional, telefone do paciente ou comunicação
   posterior do Admin.
2. Não criar nova rota, tabela, fila ou protocolo.
3. Não alterar upload, retenção ou purge do Portal Guardian.
4. Não expor dados da ficha em URL externa.
5. Testes devem diferenciar CTA de agendamento de contato institucional.

## IMPLEMENTATION HANDOFF

Remover a geração e o redirecionamento de WhatsApp do pós-envio, tornar o
protocolo e o acompanhamento protegido o estado final do Portal, revisar textos
que sugerem reenvio e assegurar que todos os CTAs de agendamento utilizem a rota
existente. Preservar integralmente banco, Admin, notificações internas,
comunicação posterior e ciclo de vida do Guardian.
