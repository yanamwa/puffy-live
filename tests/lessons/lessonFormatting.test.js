import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
test('lesson formatting renders bold and bullets, removes inline activities, and escapes HTML', async () => {
  const result = await build({entryPoints:['src/components/lesson/LessonContent.jsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'external-react',setup(b){b.onResolve({filter:/^react(\/jsx-runtime)?$/},({path})=>({path:pathToFileURL(require.resolve(path)).href,external:true}));}}]});
  const {default:Content}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  const html=renderToStaticMarkup(Content({content:'* **Socrates: Know Thyself**\nReflect on identity.\n\n**Practice Activity:** Write a paragraph.\n\n<script>alert(1)</script>'}));
  assert.match(html,/<strong>Socrates: Know Thyself<\/strong>/);
  assert.match(html,/<ul><li>/);
  assert.doesNotMatch(html,/Practice Activity|Write a paragraph/);
  assert.doesNotMatch(html,/\*\*|<script>/);
  assert.match(html,/&lt;script&gt;/);
});
