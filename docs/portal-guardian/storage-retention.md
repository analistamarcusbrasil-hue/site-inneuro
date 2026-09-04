# Retenção e Storage

Os originais e previews de `scheduling-documents` ficam disponíveis até `documents_purge_due_at`. Depois, o banco entrega claims exclusivos ao executor, que remove `storage_path` e `preview_storage_path` pela Storage API e marca o documento como `PURGED`.

O registro de `appointment_request_documents` permanece para auditoria. Falhas viram `FAILED`, liberam o claim e entram em nova tentativa até o limite configurado. Um arquivo já ausente é tratado conforme a resposta idempotente da API.

Arquivos no Storage sem referência começam como `ORPHAN_SUSPECTED`; somente recorrência após o período de observação permite `ORPHAN_CONFIRMED`. A limpeza automática de órfãos permanece desligada nesta entrega.
