# Bot de clima no Telegram com n8n

**Autor: Almiro Breno de Moura**  
Desafio prático de Agentes e Automação — Rocketseat.

Chatbot que recebe uma cidade brasileira pelo Telegram, consulta a temperatura atual no OpenWeather e responde em português brasileiro. A resposta é determinística, sem Gemini e sem dependências de IA.

## Entrega

Os arquivos obrigatórios estão na raiz: **`workflow-chatbot-telegram.json`** e **`README.md`**. Também são fornecidos Docker Compose, exemplo de ambiente, scripts de teste e [registro de validação](VALIDACAO.md).

O PDF apresenta dois nomes para o JSON; foi adotado `workflow-chatbot-telegram.json`, usado na seção Entrega e nas instruções finais de exportação.

## Fluxo

```text
Telegram Trigger → Normalizar entrada → Entrada válida?
  ├─ Não → Enviar orientação
  └─ Sim → Consultar OpenWeather → Interpretar resposta → Resposta válida?
      ├─ Sim → Enviar temperatura
      └─ Não → Enviar erro de consulta
```

A normalização mantém `queue`, `originalInput`, `displayCity` e `chatId`. Remove espaços extras e acentos, normaliza minúsculas e verifica o formato. O nome informado é preservado para a resposta. O chat de destino é sempre obtido da mensagem recebida.

## Pré-requisitos

- n8n **2.44.6**, versão utilizada nos testes de importação e execução.
- Docker Desktop/Compose com containers Linux para usar o ambiente fornecido; no Windows, WSL 2 configurado.
- Node.js 24 ou superior para os scripts auxiliares. Não é necessário instalar pacotes npm.
- Bot Telegram criado com [@BotFather](https://t.me/BotFather).
- Chave da API Current Weather do [OpenWeather](https://home.openweathermap.org/api_keys).
- URL HTTPS pública para o webhook; o Telegram não alcança `localhost` diretamente.

## Executar localmente

Na pasta do projeto, com Docker Desktop iniciado:

```powershell
node ambiente.cjs preparar
node verificar.cjs
```

O primeiro comando cria `.env` somente se ele não existir. Edite esse arquivo e configure:

```env
OPENWEATHER_API_KEY=coloque_sua_chave_aqui
```

Inicie o ambiente:

```powershell
node ambiente.cjs iniciar
```

O comando inicia o n8n e um túnel temporário Cloudflare, grava `WEBHOOK_URL` no `.env` e aplica o endereço ao container como `N8N_WEBHOOK_URL`. O proxy encaminha apenas `/webhook/` e `/webhook-test/`. Abra <http://localhost:5678> e crie sua conta local.

Alternativa com túnel próprio: configure `WEBHOOK_URL=https://seu-endereco-publico/` no `.env`, execute `docker compose up -d` e encaminhe o túnel para a porta local 5678. Os scripts de túnel fornecidos são opcionais. Mais detalhes em [TESTAR-AQUI.md](TESTAR-AQUI.md).

O Compose usa `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` para permitir a expressão `$env` exigida no desafio. Use uma instância controlada: usuários que editam workflows podem ler variáveis de ambiente.

## Telegram: criar o bot e configurar a credencial

1. No Telegram, abra o perfil oficial [@BotFather](https://t.me/BotFather), toque em **Iniciar** e envie `/newbot`.
2. Escolha o nome e um nome de usuário disponível terminado em `bot`.
3. Guarde o token recebido: esse é o valor chamado **`TELEGRAM_BOT_TOKEN`** no desafio.
4. No n8n, crie uma credencial **Telegram API** e cole o token em **Access Token**.

O token fica nas credenciais do n8n, não no JSON. Não é necessário colocá-lo no `.env`; definir a variável `TELEGRAM_BOT_TOKEN`, isoladamente, não cria a credencial no n8n.

## OpenWeather: obter e configurar a chave

Crie sua conta no [OpenWeather](https://home.openweathermap.org/users/sign_up), confirme o e-mail e copie a chave na seção [API Keys](https://home.openweathermap.org/api_keys). Salve-a somente em `OPENWEATHER_API_KEY` no `.env` local. Chaves novas podem demorar a ativar; HTTP 401 também pode indicar chave incorreta.

Após alterar `.env`, execute `node ambiente.cjs iniciar` para aplicar a configuração ao container. Em uma instalação n8n existente, configure a variável no ambiente do processo/servidor e reinicie-o conforme sua instalação.

## Importar e ativar

1. No editor do n8n, crie um workflow e use **Import from File** para importar `workflow-chatbot-telegram.json`.
2. Selecione a mesma credencial Telegram em **Telegram Trigger**, **Enviar temperatura**, **Enviar erro de consulta** e **Enviar orientação**.
3. Confirme a variável `OPENWEATHER_API_KEY` no ambiente do n8n.
4. Salve e **publique/ative** o workflow. O JSON público é distribuído inativo e sem vínculos à credencial da instalação de teste.
5. Abra seu bot no celular, toque em **Iniciar** e envie uma cidade.

Cada bot tem um único webhook. Não use o mesmo bot em duas instâncias simultâneas. O modo de teste pode substituir o webhook de produção; após usá-lo ou alterar a URL, despublique e publique o workflow novamente.

## Campo `queue` e parâmetro `q`

O enunciado menciona `queue`. O workflow cria essa propriedade interna, mas envia seu valor pelo parâmetro **`q`**, aceito pela API OpenWeather. `São Paulo, SP, BR` gera `queue = sao paulo,sp,br`.

O nó HTTP Request usa `https://api.openweathermap.org/data/2.5/weather`, com envio de parâmetros habilitado:

| Parâmetro | Valor no workflow |
| --- | --- |
| `q` | `={{ $json.queue }}` |
| `units` | `metric` |
| `lang` | `pt_br` |
| `appid` | `={{ $env.OPENWEATHER_API_KEY }}` |

Também são aceitos `São Paulo` e `São Paulo,SP`, com acréscimo de `BR`. Campos vazios entre vírgulas, UF inválida, país diferente de `BR`, comandos e mensagens sem texto recebem orientação antes da consulta.

## Exemplos de uso

| Mensagem | Resposta esperada |
| --- | --- |
| `São Paulo,SP,BR` | `🌤️ A temperatura em São Paulo é de XX°C.` |
| `Rio de Janeiro,RJ,BR` | Temperatura atual do Rio de Janeiro em °C |
| `Belo Horizonte,MG,BR` | Temperatura atual de Belo Horizonte em °C |
| `CidadeInexistenteXYZ,SP,BR` | `❌ Cidade não encontrada. Use o formato Cidade,UF,BR (ex.: São Paulo,SP,BR).` |
| `/start`, mensagem sem texto ou `São Paulo,,BR` | Orientação de formato |

`XX` é apenas ilustrativo. A temperatura vem da API e é arredondada. Respostas HTTP de erro são avaliadas pelo fluxo; falhas de rede, chave inválida e payload inesperado recebem mensagem de indisponibilidade, sem expor detalhes técnicos.

## Testes

```powershell
node verificar.cjs       # Sintaxe, estrutura, parâmetros e lógica
node teste-n8n.cjs       # Oito cenários simulados no motor real do n8n
node ambiente.cjs api    # Consultas reais com a chave do .env
```

Foram verificados JSON, importação no n8n, oito cenários simulados, consultas reais às três cidades e cidade inexistente. O fluxo recebeu mensagens reais e executou os nós de envio; o autor confirmou o recebimento no celular. O [registro de validação](VALIDACAO.md) distingue os testes simulados dos testes reais.

Para regenerar o JSON após editar o código: `node gerar-workflow.cjs`. O verificador confere que JSON e gerador correspondem.

## Limitações e diagnóstico

- O computador, Docker e túnel precisam permanecer funcionando para o ambiente local responder.
- Quick Tunnels são temporários e não oferecem disponibilidade garantida. Se o endereço deixar de resolver: `node ambiente.cjs renovar`, depois despublique/publique o workflow. Essa falha foi identificada e corrigida no teste integrado.
- A busca por nome pode ser ambígua para cidades homônimas. A API documenta busca por estado apenas para os EUA; as três consultas brasileiras exigidas passaram, mas isso não garante desambiguação de todas as cidades.
- Telegram não permite enviar texto realmente vazio; esse caso foi validado com dados simulados.
- Diagnóstico: `node ambiente.cjs diagnostico` e `node ambiente.cjs logs`. Revise logs antes de compartilhar.
- Encerramento: `node ambiente.cjs parar`. O volume Docker preserva os dados e as credenciais locais.

## Autoria e referências técnicas

Projeto de **Almiro Breno de Moura**. Não houve cópia de código ou workflows de outros projetos. Referências dos serviços utilizados:

- [Documentação do n8n](https://docs.n8n.io/)
- [API Current Weather — OpenWeather](https://openweathermap.org/api/current)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

## Repositório e segurança

O repositório público indicado pelo autor é [Breno1974/rocketseat_chatbot-telegram_Almiro](https://github.com/Breno1974/rocketseat_chatbot-telegram_Almiro). Os arquivos obrigatórios foram preparados para a raiz desse repositório. O PDF orienta o nome literal `chatbot-telegram`; o nome escolhido pelo autor inclui um prefixo e um sufixo. Se a avaliação exigir correspondência exata, será necessário ajustar o nome.

**Nunca versione `.env`, tokens, chaves, bancos n8n, credenciais exportadas, logs ou dados pessoais de conversas.** `.env.example` contém somente exemplos. Cada avaliador deve configurar suas próprias credenciais após importar o JSON.
