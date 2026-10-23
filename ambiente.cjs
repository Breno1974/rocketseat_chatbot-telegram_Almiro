// Ferramentas locais sem dependências npm. Nunca imprime o conteúdo do .env.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = __dirname;
const envPath = path.join(root, '.env');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
class ErroLocal extends Error {}

function preparar() {
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(path.join(root, '.env.example'), envPath, fs.constants.COPYFILE_EXCL);
    console.log('.env criado com exemplos. Preencha OPENWEATHER_API_KEY localmente.');
  } else console.log('.env existente preservado.');
}
function lerEnv() {
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/).flatMap(line => {
    const m = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (!m) return [];
    let value = m[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    return [[m[1], value]];
  }));
}
function atualizarWebhook(url) {
  const original = fs.readFileSync(envPath, 'utf8');
  const line = `WEBHOOK_URL=${url}/`;
  const updated = /^WEBHOOK_URL=.*$/m.test(original)
    ? original.replace(/^WEBHOOK_URL=.*$/m, line)
    : original.trimEnd() + '\n' + line + '\n';
  fs.writeFileSync(envPath, updated);
}
function localizarDocker() {
  const candidates = ['docker'];
  if (process.platform === 'win32') for (const base of [process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Docker', 'Docker'), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop')]) {
    if (base) candidates.push(path.join(base, 'resources', 'bin', 'docker.exe'));
  }
  return candidates.find(bin => spawnSync(bin, ['--version'], { encoding:'utf8', windowsHide:true, timeout:10000 }).status === 0);
}
let docker;
function executar(args, capture = false) {
  const result = spawnSync(docker, args, {cwd:root, encoding:'utf8', windowsHide:true, stdio:capture ? 'pipe' : 'inherit', timeout:300000});
  if (result.status !== 0) throw new ErroLocal('Docker falhou. Confira se o Docker Desktop está iniciado e usando containers Linux.');
  return (result.stdout || '') + (result.stderr || '');
}
const compose = (args, capture) => executar(['compose','-f','docker-compose.yml','-f','docker-compose.teste.yml',...args],capture);
async function esperarN8n() {
  for (let i=0;i<60;i++) {
    try { if ((await fetch('http://127.0.0.1:5678/healthz', {signal:AbortSignal.timeout(2000)})).ok) return; } catch {}
    if (i % 15 === 0) console.log('Aguardando n8n ficar disponível...');
    await pause(1000);
  }
  throw new ErroLocal('n8n não ficou pronto em 60 segundos. Execute: node ambiente.cjs logs');
}
async function testarApi() {
  const key = lerEnv().OPENWEATHER_API_KEY;
  if (!key || /coloque|substitua/i.test(key)) throw new ErroLocal('Preencha OPENWEATHER_API_KEY no .env antes do teste real.');
  let failures = 0;
  for (const city of ['sao paulo,sp,br','rio de janeiro,rj,br','belo horizonte,mg,br','cidadeinexistentexyz,sp,br']) {
    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    url.search = new URLSearchParams({q:city, units:'metric', lang:'pt_br', appid:key});
    try {
      const response = await fetch(url, {signal:AbortSignal.timeout(15000)});
      const body = await response.json();
      const expectedError = city.startsWith('cidadeinexistente');
      const ok = expectedError ? response.status === 404 : response.ok && typeof body.main?.temp === 'number';
      if (!ok) failures++;
      console.log(`${ok ? 'OK' : 'FALHOU'}: ${city} — HTTP ${response.status}${!expectedError && ok ? `, ${Math.round(body.main.temp)}°C` : ''}`);
    } catch {
      failures++;
      console.log(`FALHOU: ${city} — conexão, timeout ou resposta inválida (detalhes omitidos para proteger a chave).`);
    }
  }
  if (failures) throw new ErroLocal(`${failures} consulta(s) falharam. HTTP 401: confira ativação/chave; 404 em cidade válida: consulte a limitação de UF no README.`);
  console.log('API validada. Isso ainda não valida o envio pelo Telegram.');
}
async function main(command = process.argv[2] || 'ajuda') {
  if (command === 'preparar') return preparar();
  if (command === 'api') return testarApi();
  if (!['diagnostico','iniciar','renovar','local','parar','logs'].includes(command)) {
    console.log('Uso: node ambiente.cjs preparar|diagnostico|local|iniciar|renovar|api|logs|parar');
    return;
  }
  docker = localizarDocker();
  if (command === 'diagnostico') {
    console.log(`Node: ${process.version}`);
    console.log(`.env: ${fs.existsSync(envPath) ? 'presente' : 'ausente — execute preparar'}`);
    console.log(`Chave OpenWeather: ${lerEnv().OPENWEATHER_API_KEY && !/coloque|substitua/i.test(lerEnv().OPENWEATHER_API_KEY) ? 'preenchida (não validada)' : 'pendente'}`);
    console.log(`Docker: ${docker ? 'encontrado' : 'não encontrado ou sem acesso neste terminal — confira Docker Desktop e reabra um terminal local'}`);
    if (!docker) { process.exitCode=1; return; }
    executar(['compose','version']); executar(['info','--format','{{.OSType}}']);
    return;
  }
  if (!docker) throw new ErroLocal('Docker não encontrado ou sem acesso neste terminal. Confira a instalação e tente no PowerShell local. Instalação: https://docs.docker.com/desktop/setup/install/windows-install/');
  if (command === 'parar') return compose(['down']);
  if (command === 'logs') return compose(['logs','--tail','80','n8n','webhook','tunnel']);
  preparar();
  executar(['info','--format','{{.OSType}}'],true);
  compose(['config','--quiet']);
  compose(['up','-d','n8n']);
  await esperarN8n();
  console.log('Editor local: http://localhost:5678 — crie sua conta e importe workflow-chatbot-telegram.json.');
  if (command === 'local') return;
  if (command === 'renovar') {
    console.log('Renovando endereço temporário do túnel...');
    compose(['up','-d','--no-deps','--force-recreate','tunnel']);
  }
  console.log('Iniciando túnel HTTPS temporário para os webhooks do Telegram...');
  compose(['up','-d','webhook','tunnel']);
  let url;
  for (let i=0;i<45;i++) {
    const logs = compose(['logs','--no-color','--tail','80','tunnel'],true);
    url = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/)?.[0];
    if (url) break;
    if (i % 15 === 0) console.log('Aguardando endereço HTTPS do túnel...');
    await pause(1000);
  }
  if (!url) throw new ErroLocal('Túnel não forneceu URL. Execute logs; confira sua conexão à internet.');
  const changed = lerEnv().WEBHOOK_URL !== url+'/';
  atualizarWebhook(url);
  if (changed) {
    compose(['up','-d','--no-deps','--force-recreate','n8n']);
    await esperarN8n();
  }
  console.log(`Webhook HTTPS configurado: ${url}/`);
  console.log('Selecione a credencial Telegram nos quatro nós, salve e ative o workflow.');
  console.log('Se ele já estava ativo e a URL mudou, desative e reative para registrar o webhook novamente.');
  console.log('O editor permanece em http://localhost:5678; o túnel só encaminha /webhook/ e /webhook-test/.');
}
if (require.main === module) main().catch(error => {
  // Erros de fetch podem conter a URL com appid; somente mensagens controladas são exibidas.
  console.error(error instanceof ErroLocal ? error.message : 'Não foi possível concluir. Confira permissões da pasta e a conexão. Use diagnostico ou consulte TESTAR-AQUI.md.');
  process.exitCode=1;
});
module.exports = {lerEnv, atualizarWebhook, main};
