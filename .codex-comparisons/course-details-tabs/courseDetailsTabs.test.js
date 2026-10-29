import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
test("course detail tabs isolate content and coverage preview returns to syllabi", async () => {
  const h = {slots: [], cursor: 0};
  globalThis.__detailsTest = h;
  try {
    const result = await build({entryPoints:["src/pages/admin/modules/CourseManagementPage.jsx"], define:{"import.meta.env":"{}"},bundle:true,write:false,format:"esm",platform:"node",jsx:"automatic",loader:{".css":"empty"},plugins:[{name:"mocks",setup(b){
      b.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:pathToFileURL(require.resolve("react/jsx-runtime")).href,external:true}));
      b.onResolve({filter:/.*/},({path:p})=>{
        if(p === "react")return {path:"react",namespace:"mock"};
        if(p.endsWith("CatalogModal.jsx"))return {path:"modal",namespace:"mock"};
      });
      b.onLoad({filter:/.*/,namespace:"mock"},({path:p})=>({loader:"js",contents:p === "react" ? `export default {}; export function useState(v){const h=globalThis.__detailsTest,i=h.cursor++;if(!(i in h.slots))h.slots[i]=v;return [h.slots[i],v=>h.slots[i]=v];} export const useEffect=()=>{}; export const useCallback=v=>v; export const useContext=()=>({}); export const createContext=()=>({}); export const useRef=()=>({}); export const useMemo=f=>f();` : `export const CatalogModal=({children})=>children;export const PdfPreview=()=>null;`}));
    }}]});
    const {CatalogDetails}=await import("data:text/javascript;base64,"+Buffer.from(result.outputFiles[0].text).toString("base64"));
    const tree=()=>{h.cursor=0;return CatalogDetails({id:1,onClose(){},onClass(){},onPdf(){}});};
    tree();
    h.slots[2]={course:{code:"GNED 08",title:"Understanding the Self",status:"active",programs:["BSIT"]},versions:[{version_id:4,filename:"syllabus.pdf",coverage_modules:[{title:"Module one",lesson_pages:[{title:"Lesson one",content:"Lesson body"}]}]}]};
    h.slots[3]={records:[{course_id:1,professor:"Instructor Puffy",status:"published"}],total:1};
    const find=(node,label)=>Array.isArray(node)?node.map(n=>find(n,label)).find(Boolean):node?.type === "button" && node.props.children===label?node:node?.props?find(node.props.children,label):undefined;
    let html=renderToStaticMarkup(tree());
    assert.match(html,/Instructor Puffy/);assert.doesNotMatch(html,/syllabus.pdf|Professor Assignment History|Previous/);
    find(tree(),"Professor History").props.onClick();html=renderToStaticMarkup(tree());
    assert.match(html,/Professor Assignment History/);assert.match(html,/Date unavailable/);assert.match(html,/Section not specified/);
    find(tree(),"Syllabi").props.onClick();html=renderToStaticMarkup(tree());
    assert.match(html,/syllabus.pdf/);assert.doesNotMatch(html,/Lesson body|Instructor Puffy/);
    find(tree(),"View Coverage").props.onClick();html=renderToStaticMarkup(tree());
    assert.match(html,/Module one/);assert.match(html,/Lesson body/);
    find(tree(),"Back to Syllabi").props.onClick();html=renderToStaticMarkup(tree());
    assert.match(html,/syllabus.pdf/);assert.doesNotMatch(html,/Lesson body/);
  } finally {delete globalThis.__detailsTest;}
});
