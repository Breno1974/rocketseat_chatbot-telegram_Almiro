# Validação do desafio — Bot de clima no Telegram

**Autor: Almiro Breno de Moura**

## Requisitos conferidos

| Requisito | Evidência |
| --- | --- |
| JSON com nome exigido | `workflow-chatbot-telegram.json`, leitura JSON válida |
| Telegram Trigger inicial | Estrutura e recebimento real de mensagens |
| Campo interno `queue` | Normalização explícita em nó Code |
| Limpeza, acentos e minúsculas | `São Paulo, SP, BR` → `sao paulo,sp,br` |
| HTTP Request no endpoint exigido | Parâmetros conferidos e consultas reais |
| `q`, `units=metric`, `lang=pt_br` | Verificados automaticamente |
| Chave por variável de ambiente | `={{ $env.OPENWEATHER_API_KEY }}`, sem chave literal |
| Validação e rota de erro | Code/IF; 401/404/500, rede e payload inválido simulados |
| Temperatura arredondada em °C | Positiva, zero e negativa nos testes |
| Chat dinâmico | `$json.chatId` derivado da mensagem |
| Credenciais fora do JSON público | Sem vínculos à credencial da instância de teste |
| Importação no n8n | Importação real no n8n 2.44.6 |
| README | Instalação, importação, credenciais e exemplos |

## Testes simulados

`node verificar.cjs` confere a estrutura e a lógica. `node teste-n8n.cjs` executou oito cenários no n8n real, em container descartável sem rede/credenciais: São Paulo, Rio de Janeiro, Belo Horizonte, cidade inexistente, mensagem sem texto, formato inválido, falha de rede e resposta inválida. Todos passaram.

As chamadas HTTP e os envios Telegram são substituídos por dados e verificações de teste; normalização, interpretação e decisões usam a lógica entregue. Esses testes não constituem consultas reais.

## Consultas reais à API

| Consulta | Resultado registrado |
| --- | --- |
| `sao paulo,sp,br` | HTTP 200; 19°C |
| `rio de janeiro,rj,br` | HTTP 200; 23°C |
| `belo horizonte,mg,br` | HTTP 200; 22°C |
| `cidadeinexistentexyz,sp,br` | HTTP 404 |

Temperaturas são registros pontuais arredondados, não valores fixos do bot. A chave inicialmente retornou 401 e passou a funcionar após ativação. Nenhuma chave é incluída neste documento.

## Teste integrado

A credencial foi associada aos quatro nós Telegram. A falha de DNS no endereço temporário original foi diagnosticada, o túnel renovado e o webhook registrado; a fila de mensagens pendentes zerou.

As execuções reais terminaram com sucesso nos nós **Enviar orientação**, **Enviar temperatura** e **Enviar erro de consulta**. O autor confirmou o recebimento no celular. Isso comprova o fluxo integrado, mas não equivale a afirmar que cada uma das três cidades foi enviada pelo celular: as três foram verificadas individualmente na API real e no fluxo simulado.

## Cuidados de entrega

- Excluir `.env`, `tmp`, `node_modules`, caches, bancos, logs e exportações de credenciais.
- Não distribuir os vínculos de credenciais nem dados de conversas da instância de teste.
- Manter JSON e README na raiz do repositório público.
- Repositório público indicado: `Breno1974/rocketseat_chatbot-telegram_Almiro`. O PDF orienta o nome literal `chatbot-telegram`; o nome escolhido inclui prefixo e sufixo, conforme registrado no README.
- Confirmar a publicação no GitHub: a preparação local não comprova que os arquivos já estejam online.
