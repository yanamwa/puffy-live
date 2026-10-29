import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result=await build({entryPoints:['src/services/modulePracticeGeneration.js'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':'{}'}});
const {generateModulePractice}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
test('module practice uses generated lessons and source IDs, preserves existing questions, and contains failures',async()=>{
  const oldLocal=globalThis.localStorage,oldSession=globalThis.sessionStorage;
  globalThis.localStorage=globalThis.sessionStorage={getItem:()=>null};
  try {
    const args={courseId:12,moduleId:'draft-key',title:'Identity',objectives:'Understand self',pages:[{title:'Self',content:'**Practice Activity:** Reflect on identity.',source_document_ids:[7],source_document_id:7}]};
    let payload;
    const generated=await generateModulePractice(args,async(url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({success:true,quiz:{questions:[{question:'What is identity?'}]}})};});
    assert.equal(generated.questions.length,1);assert.equal(payload.assessment_type,'practice');assert.equal(payload.question_count,5);assert.deepEqual(payload.document_ids,[7]);assert.equal(payload.lesson_id,null);assert.match(payload.lesson_content,/Practice Activity/);assert.match(payload.prompt,/never grade personal opinions/);
    const existing=[{question:'Saved question'}];
    const preserved=await generateModulePractice({...args,existing},()=>{throw Error('must not call')});
    assert.equal(preserved.questions,existing);assert.equal(preserved.keptExisting,true);
    const failed=await generateModulePractice(args,async()=>{throw Error('Service unavailable')});
    assert.deepEqual(failed.questions,[]);assert.equal(failed.error,'Service unavailable');
  } finally {globalThis.localStorage=oldLocal;globalThis.sessionStorage=oldSession;}
});
