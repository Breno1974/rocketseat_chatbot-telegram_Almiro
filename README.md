# Bot de clima no Telegram com n8n

**Autor: Almiro Breno de Moura**  
Desafio prático — Agentes e Automação, Rocketseat.

Chatbot que recebe o nome de uma cidade brasileira no Telegram, consulta a API OpenWeather e devolve uma mensagem curta em português com a temperatura atual, arredondada e em °C. A implementação é determinística e não utiliza Gemini.

## Arquivos

- **`workflow-chatbot-telegram.json`**: workflow exportável/importável no n8n, sem tokens ou credenciais locais.
- **`README.md`**: descrição, configuração, importação e execução.
- **`docker-compose.yml`**: arquivo opcional de execução local com Docker, conforme permitido no desafio.

## Fluxo do chatbot

```text
Telegram Trigger → Normalizar entrada → Entrada válida?
  ├─ Não → Enviar orientação
  └─ Sim → Consultar OpenWeather → Interpretar resposta → Resposta válida?
      ├─ Sim → Enviar temperatura
      └─ Não → Enviar erro de consulta
```

O nó de normalização captura `message.text` e `message.chat.id`. Mantém `queue`, `originalInput`, `displayCity` e `chatId`, remove espaços excedentes, normaliza acentos e minúsculas e verifica o formato. Mensagens sem texto, comandos e entradas inválidas recebem orientação.

O HTTP Request permite avaliar respostas de erro sem interromper o fluxo. A interpretação aceita resposta direta ou completa (`body`/`statusCode`), verifica status e temperatura numérica e trata falhas de rede ou payload inválido. O destino Telegram sempre vem do `chatId` recebido.

## Pré-requisitos

- n8n **2.44.6**, versão utilizada nos testes de importação e execução.
- Um bot Telegram criado no BotFather e seu token.
- Uma chave OpenWeather para a API Current Weather.
- Uma URL HTTPS pública para o webhook. `localhost` sozinho não é acessível pelo Telegram.
- Docker Desktop/Compose com containers Linux, caso use o Compose fornecido. No Windows, configure WSL 2 e virtualização.

## 1. Criar o bot e obter `TELEGRAM_BOT_TOKEN`

1. Abra o Telegram e procure o perfil oficial [@BotFather](https://t.me/BotFather).
2. Toque em **Iniciar** e envie `/newbot`.
3. Escolha um nome e um nome de usuário disponível terminado em `bot`.
4. Guarde o token recebido: esse é o valor chamado **`TELEGRAM_BOT_TOKEN`** no desafio.

No n8n, crie uma credencial **Telegram API** e cole o token em **Access Token**. O token fica no mecanismo de credenciais do n8n, não no JSON. A variável `TELEGRAM_BOT_TOKEN` não cria essa credencial automaticamente e não precisa ser enviada ao container.

## 2. Obter `OPENWEATHER_API_KEY`

Crie uma conta no [OpenWeather](https://home.openweathermap.org/users/sign_up), confirme seu e-mail e copie a chave em [API Keys](https://home.openweathermap.org/api_keys). Chaves novas podem levar algum tempo para ativar; HTTP 401 também pode indicar chave incorreta.

A chave deve estar na variável de ambiente **`OPENWEATHER_API_KEY`** do processo/container n8n. Não cole o valor diretamente no nó HTTP Request.

## 3. Executar o n8n localmente

Se já possui uma instância n8n própria, configure a variável no ambiente dessa instância e siga para a importação.

Para usar Docker no Windows, inicie o Docker Desktop. Abra o PowerShell na pasta do projeto e configure a chave sem mostrá-la na tela:

```powershell
$chaveOpenWeather = Read-Host 'Chave OpenWeather' -AsSecureString
$env:OPENWEATHER_API_KEY = [System.Net.NetworkCredential]::new('', $chaveOpenWeather).Password
$env:WEBHOOK_URL = 'https://seu-endereco-publico/'
docker compose up -d
```

Substitua `WEBHOOK_URL` pela URL HTTPS pública real, terminada em `/`. O Compose repassa esse valor ao n8n como `N8N_WEBHOOK_URL`. Abra <http://localhost:5678> e crie sua conta local.

Para obter uma URL temporária de teste, instale o [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) e execute em outro terminal:

```powershell
cloudflared tunnel --url http://localhost:5678
```

Copie o endereço HTTPS exibido para `$env:WEBHOOK_URL` e aplique a configuração com `docker compose up -d --force-recreate`. Mantenha o terminal do túnel aberto. Esse modo encaminha o serviço local pela URL pública: use-o somente em ambiente de teste com sua conta n8n configurada. Para uso contínuo, configure um endereço estável e controle de acesso ao editor.

O Compose define `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` para permitir a expressão `$env` exigida no exercício. Use uma instância controlada: quem pode editar workflows pode acessar variáveis do processo.

Para parar: `docker compose down`. O volume `n8n_data` preserva os dados e as credenciais. Nunca publique esse volume ou seus backups.

## 4. Importar e ativar

1. No editor n8n, crie um workflow e use **Import from File** para importar **`workflow-chatbot-telegram.json`**.
2. Selecione a credencial Telegram nos quatro nós: **Telegram Trigger**, **Enviar temperatura**, **Enviar erro de consulta** e **Enviar orientação**.
3. Confirme que `OPENWEATHER_API_KEY` está disponível no ambiente do n8n. Se alterou a variável após iniciar, recrie/reinicie o container para aplicá-la.
4. Salve e **publique/ative** o workflow. O JSON público é distribuído inativo e sem vínculos à credencial usada nos testes.
5. No celular, abra o link do seu bot fornecido pelo BotFather, toque em **Iniciar** e envie uma cidade.

Cada bot possui um único webhook. Não use o mesmo bot em duas instâncias simultâneas. O modo de teste pode substituir o webhook de produção; após usá-lo ou alterar a URL, despublique e publique novamente o workflow.

## `queue` e o parâmetro `q`

O enunciado menciona `queue`. O workflow cria essa propriedade interna, mas envia seu conteúdo pelo parâmetro **`q`**, nome aceito pela API OpenWeather. Exemplo: `São Paulo, SP, BR` gera `queue = sao paulo,sp,br`.

O nó HTTP Request usa `https://api.openweathermap.org/data/2.5/weather`, com **Send Query Parameters** habilitado:

| Parâmetro | Valor |
| --- | --- |
| `q` | `={{ $json.queue }}` |
| `units` | `metric` |
| `lang` | `pt_br` |
| `appid` | `={{ $env.OPENWEATHER_API_KEY }}` |

Também são aceitos `São Paulo` e `São Paulo,SP`, com acréscimo de `BR`. Campos vazios entre vírgulas, UF inválida e país diferente de `BR` recebem orientação antes da consulta.

## Exemplos e checklist de teste

Envie cada mensagem separadamente ao bot e confira a execução no n8n:

| Entrada | Resultado esperado |
| --- | --- |
| `São Paulo,SP,BR` | `🌤️ A temperatura em São Paulo é de XX°C.` |
| `Rio de Janeiro,RJ,BR` | Temperatura atual do Rio de Janeiro em °C |
| `Belo Horizonte,MG,BR` | Temperatura atual de Belo Horizonte em °C |
| `CidadeInexistenteXYZ,SP,BR` | `❌ Cidade não encontrada. Use o formato Cidade,UF,BR (ex.: São Paulo,SP,BR).` |
| `CidadeInexistente,XX,BR`, `/start` ou `São Paulo,,BR` | Orientação de formato |
| Mensagem sem texto | Orientação de formato |

`XX` na resposta de sucesso é apenas ilustrativo: a temperatura vem da API e varia. Use uma UF válida no nome inexistente para testar o HTTP 404; `XX` é rejeitado antes da consulta. O Telegram não permite enviar texto realmente vazio; esse caso pode ser validado com dados simulados no nó de normalização.

Confirme também que a resposta chega ao mesmo chat e não contém dados técnicos. Falhas de rede, chave inválida e respostas inesperadas recebem mensagem de indisponibilidade, sem expor a chave ou o payload.

## Validação realizada

- JSON e estrutura dos nós conferidos; importação real no n8n 2.44.6 bem-sucedida.
- Oito cenários simulados passaram no motor n8n: três cidades, cidade inexistente, mensagem sem texto, formato inválido, falha de rede e resposta inválida.
- Consultas reais à API retornaram HTTP 200 para São Paulo (19°C), Rio de Janeiro (23°C) e Belo Horizonte (22°C), e HTTP 404 para cidade inexistente. São registros pontuais arredondados, não temperaturas fixas.
- O fluxo recebeu mensagens reais e concluiu envios de orientação, temperatura e erro de consulta. O autor confirmou o recebimento no celular.

Os testes das três cidades foram feitos individualmente na API real e no fluxo simulado. A confirmação de recebimento no celular comprova o teste integrado, sem afirmar que as três cidades foram enviadas pelo celular.

## Limitações

- O computador, n8n e túnel precisam permanecer funcionando no ambiente local.
- Quick Tunnels são temporários e não garantem disponibilidade. Se o Telegram deixar de receber mensagens, confira `getWebhookInfo`, renove o túnel e registre novamente o webhook. Uma falha de DNS desse tipo foi identificada e corrigida nos testes.
- A busca por nome pode ser ambígua para cidades homônimas. A documentação da API limita a busca por estado aos EUA; as três consultas brasileiras passaram, mas isso não garante desambiguação de todas as cidades.
- O bot funciona sem chave ou credencial Gemini.

## Autoria, referências e segurança

Projeto de **Almiro Breno de Moura**. Não houve cópia de código ou workflows de outros projetos. Referências técnicas: [n8n](https://docs.n8n.io/), [OpenWeather Current Weather](https://openweathermap.org/api/current) e [Telegram Bot API](https://core.telegram.org/bots/api).

O PDF apresenta dois nomes para o JSON; foi usado **`workflow-chatbot-telegram.json`**, conforme a seção Entrega e as orientações finais de exportação.

**Nenhum segredo deve ser versionado.** Não envie tokens, chaves, arquivos `.env`, bancos do n8n, credenciais exportadas, logs ou dados pessoais de conversas ao GitHub. Cada avaliador configura suas próprias credenciais após importar o workflow.
