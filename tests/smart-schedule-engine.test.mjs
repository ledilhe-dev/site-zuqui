import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateSchedule,validateSchedule,compareScenarios,minutes,clock} from '../assets/js/smart-schedule-engine.mjs';

const employees=count=>Array.from({length:count},(_,i)=>({id:`e${i}`,name:`Pessoa ${i}`,sector:'Atendimento',secondarySectors:i%3===0?['Caixa']:[],salary:2000+i*10,burdenRate:.3,monthlyHours:220,weekdays:[0,1,2,3,4,5,6],maxDailyHours:10,enabled:true,support:i%7===0}));
const scenario=(team=4,minimum=1,journey='5x2',slot=60)=>({name:'Teste',start:'2026-10-26',end:'2026-11-01',open:'08:00',close:'18:00',slot,minimum,sector:'Atendimento',journey,includeSupport:true,employees:employees(team),demand:{},restHours:11,maxDailyHours:10,breakAfterMinutes:360,breakMinutes:60});

test('matriz parametrizada cobre 216 cenarios operacionais relevantes',()=>{
  let executed=0;
  for(const team of [1,2,4,8,16,40])for(const minimum of [1,2,3])for(const journey of ['5x2','6x1','custom'])for(const slot of [15,30,60,120]){
    const input=scenario(team,minimum,journey,slot),result=generateSchedule(input);executed++;
    assert.ok(Array.isArray(result.schedule));assert.ok(Array.isArray(result.coverage));assert.ok(Array.isArray(result.issues));
    assert.equal(result.summary.mandatoryViolations,result.issues.filter(x=>x.mandatory).length);
    assert.ok(result.schedule.every(x=>x.start<x.end&&x.date>='2026-10-26'&&x.date<='2026-11-01'));
    const repeated=generateSchedule(structuredClone(input));assert.deepEqual(result.schedule,repeated.schedule,'resultado deve ser reproduzivel');
  }
  assert.equal(executed,216);
});

test('demanda de pico aumenta cobertura sem duplicar pessoa simultaneamente',()=>{const input=scenario(6,1);input.demand={'1:600':4};const result=generateSchedule(input),slot=result.coverage.find(x=>x.date==='2026-10-26'&&x.start===600);assert.equal(slot.required,4);assert.equal(new Set(result.schedule.filter(x=>x.date==='2026-10-26'&&x.start<=600&&x.end>600).map(x=>x.employeeId)).size,slot.available)});
test('equipe insuficiente produz furo e recomendacao parcial explicita',()=>{const result=generateSchedule(scenario(1,3));assert.ok(result.summary.uncovered>0);assert.ok(result.recommendations.some(x=>x.complete===false&&x.remaining>0))});
test('apoio desabilitado nao entra automaticamente',()=>{const input=scenario(2,2);input.includeSupport=false;const result=generateSchedule(input);assert.ok(result.schedule.every(x=>x.employeeId!=='e0'))});
test('funcionario de setor secundario cobre sem contagem dupla',()=>{const input=scenario(4,2);input.sector='Caixa';const result=generateSchedule(input);assert.ok(result.schedule.every(x=>['e0','e3'].includes(x.employeeId)));for(const c of result.coverage)assert.ok(c.available<=2)});
test('indisponibilidade e respeitada',()=>{const input=scenario(2,1);input.employees[0].unavailable=[{date:'2026-10-26',start:480,end:1080}];const result=generateSchedule(input);assert.ok(result.schedule.filter(x=>x.date==='2026-10-26').every(x=>x.employeeId!=='e0'))});
test('mudanca de mes e ano preserva todas as datas',()=>{const input=scenario(3,1);input.start='2026-12-30';input.end='2027-01-02';const result=generateSchedule(input);assert.deepEqual([...new Set(result.coverage.map(x=>x.date))],['2026-12-30','2026-12-31','2027-01-01','2027-01-02'])});
test('comparacao usa apenas resultados calculados',()=>{const a=generateSchedule(scenario(3,1)),b=generateSchedule(scenario(5,2));const rows=compareScenarios([{id:'a',name:'A',result:a},{id:'b',name:'B',result:b}]);assert.equal(rows.length,2);assert.equal(rows[0].cost,a.summary.cost)});
test('validacao detecta descanso insuficiente',()=>{const input=scenario(1,1),schedule=[{employeeId:'e0',date:'2026-10-26',start:900,end:1380,breaks:[]},{employeeId:'e0',date:'2026-10-27',start:360,end:600,breaks:[]}],result=validateSchedule(schedule,{...input,open:'15:00',close:'23:00'});assert.ok(result.issues.some(x=>x.type==='rest'))});
test('conversores de horario sao estaveis',()=>{assert.equal(minutes('14:30'),870);assert.equal(clock(870),'14:30')});

test('integracao preserva agenda oficial e usa tabela exclusiva',()=>{const ui=fs.readFileSync(new URL('../assets/js/98-smart-schedule.js',import.meta.url),'utf8'),migration=fs.readFileSync(new URL('../supabase/migrations/202610310001_gerador_inteligente_escalas.sql',import.meta.url),'utf8');assert.doesNotMatch(ui,/from\(['"]agenda['"]\)/);assert.match(ui,/from\('escala_simulacoes'\)/);assert.match(migration,/enable row level security/);assert.match(migration,/empresa_id[\s\S]*loja_id/)});
test('analise reutiliza Raffinato e nao inventa faturamento',()=>{const ui=fs.readFileSync(new URL('../assets/js/98-smart-schedule.js',import.meta.url),'utf8');assert.match(ui,/raffinatoBridgePost\('\/api\/raffinato\/vendas-gerencial'/);assert.match(ui,/mapa_calor/);assert.doesNotMatch(ui,/Math\.random/)});
test('conector preserva horario operacional delivery no mapa',()=>{const bridge=fs.readFileSync(new URL('../tools/raffinato-bridge/raffinato_bridge.py',import.meta.url),'utf8');assert.match(bridge,/COALESCE\(TE\.Hora,D\.Hora\)/);assert.match(bridge,/SELECT dia_semana,hora,COUNT\(\*\)/)});
