import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

async function load(name){
 const source=readFileSync(new URL(`../frontend/src/${name}.ts`,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const {progressSummary,stageState,elapsedSeconds,clockLabel}=await load('progress');
const base={id:'test',status:'running',stage:'season_researcher',stages:['destination_researcher','season_researcher'],provider:'ollama',stage_states:{destination_researcher:'running',season_researcher:'running',itinerary_planner:'pending',trip_reviewer:'pending',validation:'pending'}};
assert.equal(progressSummary(base).completed,0,'Starting a stage does not complete it');
assert.equal(progressSummary(base).active.length,2,'Parallel workers both remain visible');
assert.match(progressSummary(base).headline,/places.*season/);
const failed={...base,status:'failed',stage_states:{...base.stage_states,destination_researcher:'completed',season_researcher:'failed'}};
assert.equal(progressSummary(failed).completed,1,'A failure must not fill the bar');
assert.equal(progressSummary(failed).busy,false,'Failure stops rolling animation');
assert.equal(progressSummary(failed).failed[0].id,'season_researcher');
assert.equal(stageState({...base,stage_states:undefined},'destination_researcher'),'pending','Legacy runs do not invent completion states');
assert.equal(elapsedSeconds({...base,started_at:'2026-10-24T10:00:00Z',finished_at:'2026-10-24T10:02:05Z'},Date.now()),125,'Finished elapsed time does not keep increasing');
assert.equal(clockLabel(125),'2:05');
assert.equal(elapsedSeconds(base,Date.now()),null,'Old runs without timestamps do not show a fabricated clock');
const {popupPosition,project}=await load('mapGeometry');
for(const [width,height,x,y] of [[900,480,880,450],[320,300,310,280],[1400,900,5,5]]){
 const p=popupPosition(width,height,x,y);
 assert.ok(p.left>=0&&p.left+p.width<=width,'Pop-out fits horizontally');
 assert.ok(p.top>=0&&p.top+p.maxHeight<=height,'Pop-out fits vertically');
}
assert.deepEqual(project(0,0),[500,235]);
console.log('UI logic checks passed: real stage progress, terminal states, elapsed time, popup edges, and map projection.');
