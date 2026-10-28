import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const frontend=fs.readFileSync(new URL('../assets/js/36-raffinato-sales-analysis.js',import.meta.url),'utf8');
const relay=fs.readFileSync(new URL('../supabase/functions/raffinato-relay/index.ts',import.meta.url),'utf8');

test('filtros exibem datas lado a lado antes dos horarios',()=>{
  const section=html.slice(html.indexOf('id="relatorio_vendas_raffinato"'),html.indexOf('id="relatorio_vendas_diarias"'));
  const positions=['rsStart','rsEnd','rsStartTime','rsEndTime'].map(id=>section.indexOf(`id="${id}"`));
  assert.ok(positions.every(position=>position>=0));
  assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
});

test('consulta envia intervalo diario completo ao relay',()=>{
  assert.match(frontend,/hora_inicio:`\$\{horaInicio\}:00`/);
  assert.match(frontend,/hora_fim:`\$\{horaFim\}:59`/);
  assert.match(relay,/reportDailyHours\(body,start,end\)/);
  assert.match(relay,/matchesDailyPeriod\(x,start,end,dailyStart,dailyEnd\)/);
});

test('relay inclui somente vendas dentro do horario informado em cada dia',()=>{
  const functionLines=['normalizeTime','reportDailyHours','matchesDailyPeriod'].map(name=>{
    const line=relay.match(new RegExp(`^function ${name}\\b.*$`,'m'))?.[0];
    assert.ok(line,`funcao ${name} nao encontrada`);
    return line;
  });
  const executable=functionLines.join('\n')
    .replace(/\(value:any,fallback:string\)/,'(value,fallback)')
    .replace(/\(body:any,start:string,end:string\)/,'(body,start,end)')
    .replace(/\(item:any,start:string,end:string,startTime\?:string,endTime\?:string\)/,'(item,start,end,startTime,endTime)');
  const sandbox={};
  vm.runInNewContext(`${executable};globalThis.matchPeriod=matchesDailyPeriod;globalThis.dailyHours=reportDailyHours`,sandbox);
  const [from,to]=sandbox.dailyHours({hora_inicio:'19:00:00',hora_fim:'20:00:59'},'2026-10-01T00:00:00','2026-10-29T00:00:00');
  assert.equal(sandbox.matchPeriod({data:'2026-10-22',hora:'18:59:59'},'2026-10-01T00:00:00','2026-10-29T00:00:00',from,to),false);
  assert.equal(sandbox.matchPeriod({data:'2026-10-22',hora:'19:00:00'},'2026-10-01T00:00:00','2026-10-29T00:00:00',from,to),true);
  assert.equal(sandbox.matchPeriod({data:'2026-10-22',hora:'20:00:30'},'2026-10-01T00:00:00','2026-10-29T00:00:00',from,to),true);
  assert.equal(sandbox.matchPeriod({data:'2026-10-22',hora:'20:01:00'},'2026-10-01T00:00:00','2026-10-29T00:00:00',from,to),false);
});
