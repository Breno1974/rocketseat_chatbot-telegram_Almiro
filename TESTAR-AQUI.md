# Testar nesta máquina

**Autor: Almiro Breno de Moura**

O projeto usa Node já instalado e Docker Desktop. Não precisa instalar pacotes npm, Python, Git, ngrok ou criar conta Cloudflare.

## 1. Preparar

Instale [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/) se necessário. Inicie o aplicativo e aguarde o engine ficar disponível. Use containers Linux e siga a orientação do instalador sobre WSL 2/reinicialização.

No terminal nesta pasta:

```powershell
node ambiente.cjs preparar
node verificar.cjs
node ambiente.cjs diagnostico
```

O primeiro comando cria `.env` sem sobrescrever um existente. Abra esse arquivo no editor e substitua apenas o exemplo de `OPENWEATHER_API_KEY` pela sua chave. O token Telegram será inserido diretamente no n8n.

## 2. Iniciar

```powershell
node ambiente.cjs iniciar
```

Na primeira execução, o Docker baixa as imagens. O comando inicia o n8n, espera ficar pronto, cria um túnel HTTPS temporário, grava automaticamente `WEBHOOK_URL` no `.env` e recria somente o n8n se o endereço mudou. As imagens nginx e cloudflared acompanham seus canais estáveis/latest para este ambiente de teste; n8n tem versão fixa no Compose principal.

O túnel [Quick Tunnel da Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) não exige conta. Seu endereço muda quando o container do túnel é recriado e não tem garantia de disponibilidade. O proxy encaminha apenas os caminhos de webhook; o editor não é disponibilizado pelo túnel.

Para abrir somente o n8n local, sem túnel: `node ambiente.cjs local`. Nesse modo o Telegram não alcança a máquina até você configurar um webhook HTTPS público.

## 3. Configurar o bot uma vez

1. Abra <http://localhost:5678> e crie sua conta local.
2. No Telegram, obtenha o token do seu bot com [@BotFather](https://t.me/BotFather), comando `/newbot`.
3. Crie uma credencial **Telegram API** no n8n e cole o token nela.
4. Abra o workflow **Bot de clima no Telegram**, já importado nesta máquina. Se estiver preparando outra instância, importe `workflow-chatbot-telegram.json` pelo menu **Import from File** do editor.
5. Selecione essa mesma credencial em **Telegram Trigger**, **Enviar temperatura**, **Enviar erro de consulta** e **Enviar orientação**.
6. Salve e ative/publique o workflow. Envie `/start` ao bot e depois uma cidade.

Não use o mesmo bot simultaneamente em outra instância n8n. O modo de teste pode substituir o webhook ativo; para restaurá-lo, desative e reative o workflow. Depois de uma mudança na URL do túnel, faça o mesmo.

## 4. Validar

Para executar oito cenários simulados dentro do motor real do n8n:

```powershell
node teste-n8n.cjs
```

Esse teste já passou nesta máquina. Ele usa um container descartável sem rede e sem credenciais, preserva o workflow principal e verifica os nós Code/IF e as mensagens esperadas. As chamadas HTTP e os envios Telegram são substituídos por dados/validações de teste. Não depende da ativação da chave OpenWeather.

Teste primeiro a API real, sem enviar mensagens Telegram:

```powershell
node ambiente.cjs api
```

São realizadas quatro consultas: São Paulo, Rio de Janeiro, Belo Horizonte e cidade inexistente. O comando imprime status e temperatura real, sem imprimir a chave. Uma chave nova pode precisar de tempo para ativar. O teste mantém exatamente o parâmetro `q` do workflow, inclusive a UF; eventual incompatibilidade de UF precisa ser verificada conforme a limitação descrita no README.

Depois envie pelo Telegram e confira as execuções no n8n:

| Mensagem | Esperado |
| --- | --- |
| `São Paulo,SP,BR` | Temperatura real em °C |
| `Rio de Janeiro,RJ,BR` | Temperatura real em °C |
| `Belo Horizonte,MG,BR` | Temperatura real em °C |
| `CidadeInexistenteXYZ,SP,BR` | Mensagem de cidade não encontrada |
| `/start` ou `São Paulo,,BR` | Orientação de formato |

Envie também `São Paulo` se a API não aceitar a combinação com UF. Não marque o teste completo como aprovado se as três entradas exigidas falharem. Os testes automatizados de lógica usam dados simulados e não substituem este teste integrado.

## 5. Diagnóstico e encerramento

```powershell
node ambiente.cjs diagnostico
node ambiente.cjs logs
node ambiente.cjs parar
```

Os dados e credenciais persistem no volume `n8n_data`. Parar não apaga esse volume. Não compartilhe o `.env` nem logs sem revisão: logs do n8n podem conter dados das mensagens/execuções. O diagnóstico não imprime segredos.

Se o bot não responder e o Telegram indicar falha de DNS no webhook, renove o endereço temporário com `node ambiente.cjs renovar`. O comando recria o túnel, atualiza `.env` e reinicia o n8n. Depois despublique e publique novamente o workflow no editor para registrar o novo webhook. O `.env` mantém `WEBHOOK_URL`; o Compose fornece esse valor como `N8N_WEBHOOK_URL`, conforme a configuração atual do n8n.

## Situação desta preparação

Após a reinicialização, Docker/WSL 2 foram confirmados funcionando com containers Linux. n8n 2.44.6, proxy e túnel foram iniciados. O endpoint local `/healthz` respondeu HTTP 200. O workflow **Bot de clima no Telegram** foi importado com sucesso pelo CLI do n8n e sua presença foi confirmada com `list:workflow`.

O endereço HTTPS foi gravado automaticamente no `.env`. A raiz pública respondeu 404 do proxy e um caminho de webhook de diagnóstico respondeu 404 do próprio n8n, confirmando o encaminhamento sem expor o editor. O webhook real foi registrado após configurar a credencial e ativar o workflow.

Os testes locais de lógica e a validação do Compose passaram. A conta local e as credenciais foram configuradas. As consultas reais à API e o fluxo integrado foram validados. A conferência visual do editor não foi realizada porque não havia navegador conectado à sessão.

Validação adicional: oito cenários passaram no motor real do n8n em container descartável sem rede: São Paulo, Rio de Janeiro, Belo Horizonte, cidade inexistente, mensagem sem texto, formato inválido, falha de rede e resposta inválida.

Na última conferência, a credencial Telegram estava associada aos quatro nós. O teste real do OpenWeather retornou HTTP 200 para São Paulo (19°C), Rio de Janeiro (23°C) e Belo Horizonte (22°C), e HTTP 404 para cidade inexistente. Esses valores são registros pontuais do teste, não previsões nem valores fixos do bot. O workflow foi publicado/ativado localmente e o n8n respondeu HTTP 200 na saúde após reinício. O autor confirmou o recebimento da resposta no celular.

Teste integrado: o Telegram rejeitava o endereço anterior do túnel com `Failed to resolve host`. O túnel foi renovado, o webhook registrado e a fila de mensagens pendentes zerada. As execuções reais recebidas terminaram com sucesso nos nós **Enviar orientação**, **Enviar temperatura** e **Enviar erro de consulta**. O recebimento no celular foi confirmado pelo autor. Consulte [VALIDACAO.md](VALIDACAO.md) para distinguir os testes simulados das verificações reais.
