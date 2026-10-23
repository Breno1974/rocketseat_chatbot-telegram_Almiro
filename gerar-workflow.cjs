const fs = require('fs');
const normalizar = `const msg = $json.message ?? {};
const text = typeof msg.text === 'string' ? msg.text.trim().replace(/\\s+/g, ' ') : '';
const partes = text.split(',').map(s => s.trim());
const cidade = partes[0] || '';
const normalizar = s => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const formato = partes.length === 1 ||
  (partes.length === 2 && (ufs.includes(partes[1].toUpperCase()) || partes[1].toUpperCase() === 'BR')) ||
  (partes.length === 3 && ufs.includes(partes[1].toUpperCase()) && partes[2].toUpperCase() === 'BR');
// Restringe consultas ao Brasil quando o usuário informa somente a cidade/UF.
const consulta = partes.length === 1 || (partes.length === 2 && partes[1].toUpperCase() !== 'BR') ? [...partes, 'BR'] : partes;
const queue = normalizar(consulta.join(','));
const valid = Boolean(/^[\\p{L}][\\p{L} .'-]*$/u.test(cidade) && cidade.length <= 100 && formato && msg.chat?.id && !text.startsWith('/'));
return [{ json: { queue, originalInput: text, displayCity: cidade, chatId: msg.chat?.id, valid } }];`;
const interpretar = `const input = $('Normalizar entrada').first().json;
const res = $json ?? {};
const body = res.body && typeof res.body === 'object' ? res.body : res;
const status = Number(res.statusCode ?? body.cod ?? (res.error ? 0 : 200));
const temp = body.main?.temp;
const apiStatus = Number(body.cod ?? status);
const ok = !res.error && status >= 200 && status < 300 && apiStatus >= 200 && apiStatus < 300 && typeof temp === 'number' && Number.isFinite(temp);
const message = ok
  ? '🌤️ A temperatura em ' + input.displayCity + ' é de ' + Math.round(temp) + '°C.'
  : status === 404
    ? '❌ Cidade não encontrada. Use o formato Cidade,UF,BR (ex.: São Paulo,SP,BR).'
    : '⚠️ Não foi possível consultar o clima agora. Tente novamente mais tarde.';
return [{json: {chatId: input.chatId, ok, message}}];`;
const node = (name,type,typeVersion,position,parameters,extra={}) => ({id:require('crypto').randomUUID(),name,type,typeVersion,position,parameters,...extra});
const nodes = [
 node('Telegram Trigger','n8n-nodes-base.telegramTrigger',1.2,[0,0],{updates:['message'],additionalFields:{}},{webhookId:require('crypto').randomUUID()}),
 node('Normalizar entrada','n8n-nodes-base.code',2,[220,0],{jsCode:normalizar}),
 node('Entrada válida?','n8n-nodes-base.if',2,[440,0],{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{id:'entrada-valida',leftValue:'={{ $json.valid }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}),
 node('Consultar OpenWeather','n8n-nodes-base.httpRequest',4.2,[660,-120],{url:'https://api.openweathermap.org/data/2.5/weather',sendQuery:true,queryParameters:{parameters:[{name:'q',value:'={{ $json.queue }}'},{name:'units',value:'metric'},{name:'lang',value:'pt_br'},{name:'appid',value:'={{ $env.OPENWEATHER_API_KEY }}'}]},options:{response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}},timeout:10000}},{onError:'continueRegularOutput'}),
 node('Interpretar resposta','n8n-nodes-base.code',2,[880,-120],{jsCode:interpretar}),
 node('Resposta válida?','n8n-nodes-base.if',2,[1100,-120],{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{id:'resposta-valida',leftValue:'={{ $json.ok }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}),
 node('Enviar temperatura','n8n-nodes-base.telegram',1.2,[1320,-220],{resource:'message',operation:'sendMessage',chatId:'={{ $json.chatId }}',text:'={{ $json.message }}',additionalFields:{appendAttribution:false}}),
 node('Enviar erro de consulta','n8n-nodes-base.telegram',1.2,[1320,-20],{resource:'message',operation:'sendMessage',chatId:'={{ $json.chatId }}',text:'={{ $json.message }}',additionalFields:{appendAttribution:false}}),
 node('Enviar orientação','n8n-nodes-base.telegram',1.2,[660,160],{resource:'message',operation:'sendMessage',chatId:'={{ $json.chatId }}',text:'❌ Cidade não encontrada. Use o formato Cidade,UF,BR (ex.: São Paulo,SP,BR).',additionalFields:{appendAttribution:false}})
];
const edge = name => ({node:name,type:'main',index:0});
const connections = {'Telegram Trigger':{main:[[edge('Normalizar entrada')]]},'Normalizar entrada':{main:[[edge('Entrada válida?')]]},'Entrada válida?':{main:[[edge('Consultar OpenWeather')],[edge('Enviar orientação')]]},'Consultar OpenWeather':{main:[[edge('Interpretar resposta')]]},'Interpretar resposta':{main:[[edge('Resposta válida?')]]},'Resposta válida?':{main:[[edge('Enviar temperatura')],[edge('Enviar erro de consulta')]]}};
// IDs estáveis evitam alterações irrelevantes em cada geração.
for (const n of nodes) {
 n.id = require('crypto').createHash('sha256').update(n.name).digest('hex').slice(0,32);
 if (n.webhookId) n.webhookId = 'clima-telegram-webhook';
 if (n.type === 'n8n-nodes-base.if') n.parameters.conditions.options.version = 1;
 if (n.type === 'n8n-nodes-base.telegram') {
  delete n.parameters.resource;
  delete n.parameters.operation;
 }
}
const workflow = {name:'Bot de clima no Telegram',description:'Autor: Almiro Breno de Moura. Desafio prático de bot de clima no Telegram com n8n.',nodes,connections,settings:{executionOrder:'v1'},active:false};
if (require.main === module) fs.writeFileSync(require('path').join(__dirname,'workflow-chatbot-telegram.json'),JSON.stringify(workflow,null,2)+'\n');
module.exports = workflow;
