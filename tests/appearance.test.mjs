import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {translator,localeValue,themeValue} from '../lib/i18n/core.ts';
import {formatDose,formatMoment} from '../lib/medications/schedule.ts';
import {amountLabel,units} from '../lib/stock/types.ts';

test('preferences reject unsupported values and preserve original Russian text',()=>{
  assert.equal(localeValue('en'),'en');assert.equal(localeValue('<script>'),'ru');
  assert.equal(themeValue('dark'),'dark');assert.equal(themeValue(null),'system');
  assert.equal(translator('ru')('  Главная  '),'  Главная  ');
  assert.equal(translator('en')('  Главная  '),'  Home  ');
  assert.equal(translator('en')('Барсик'),'Барсик');
  assert.match(translator('en')('Слишком длинное поле: максимум 100 символов.'),/100 characters/);
});
test('localized quantities preserve stored units and custom dose units',()=>{
  assert.equal(amountLabel(1.5,'кг','en-US'),'1.5 kg');
  assert.equal(amountLabel(1.5,'кг'),'1,5 кг');
  assert.equal(formatDose(0.5,'мл','en-US'),'0.5 ml');
  assert.equal(formatDose(1,'custom scoop','en-US'),'1 custom scoop');
  assert.equal(formatDose(null,null,'en-US'),'Dose not specified');
  assert.match(formatMoment('2026-09-09T08:00:00Z','Europe/Moscow','en-US'),/Sep/);
  assert.deepEqual(units,['г','кг','мл','л','шт','табл','упак']);
});
test('all literal UI translation keys have English entries; translated option labels retain stable values',()=>{
  const en=JSON.parse(readFileSync(new URL('../lib/i18n/en.json',import.meta.url),'utf8'));
  const root=new URL('../app/',import.meta.url),missing=[],unsafeOptions=[];
  for(const file of readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.tsx'))){
    const ast=ts.createSourceFile(file,readFileSync(new URL(file,root),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(n){
      if(ts.isCallExpression(n)&&n.expression.getText(ast)==='t'&&n.arguments.length===1&&ts.isStringLiteral(n.arguments[0])){
        const key=n.arguments[0].text.trim();if(!Object.hasOwn(en,key))missing.push(`${file}: ${key}`);
      }
      if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(ast)==='option'&&n.children.some(c=>c.getText(ast).includes('t('))&&!n.openingElement.attributes.properties.some(a=>a.name?.getText(ast)==='value'))unsafeOptions.push(file);
      ts.forEachChild(n,visit);
    }visit(ast);
  }
  assert.deepEqual(missing,[]);assert.deepEqual(unsafeOptions,[]);
});
test('small card descriptions and muted text meet 4.5:1 contrast in both palettes',()=>{
  const css=readFileSync(new URL('../app/appearance.css',import.meta.url),'utf8');
  const palettes=[...css.matchAll(/(?:^:root|:root\[data-theme="dark"\])\{([^}]+)\}/gm)].map(m=>Object.fromEntries([...m[1].matchAll(/--c-([a-f0-9]+):#([a-f0-9]+);/g)].map(v=>[v[1],v[2]]))).filter(p=>p['858078']);
  function luminance(hex){
    if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');
    return hex.match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  }
  assert.equal(palettes.length,2);
  for(const palette of palettes)for(const [fg,bg]of [['858078','f7f4ee'],...['f2ded8','e9e2ed','eee5d3','dfe9eb','dfe9dd','e7e5df'].map(bg=>['746f68',bg])]){
    const [low,high]=[luminance(palette[fg]),luminance(palette[bg])].sort((a,b)=>a-b);
    assert.ok((high+0.05)/(low+0.05)>=4.5,`${fg} on ${bg}`);
  }
});
test('new section accents keep small text readable in light and dark mode',()=>{
 const css=readFileSync(new URL('../app/appearance.css',import.meta.url),'utf8');
 const blocks=[...css.matchAll(/(?:^:root|:root\[data-theme="dark"\])\{([^}]+)\}/gm)].map(m=>Object.fromEntries([...m[1].matchAll(/--([\w-]+):#([a-f0-9]+);/g)].map(v=>[v[1],v[2]])));
 const light={...blocks[0],...blocks[2]},dark={...blocks[1],...blocks[3]};
 const lum=h=>h.match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 for(const palette of [light,dark])for(const name of ['rose','lilac','sand','blue','peach','gray'])for(const fg of ['c-858078',`icon-${name}`]){
  const pair=[lum(palette[fg]),lum(palette[`section-${name}`])].sort((a,b)=>a-b);assert.ok((pair[1]+.05)/(pair[0]+.05)>=4.5,`${fg} on ${name}`);
 }
});
