// Executa cópias de teste em um container descartável, sem rede ou credenciais.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const original = require('./gerar-workflow.cjs');
const root = __dirname;
const dir = path.join(root, 'tmp', 'testes-n8n');
fs.mkdirSync(dir, {recursive:true});
const erroCidade = '❌ Cidade não encontrada. Use o formato Cidade,UF,BR (ex.: São Paulo,SP,BR).';
const indisponivel = '⚠️ Não foi possível consultar o clima agora. Tente novamente mais tarde.';
const casos = [
 {nome:'São Paulo',text:'  São Paulo, SP, BR ',queue:'sao paulo,sp,br',body:{statusCode:200,body:{cod:200,main:{temp:24.6}}},rota:'Enviar temperatura',message:'🌤️ A temperatura em São Paulo é de 25°C.'},
 {nome:'Rio de Janeiro',text:'Rio de Janeiro,RJ,BR',queue:'rio de janeiro,rj,br',body:{cod:200,main:{temp:0}},rota:'Enviar temperatura',message:'🌤️ A temperatura em Rio de Janeiro é de 0°C.'},
 {nome:'Belo Horizonte',text:'Belo Horizonte,MG,BR',queue:'belo horizonte,mg,br',body:{statusCode:200,body:{main:{temp:-3.7}}},rota:'Enviar temperatura',message:'🌤️ A temperatura em Belo Horizonte é de -4°C.'},
 {nome:'Cidade inexistente',text:'CidadeInexistente,SP,BR',queue:'cidadeinexistente,sp,br',body:{statusCode:404,body:{cod:'404'}},rota:'Enviar erro de consulta',message:erroCidade},
 {nome:'Mensagem sem texto',rota:'Enviar orientação',message:erroCidade},
 {nome:'Formato inválido',text:'São Paulo,,BR',rota:'Enviar orientação',message:erroCidade},
 {nome:'Falha de rede',text:'São Paulo,SP,BR',queue:'sao paulo,sp,br',body:{error:'timeout simulado'},rota:'Enviar erro de consulta',message:indisponivel},
 {nome:'Resposta inválida',text:'São Paulo,SP,BR',queue:'sao paulo,sp,br',body:{statusCode:200,body:{main:{temp:null}}},rota:'Enviar erro de consulta',message:indisponivel}
];
const workflows = casos.map((caso,i)=>{
 const w = structuredClone(original);
 w.id = `testeclima${String(i).padStart(6,'0')}`;
 w.name = 'TESTE SIMULADO: ' + caso.nome;
 const trigger = w.nodes.find(n=>n.name==='Telegram Trigger');
 trigger.type='n8n-nodes-base.manualTrigger'; trigger.typeVersion=1; trigger.parameters={}; delete trigger.webhookId;
 const mensagem = {message:{chat:{id:-9000-i}}};
 if (caso.text !== undefined) mensagem.message.text=caso.text;
 w.nodes.push({id:'fixture',name:'Mensagem simulada',type:'n8n-nodes-base.code',typeVersion:2,position:[100,0],parameters:{jsCode:`return [{json:${JSON.stringify(mensagem)}}];`}});
 w.connections['Telegram Trigger'].main[0][0].node='Mensagem simulada';
 w.connections['Mensagem simulada']={main:[[{node:'Normalizar entrada',type:'main',index:0}]]};
 const http=w.nodes.find(n=>n.name==='Consultar OpenWeather');
 http.type='n8n-nodes-base.code'; http.typeVersion=2;
 http.parameters={jsCode:`return [{json:${JSON.stringify(caso.body||{})}}];`}; delete http.onError;
 for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.telegram')){
  const messageExpression=n.name==='Enviar orientação' ? JSON.stringify(erroCidade) : '$json.message';
  n.type='n8n-nodes-base.code'; n.typeVersion=2;
  n.parameters={jsCode:`const normalizado=$('Normalizar entrada').first().json;
if (${JSON.stringify(n.name)} !== ${JSON.stringify(caso.rota)}) throw new Error('Rota incorreta');
if ($json.chatId !== ${-9000-i}) throw new Error('Chat incorreto');
${caso.queue ? `if (normalizado.queue !== ${JSON.stringify(caso.queue)}) throw new Error('Normalizacao incorreta');` : ''}
const message=${messageExpression};
if (message !== ${JSON.stringify(caso.message)}) throw new Error('Mensagem incorreta: '+message);
return [{json:{teste:${JSON.stringify(caso.nome)},simulado:true,ok:true,message}}];`};
 }
 return w;
});
fs.writeFileSync(path.join(dir,'workflows.json'),JSON.stringify(workflows));
const bins=['docker',process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA,'Programs','DockerDesktop','resources','bin','docker.exe')].filter(Boolean);
const docker=bins.find(bin=>spawnSync(bin,['--version'],{windowsHide:true,stdio:'ignore'}).status===0);
if(!docker){console.error('Docker indisponível neste terminal. Execute em um terminal local com acesso ao Docker.');process.exit(1);}
const commands=['n8n import:workflow --input=/tests/workflows.json > /tmp/import.log'];
for(const w of workflows) commands.push(`n8n execute --id=${w.id} --rawOutput > /tmp/${w.id}.json || { cat /tmp/${w.id}.json; exit 1; }`);
commands.push("echo 'TESTES_N8N_OK: 8 cenarios simulados passaram no motor n8n.'");
console.log('Testando 8 cenários no n8n real, em container descartável sem acesso à rede...');
const result=spawnSync(docker,['run','--rm','--network','none','--mount',`type=bind,source=${dir},target=/tests,readonly`,'-e','N8N_DIAGNOSTICS_ENABLED=false','-e','N8N_VERSION_NOTIFICATIONS_ENABLED=false','--entrypoint','/bin/sh','docker.n8n.io/n8nio/n8n:2.44.6','-c',commands.join(' && ')],{cwd:root,encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:2*1024*1024});
if(result.stdout) console.log(result.stdout.trim());
if(result.stderr) console.error(result.stderr.trim());
if(result.error) console.error('Falha ao executar container de teste: '+result.error.code);
process.exitCode=result.status===0?0:1;
