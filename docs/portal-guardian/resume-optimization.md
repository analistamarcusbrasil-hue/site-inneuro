# Otimização de currículos

O worker é assíncrono e nunca bloqueia uma candidatura. PDFs menores que 1 MB são ignorados; a partir de 1 MB podem ser avaliados e a partir de 3 MB recebem prioridade.

O arquivo não é modificado quando assinado, criptografado ou sem ganho mínimo. A troca exige: leitura válida antes/depois, mesmo número de páginas, mesmo hash da camada de texto, redução mínima de 10% ou 200 KB, upload temporário íntegro e compare-and-set da referência. O original só é removido após todas essas etapas. Extrações permanecem ligadas ao mesmo registro de currículo.

O Edge Runtime não executa compactação nativa. A reserialização segura roda no worker Node; PDFs sem benefício real recebem `SKIPPED_NO_BENEFIT`, sem compressão fictícia.
