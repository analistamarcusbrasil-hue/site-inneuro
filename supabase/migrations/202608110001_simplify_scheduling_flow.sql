begin;

alter table public.appointment_request_exams
  add column if not exists sort_order integer not null default 0;

create index if not exists appointment_request_exams_modality_idx
  on public.appointment_request_exams (modality, created_at desc);

alter table public.appointment_request_documents
  drop constraint if exists appointment_request_documents_document_type_check;

alter table public.appointment_request_documents
  add constraint appointment_request_documents_document_type_check check (
    document_type in (
      'photo_id',
      'medical_request',
      'sus_authorization',
      'sus_card',
      'insurance_card_front',
      'insurance_card_back',
      'insurance_authorization',
      'other'
    )
  );

commit;
