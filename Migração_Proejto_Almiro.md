# Abrir e executar o projeto em outra máquina

**Autor: Almiro Breno de Moura**

Este pacote contém o projeto completo para desenvolvimento e execução, incluindo os scripts auxiliares locais. A entrega acadêmica no GitHub continua com seus três arquivos; este ZIP tem outra finalidade: permitir trabalhar e executar o projeto em outra máquina.

## Preparar a nova máquina

1. Extraia todo o ZIP em uma pasta de sua escolha. Não execute os arquivos de dentro do ZIP.
2. Instale Node.js 24 ou superior e Docker Desktop com Docker Compose. No Windows, configure WSL 2 e virtualização, reinicie se solicitado e aguarde o Docker funcionar com containers Linux.
3. Abra a pasta extraída no VS Code ou outro editor. Não é necessário executar `npm install`: os scripts usam módulos nativos do Node.js. As imagens n8n, nginx e cloudflared serão baixadas pelo Docker na primeira inicialização; é necessário acesso à internet.

## Configurar e iniciar

No terminal da pasta extraída:

```powershell
node ambiente.cjs preparar
```

Abra o `.env` criado e configure sua chave real em `OPENWEATHER_API_KEY`. O endereço `WEBHOOK_URL` será preenchido automaticamente pelo inicializador.

```powershell
node ambiente.cjs diagnostico
node verificar.cjs
node ambiente.cjs iniciar
```

No Windows, depois de preencher a chave, também é possível executar `INICIAR-TESTES.cmd`. Ele prepara o ambiente, valida o workflow e inicia os serviços.

O inicializador usa `docker-compose.yml`, `docker-compose.teste.yml` e `webhook.conf` para iniciar n8n, proxy e túnel HTTPS temporário. O editor fica em <http://localhost:5678>; o túnel automático encaminha apenas os webhooks.

## Configurar o n8n na nova instalação

1. Abra <http://localhost:5678> e crie sua conta local.
2. Importe `workflow-chatbot-telegram.json` pelo menu **Import from File**.
3. Crie a credencial **Telegram API**, com o token fornecido pelo BotFather.
4. Selecione essa credencial no **Telegram Trigger** e nos três nós de envio.
5. Salve e publique/ative o workflow.
6. Envie `São Paulo,SP,BR` ao seu bot e confira a resposta no celular.

O pacote não contém a chave OpenWeather, o token Telegram, a conta/senha n8n, histórico de conversas ou banco de dados da instalação anterior. Esses dados precisam ser configurados na nova instalação. O JSON não inclui vínculos a credenciais locais.

**Se usar o mesmo bot, desative o workflow na máquina antiga antes de ativá-lo na nova.** O Telegram permite apenas um webhook por bot; duas instalações podem substituir o registro uma da outra. Para testes simultâneos, crie outro bot.

## Comandos úteis

```powershell
node ambiente.cjs api       # Testar OpenWeather real com a chave local
node teste-n8n.cjs          # Oito cenários simulados em container descartável
node ambiente.cjs logs     # Diagnóstico dos serviços
node ambiente.cjs renovar  # Renovar endereço temporário do túnel
node ambiente.cjs parar    # Parar sem apagar o volume de dados
node gerar-workflow.cjs    # Regenerar o JSON após editar o código
```

Após renovar o túnel, despublique/publique o workflow para registrar a nova URL. Mantenha a máquina, Docker e túnel em funcionamento enquanto usar o bot.

O README descreve os requisitos do exercício e a configuração manual com Docker. Para o ambiente automatizado deste ZIP, siga primeiro este guia e depois `TESTAR-AQUI.md`. `VALIDACAO.md` registra os testes anteriores; na nova máquina, repita os testes antes de considerar a instalação pronta.

Não publique `.env`, tokens, chaves, bancos, volumes ou logs com dados pessoais. Não são necessários Python, Git, GitHub CLI, ngrok ou pacotes npm para executar este projeto.
