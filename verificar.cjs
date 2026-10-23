const assert = require('assert');
const fs = require('fs');
const workflow = JSON.parse(fs.readFileSync('workflow-chatbot-telegram.json','utf8'));
const get = name => { const n = workflow.nodes.find(x => x.name === name); assert(n, name); return n; };
const run = (code, json, normalizado) => new Function('$json', '$', code)(json, () => ({first: () => ({json: normalizado})}))[0].json;
const normalizar = msg => run(get('Normalizar entrada').parameters.jsCode, {message:msg});
const input = normalizar({text:'  São Paulo, SP, BR  ',chat:{id:123}});
assert.equal(input.queue,'sao paulo,sp,br'); assert.equal(input.chatId,123); assert.equal(input.displayCity,'São Paulo');
assert.equal(normalizar({chat:{id:1}}).valid,false);
assert.equal(normalizar({text:'/start',chat:{id:1}}).valid,false);
const parse = json => run(get('Interpretar resposta').parameters.jsCode,json,input);
assert.match(parse({statusCode:200,body:{main:{temp:24.6}}}).message,/25°C/);
assert.match(parse({statusCode:404,body:{cod:'404'}}).message,/Cidade não encontrada/);
assert.match(parse({statusCode:401,body:{cod:401}}).message,/não foi possível/i);
assert.equal(parse({statusCode:200,body:{main:{temp:null}}}).ok,false);
const http = get('Consultar OpenWeather').parameters;
const query = Object.fromEntries(http.queryParameters.parameters.map(x=>[x.name,x.value]));
assert.equal(query.q,'={{ $json.queue }}'); assert.equal(query.units,'metric'); assert.equal(query.lang,'pt_br'); assert.equal(query.appid,'={{ $env.OPENWEATHER_API_KEY }}');
for (const connections of Object.values(workflow.connections)) for (const branch of connections.main) for (const edge of branch) get(edge.node);
assert(fs.existsSync('README.md')); assert(fs.existsSync('.gitignore'));
console.log('Verificações estruturais e testes locais de lógica passaram. Este comando não executa integrações reais; consulte VALIDACAO.md.');
assert.deepStrictEqual(workflow, require('./gerar-workflow.cjs'), 'JSON deve corresponder ao gerador');
for (const [cidade, queue] of [['São Paulo,SP,BR','sao paulo,sp,br'],['Rio de Janeiro,RJ,BR','rio de janeiro,rj,br'],['Belo Horizonte,MG,BR','belo horizonte,mg,br'],['São Paulo','sao paulo,br'],['São Paulo,SP','sao paulo,sp,br']]) {
 const data = normalizar({text:cidade,chat:{id:-456}});
 assert.equal(data.queue,queue); assert.equal(data.valid,true); assert.equal(data.chatId,-456);
}
for (const text of ['', ' ', ',SP,BR', 'São Paulo,,BR', 'São Paulo,SP,US', '123', 'São Paulo,SP,BR,extra', '/start']) assert.equal(normalizar({text,chat:{id:1}}).valid,false,text);
assert.equal(normalizar({text:'São Paulo'}).valid,false);
for (const body of [{main:{temp:0}}, {cod:'200',main:{temp:-3.7}}]) assert.equal(parse(body).ok,true);
for (const body of [{error:'timeout'}, {statusCode:500,body:{main:{temp:25}}}, {cod:401,main:{temp:25}}, {main:{temp:'25'}}, {main:{temp:NaN}}, {main:{temp:Infinity}}, {}]) assert.equal(parse(body).ok,false);
assert.equal(parse({cod:'404'}).ok,false);
for (const n of workflow.nodes.filter(n=>n.type==='n8n-nodes-base.telegram')) {
 assert.equal(n.parameters.chatId,'={{ $json.chatId }}'); assert(!n.credentials);
}
assert.equal(http.options.response.response.neverError,true);
assert.equal(get('Consultar OpenWeather').onError,'continueRegularOutput');
const serialized = JSON.stringify(workflow);
assert(!/\d{8,12}:[A-Za-z0-9_-]{30,}/.test(serialized),'Token Telegram encontrado');
assert(!/\b[a-f0-9]{32}\b/i.test(serialized.replace(/"id":"[a-f0-9]+"/g,'')),'Possível chave literal');
console.log('Casos adicionais: 3 cidades (simulados), formatos inválidos, falhas HTTP/rede, zero/negativos, chat dinâmico e ausência de tokens: OK.');
