import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../tools/raffinato-bridge/catalog_sync.py',import.meta.url),'utf8');

function priceAt(base,iso){
  const instant=new Date(iso);
  const saoPaulo=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const part=type=>saoPaulo.find(item=>item.type===type)?.value;
  const active=['Sat','Sun'].includes(part('weekday'))&&Number(part('hour'))>=5&&Number(part('hour'))<=20;
  return base+(active?1:0);
}

test('consulta do catalogo aplica a variacao vigente por filial, modulo, dia e horario',()=>{
  assert.match(source,/dbo\.PrecoProduto/);
  assert.match(source,/dbo\.VariacaoPrecoProduto/);
  assert.match(source,/V\.IdFilial=\?/);
  assert.match(source,/V\.DataInicial IS NULL OR CONVERT\(date,V\.DataInicial\)<=CONVERT\(date,M\.Agora\)/);
  assert.match(source,/V\.DataFinal IS NULL OR CONVERT\(date,M\.Agora\)<=CONVERT\(date,V\.DataFinal\)/);
  assert.match(source,/V\.IdModuloSistema IS NULL OR V\.IdModuloSistema IN \(3,4\)/);
  assert.match(source,/AND V\.IdSetor IS NULL/);
  assert.match(source,/PP\.Valor\+ISNULL\(VP\.Valor,0\)/);
  assert.match(source,/V\.IdDiaSemana=M\.IdDiaSemana/);
  assert.doesNotMatch(source,/V\.IdDiaDaSemana/);
  assert.match(source,/19000107/); // domingo fixo, independente de DATEFIRST
  assert.match(source,/cur\.execute\(SQL,int\(c\['id_filial'\]\),int\(c\['id_filial'\]\)\)/);
});

test('IDs 1541 e 1528 variam dentro e preservam a base fora da janela de Sao Paulo',()=>{
  const cases=[
    ['2026-11-07T13:00:00Z',11,14], // sabado, 10h
    ['2026-11-08T13:00:00Z',11,14], // domingo, 10h
    ['2026-11-07T00:00:00Z',10,13], // sexta, 21h
    ['2026-11-09T13:00:00Z',10,13], // segunda, 10h
  ];
  for(const [instant,queijo,camarao] of cases){
    assert.equal(priceAt(10,instant),queijo,`1541 em ${instant}`);
    assert.equal(priceAt(13,instant),camarao,`1528 em ${instant}`);
  }
});
