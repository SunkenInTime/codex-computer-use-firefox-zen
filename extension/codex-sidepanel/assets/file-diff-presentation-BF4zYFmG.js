const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./dist-B3ryYHFc.js","./dist-S7B8VW39.js","./dist-Bjc3V1vn.js","./dist-BlcGoL-f.js","./dist-CovfaPSU.js","./dist-BffDxUqy.js","./dist-CGMOUTnX.js"])))=>i.map(i=>d[i]);
import{o as e,t}from"./rolldown-runtime-DAXXjFlN.js";import{t as n}from"./react-BUD3sqOU.js";import{t as r}from"./compiler-runtime-KOEWgTh7.js";import{n as i,t as a}from"./identity-B6_hpF2c.js";import{t as o}from"./preload-helper-HclGiUj8.js";import{d as s,i as c,t as l}from"./app-scope-_o3s1Ui4.js";import{t as u}from"./jsx-runtime-CFwixLRt.js";import{T as d,p as f}from"./parsePatchFiles-CBadaO3X.js";import{lt as p,n as m,nn as h,r as g}from"./VirtualizedFileDiff-CZNBOxsk.js";import{c as _}from"./statsig-BdYFwS32.js";function v({hunkIndex:e,lineIndex:t,conflictIndex:n}){return`merge-conflict-action-${e}-${t}-${n}`}function y(e,t){let n=t.hunks[e.hunkIndex];if(n!=null)return{hunkIndex:e.hunkIndex,lineIndex:b(n,e.startContentIndex)}}function b(e,t){let n=e.unifiedLineStart;for(let r=0;r<t;r++){let t=e.hunkContent[r];n+=t.type===`context`?t.lines:t.deletions+t.additions}return n}var x=u(),S=e(n(),1);function C(e){let t=(0,S.useRef)(e);return(0,S.useInsertionEffect)(()=>void(t.current=e)),(0,S.useCallback)((...e)=>t.current(...e),[])}var w=(0,S.createContext)(void 0);function T({children:e,createEditor:t}){let n=(0,S.useRef)(new WeakMap),r=C(e=>{let r=n.current.get(e);if(r!=null)return r;let i=t(e);return n.current.set(e,i),i});return(0,x.jsx)(w.Provider,{value:r,children:e})}function E(){return(0,S.useContext)(w)}var D={position:`absolute`,top:0,bottom:0,textAlign:`center`,whiteSpace:`normal`,touchAction:`none`},O={display:`contents`};function k(){return null}function A({fileDiff:e,actions:t,renderCustomHeader:n,renderHeaderPrefix:r,renderHeaderFilenameSuffix:i,renderHeaderMetadata:a,renderAnnotation:o,renderGutterUtility:s,renderMergeConflictUtility:c,lineAnnotations:l,getHoveredLine:u,getInstance:d}){let m=n?.(e),h=r?.(e),g=i?.(e),_=a?.(e);return(0,x.jsxs)(x.Fragment,{children:[m==null?(0,x.jsxs)(x.Fragment,{children:[h!=null&&(0,x.jsx)(`div`,{slot:`header-prefix`,children:h}),g!=null&&(0,x.jsx)(`div`,{slot:`header-filename-suffix`,children:g}),_!=null&&(0,x.jsx)(`div`,{slot:`header-metadata`,children:_})]}):(0,x.jsx)(`div`,{slot:f,children:m}),o!=null&&l?.map((e,t)=>(0,x.jsx)(`div`,{slot:p(e),children:o(e)},t)),t!=null&&c!=null&&d!=null&&t.map(t=>{if(t==null)return;let n=j(t,e);return(0,x.jsx)(`div`,{slot:n,style:O,children:c(t,d)},n)}),s!=null&&(0,x.jsx)(`div`,{slot:`gutter-utility-slot`,style:D,children:s(u)})]})}function j(e,t){let n=y(e,t);return n==null?void 0:v({hunkIndex:n.hunkIndex,lineIndex:n.lineIndex,conflictIndex:e.conflictIndex})}var M=(0,S.createContext)(void 0);function N(){return(0,S.useContext)(M)}function P(e,t){return typeof window>`u`&&t!=null?(0,x.jsxs)(x.Fragment,{children:[(0,x.jsx)(`template`,{shadowrootmode:`open`,dangerouslySetInnerHTML:{__html:t}}),e]}):(0,x.jsx)(x.Fragment,{children:e})}var F=(0,S.createContext)(void 0);function I(){return(0,S.useContext)(F)}var L=typeof window>`u`?S.useEffect:S.useLayoutEffect;function R({fileDiff:e,options:t,editorOptions:n,lineAnnotations:r,selectedLines:i,prerenderedHTML:a,metrics:o,hasGutterRenderUtility:s,hasCustomHeader:c,disableWorkerPool:l,edit:u}){let d=I(),f=i!==void 0,p=(0,S.useContext)(M),_=E(),v=(0,S.useRef)(null),y=C(n=>{if(n!=null){if(v.current!=null)throw Error(`useFileDiffInstance: An instance should not already exist when a node is created`);d==null?v.current=new g(z({controlledSelection:f,hasCustomHeader:c,hasGutterRenderUtility:s,options:t}),l?void 0:p,!0):v.current=new m(z({controlledSelection:f,hasCustomHeader:c,hasGutterRenderUtility:s,options:t}),d,o,l?void 0:p,!0),v.current.hydrate({fileDiff:e,fileContainer:n,lineAnnotations:r,prerenderedHTML:a})}else{if(v.current==null)throw Error(`useFileDiffInstance: A FileDiff instance should exist when unmounting`);v.current.cleanUp(),v.current=null}});return L(()=>{let{current:n}=v;if(n==null)return;let a=z({controlledSelection:f,hasCustomHeader:c,hasGutterRenderUtility:s,options:t}),o=a!==void 0&&!h(n.options,a);n.setOptions(a),n.render({forceRender:o,fileDiff:e,lineAnnotations:r}),i!==void 0&&n.setSelectedLines(i)}),L(()=>{if(u&&v.current!=null){if(_===void 0)throw Error(`FileDiff: EditContext is not attached`);let e=_(n??{});if(e==null)throw Error(`FileDiff: EditProvider.createEditor must return an editor instance`);try{return e.edit(v.current)}catch(t){throw e.cleanUp(),t}}},[u]),{ref:y,getHoveredLine:(0,S.useCallback)(()=>v.current?.getHoveredLine(),[])}}function z({options:e,controlledSelection:t,hasCustomHeader:n,hasGutterRenderUtility:r}){return t||r||n?{...e,controlledSelection:t,renderCustomHeader:n?k:e?.renderCustomHeader,renderGutterUtility:r?k:e?.renderGutterUtility}:e}function B({fileDiff:e,options:t,editorOptions:n,metrics:r,lineAnnotations:i,selectedLines:a,className:o,style:s,prerenderedHTML:c,renderAnnotation:l,renderCustomHeader:u,renderHeaderPrefix:f,renderHeaderFilenameSuffix:p,renderHeaderMetadata:m,renderGutterUtility:h,disableWorkerPool:g=!1,edit:_=!1}){let{ref:v,getHoveredLine:y}=R({fileDiff:e,options:t,editorOptions:n,metrics:r,lineAnnotations:i,selectedLines:a,prerenderedHTML:c,hasGutterRenderUtility:h!=null,hasCustomHeader:u!=null,disableWorkerPool:g,edit:_});return(0,x.jsx)(d,{ref:v,className:o,style:s,children:P(A({fileDiff:e,renderCustomHeader:u,renderHeaderPrefix:f,renderHeaderFilenameSuffix:p,renderHeaderMetadata:m,renderAnnotation:l,renderGutterUtility:h,lineAnnotations:i,getHoveredLine:y}),c)})}var V=r(),H=`var(--color-surface)`,U=`var(--color-codex-diff-surface)`,W=`
  --codex-diffs-surface: ${H};
  --codex-diffs-context-surface: color-mix(
  in srgb,
  var(--codex-diffs-surface) 94%,
  var(--color-surface)
);
  --codex-diffs-separator-surface: color-mix(
  in srgb,
  var(--codex-diffs-surface) 94%,
  var(--color-text-info)
);
  --codex-diffs-hover-surface: color-mix(
  in srgb,
  var(--codex-diffs-surface) 92%,
  var(--color-surface)
);
  --codex-diffs-header-surface: var(--codex-diffs-surface);
  --codex-diffs-context-number: color-mix(
  in lab,
  var(--codex-diffs-surface) 98.5%,
  var(--diffs-mixer)
);
  --codex-diffs-addition-number: light-dark(
  color-mix(in lab, var(--diffs-light-bg, #fff) 91%, var(--diffs-addition-base)),
  color-mix(in lab, var(--diffs-dark-bg, #000) 85%, var(--diffs-addition-base))
);
  --codex-diffs-deletion-number: light-dark(
  color-mix(in lab, var(--diffs-light-bg, #fff) 91%, var(--diffs-deletion-base)),
  color-mix(in lab, var(--diffs-dark-bg, #000) 85%, var(--diffs-deletion-base))
);
  --codex-diffs-addition-hover: light-dark(
  color-mix(
    in lab,
    var(--diffs-light-bg, #fff) 80%,
    var(--diffs-addition-base)
  ),
  color-mix(
    in lab,
    var(--diffs-dark-bg, #000) 70%,
    var(--diffs-addition-base)
  )
);
  --codex-diffs-deletion-hover: light-dark(
  color-mix(
    in lab,
    var(--diffs-light-bg, #fff) 80%,
    var(--diffs-deletion-base)
  ),
  color-mix(
    in lab,
    var(--diffs-dark-bg, #000) 75%,
    var(--diffs-deletion-base)
  )
);
  /* Keep unhighlighted lines readable while syntax tokens are pending. */
  --diffs-dark: var(--color-text);
  --diffs-light: var(--color-text);
  --diffs-bg-context-override: var(--codex-diffs-context-surface);
  --diffs-bg-separator-override: var(--codex-diffs-separator-surface);
  --diffs-bg-hover-override: var(--codex-diffs-hover-surface);
`;function G({alignCommentGutter:e=!1,includeDiffHeader:t,includeSimpleLineSeparators:n,rootSelector:r,surface:i,useReviewLineInfoSeparators:a=!1}){let o=t?`[data-diffs-header],
  ${r}`:r,s=n?`
  :host(.composer-diff-simple-line) [data-separator]:empty {
    background-color: transparent;
  }

  :host(.composer-diff-simple-line) [data-separator]:empty::after {
    content: "";
    grid-column: 2 / 3;
    align-self: center;
    margin-inline: 1ch;
    border-top: 1px solid color-mix(in srgb, var(--diffs-fg) 18%, transparent);
  }
`:``,c=e?`
  ${r} [data-column-number] {
    padding-inline-start: calc(var(--spacing) * 10);
  }
`:``,l=a?`
  ${r} [data-separator='line-info'] [data-expand-button] {
    border-inline-end: 1px solid var(--diffs-bg);
    border-start-start-radius: 8px;
    border-end-start-radius: 8px;
  }

  ${r} [data-separator='line-info'] [data-separator-wrapper][data-separator-multi-button] [data-expand-up] {
    border-end-start-radius: 0;
  }

  ${r} [data-separator='line-info'] [data-separator-wrapper][data-separator-multi-button] [data-expand-down] {
    border-start-start-radius: 0;
  }

  ${r} [data-unified] [data-separator='line-info'] [data-separator-content] {
    border-start-end-radius: 8px;
    border-end-end-radius: 8px;
  }

  ${r} [data-unified] [data-separator='line-info'] [data-separator-wrapper] {
    grid-template-columns: var(--diffs-column-number-width) minmax(0, 1fr);
    padding-inline: 2px;
  }

  /* Pierre duplicates split separators into each gutter and content cell. */
  ${r} [data-deletions] [data-gutter] [data-separator='line-info'] [data-separator-wrapper] {
    background-color: var(--diffs-bg-separator);
    border-start-start-radius: 8px;
    border-end-start-radius: 8px;
    grid-template-columns: minmax(0, 1fr);
    padding-inline: 2px 0;
  }

  ${r} [data-deletions] [data-gutter] [data-separator='line-info'] [data-separator-content],
  ${r} [data-deletions] [data-content] [data-separator='line-info'] [data-expand-button] {
    display: none;
  }

  ${r} [data-deletions] [data-content] [data-separator='line-info'] [data-separator-wrapper] {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    padding: 0;
  }

  ${r} [data-deletions] [data-content] [data-separator='line-info'] [data-separator-content] {
    grid-column: 1;
  }

  ${r} [data-additions] [data-gutter] [data-separator='line-info'],
  ${r} [data-additions] [data-gutter] [data-separator='line-info'] [data-separator-wrapper] {
    background-color: var(--diffs-bg-separator);
  }

  ${r} [data-additions] [data-gutter] [data-separator='line-info'] [data-separator-wrapper] {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
    padding: 0;
  }

  ${r} [data-additions] [data-content] [data-separator='line-info'] [data-separator-wrapper] {
    border-start-end-radius: 8px;
    border-end-end-radius: 8px;
  }
`:``;return`
  ${o} {
    ${W}
    --diffs-bg: ${i} !important;
    background-color: ${i} !important;
  }

  ${r} [data-language-symbol-highlight] {
    background-color: var(--color-background-primary-ghost-hover) !important;
  }

  ${r} [data-utility-button] {
    background-color: var(--color-text);
    color: var(--color-surface-secondary);
    border: none;
    border-radius: 4px;
    margin-right: 0;
  }

  ${r} [data-utility-button]:hover {
    background-color: color-mix(
      in srgb,
      var(--color-text) 88%,
      var(--color-surface-secondary)
    );
  }

  ${r} [data-selected-line][data-line-annotation] {
    background-color: var(--diffs-bg);
  }

  [data-placeholder][data-loading] {
    --codex-diffs-placeholder-base: color-mix(
      in srgb,
      var(--color-codex-description) 10%,
      transparent
    );
    --codex-diffs-placeholder-highlight: color-mix(
      in srgb,
      var(--color-codex-description) 16%,
      transparent
    );
    position: relative;
    overflow: hidden;
    background-image: linear-gradient(
      to right,
      var(--codex-diffs-placeholder-base) 0 82%,
      transparent 82%
    );
    background-position: 12px 8px;
    background-size: calc(100% - 24px) 22px;
    background-repeat: repeat-y;
  }

  [data-placeholder][data-loading]::before {
    content: "";
    position: absolute;
    inset: 8px 12px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--codex-diffs-placeholder-highlight) 50%,
      transparent 100%
    );
    transform: translateX(-100%);
    animation: codex-diffs-placeholder-shimmer 3000ms linear infinite;
    mask-image: repeating-linear-gradient(
      to bottom,
      #000 0 14px,
      transparent 14px 22px
    );
  }

  @media (prefers-reduced-motion: reduce) {
    [data-placeholder][data-loading]::before {
      animation: none;
    }
  }

  @keyframes codex-diffs-placeholder-shimmer {
    to {
      transform: translateX(100%);
    }
  }

${`
  /* Preserve the pre-beta split-column width instead of reserving a scrollbar gutter in every pane. */
  ${r} [data-code] {
    scrollbar-gutter: auto;
  }

  ${r} [data-line-type='change-addition']:is([data-line], [data-no-newline]) {
    --diffs-computed-diff-line-bg: var(--diffs-bg-addition);
  }

  ${r} [data-line-type='change-addition']:is([data-column-number], [data-gutter-buffer]) {
    --diffs-computed-diff-line-bg: var(--codex-diffs-addition-number);
  }

  ${r} [data-line-type='change-deletion']:is([data-line], [data-no-newline]) {
    --diffs-computed-diff-line-bg: var(--diffs-bg-deletion);
  }

  ${r} [data-line-type='change-deletion']:is([data-column-number], [data-gutter-buffer]) {
    --diffs-computed-diff-line-bg: var(--codex-diffs-deletion-number);
  }

  ${r} [data-line-type='change-addition'][data-hovered]:not([data-selected-line]) {
    --diffs-computed-hovered-line-bg: var(--codex-diffs-addition-hover);
  }

  ${r} [data-line-type='change-deletion'][data-hovered]:not([data-selected-line]) {
    --diffs-computed-hovered-line-bg: var(--codex-diffs-deletion-hover);
  }
`}

  ${r}[data-diff-type="split"] [data-line-type="change-deletion"][data-column-number]::before {
    background-color: var(--diffs-deletion-base);
    background-image: none;
  }

  /* Cover fractional-pixel gaps between consecutive solid change markers. */
  ${r} [data-line-type="change-addition"][data-column-number]
    + [data-line-type="change-addition"][data-column-number]::before,
  ${r}[data-diff-type="split"] [data-line-type="change-deletion"][data-column-number]
    + [data-line-type="change-deletion"][data-column-number]::before {
    contain: none;
    top: -1px;
    height: calc(100% + 1px);
  }

${l}

${c}

${s}`}function K(e,t){return e?t===`diff`?U:H:`var(--color-surface-secondary)`}var q=t(((e,t)=>{var n=i(),r=4294967294,a=Math.floor,o=Math.min;function s(e,t,i,s){var c=0,l=e==null?0:e.length;if(l===0)return 0;t=i(t);for(var u=t!==t,d=t===null,f=n(t),p=t===void 0;c<l;){var m=a((c+l)/2),h=i(e[m]),g=h!==void 0,_=h===null,v=h===h,y=n(h);if(u)var b=s||v;else b=p?v&&(s||g):d?v&&g&&(s||!_):f?v&&g&&!_&&(s||!y):_||y?!1:s?h<=t:h<t;b?c=m+1:l=m}return o(l,r)}t.exports=s})),J=t(((e,t)=>{var n=q(),r=a(),o=i(),s=2147483647;function c(e,t,i){var a=0,c=e==null?a:e.length;if(typeof t==`number`&&t===t&&c<=s){for(;a<c;){var l=a+c>>>1,u=e[l];u!==null&&!o(u)&&(i?u<=t:u<t)?a=l+1:c=l}return c}return n(e,t,r,i)}t.exports=c})),Y=t(((e,t)=>{var n=J();function r(e,t){return n(e,t)}t.exports=r})),ee=t(((e,t)=>{var n=J();function r(e,t){return n(e,t,!0)}t.exports=r})),te=e(Y(),1),X=e(ee(),1),ne=1e6,re=8,Z=new Set([`Body`,`Block`,`ClassBody`,`EnumBody`,`ConstructorBody`,`InterfaceBody`,`AnnotationTypeBody`,`ModuleBody`,`DeclarationList`,`FieldDeclarationList`,`OrderedFieldDeclarationList`,`EnumVariantList`,`MatchBlock`,`FieldInitializerList`,`StructBody`,`SwitchBlock`,`SelectBlock`,`LiteralValue`]),ie=new Set([`ObjectExpression`,`ArrayExpression`,`ArrayInitializer`,`TypeLiteral`,`DictionaryExpression`,`SetExpression`,`TupleExpression`,`ArrowFunction`,`ParenthesizedExpression`,`JSXElement`]);function ae(e,t){if(t==null)return e;let n=Q(e,`additions`,t),r=Q(e,`deletions`,t);if(n.size===0&&r.size===0)return e;let i=[],a=0,o=0,s=0,c=0;for(let t=0;t<=e.hunks.length;t+=1){let l=e.hunks[t],u=l?.collapsedBefore??e.additionLines.length-a,d=0;for(let t=0;t<u;t+=1){if(!n.has(a+t)&&!r.has(o+t))continue;let l=t;for(;t+1<u&&(n.has(a+t+1)||r.has(o+t+1));)t+=1;let f=t-l+1,p=a+l,m=o+l;i.push({collapsedBefore:l-d,additionStart:p+1,deletionStart:m+1,additionLineIndex:p,deletionLineIndex:m,additionCount:f,deletionCount:f,additionLines:0,deletionLines:0,hunkContent:[{type:`context`,lines:f,additionLineIndex:p,deletionLineIndex:m}],splitLineStart:s+l,unifiedLineStart:c+l,splitLineCount:f,unifiedLineCount:f,noEOFCRAdditions:p+f===e.additionLines.length&&!e.additionLines.at(-1)?.endsWith(`
`),noEOFCRDeletions:m+f===e.deletionLines.length&&!e.deletionLines.at(-1)?.endsWith(`
`)}),d=t+1}l!=null&&(i.push(d===0?l:{...l,collapsedBefore:u-d}),a=l.additionLineIndex+l.additionCount,o=l.deletionLineIndex+l.deletionCount,s=l.splitLineStart+l.splitLineCount,c=l.unifiedLineStart+l.unifiedLineCount)}return i.length===e.hunks.length?e:{...e,hunks:i,cacheKey:`${e.cacheKey??e.name}:structural-context`}}function Q(e,t,n){let r=t===`additions`?e.additionLines:e.deletionLines,i=new Set,a=[0];for(let e of r)a.push(a[a.length-1]+e.length);if(a[a.length-1]>ne)return i;let o=[],s=[];for(let n of e.hunks)for(let e of n.hunkContent){if(e.type!==`change`||e[t]===0)continue;let n=t===`additions`?e.additionLineIndex:e.deletionLineIndex;o.push(a[n]),s.push(a[n+e[t]])}return o.length===0||n.parse(r.join(``)).iterate({enter({node:e}){let t=(0,te.default)(s,e.from+1);if(t===s.length||o[t]>=e.to)return!1;if(!Z.has(e.name)&&!ie.has(e.name))return;let n=e.name===`ArrowFunction`?e.getChild(`Arrow`):e.firstChild,r=e.lastChild;if(n==null||r==null||n.type.isError||r.type.isError)return;let c=e.from;if(Z.has(e.name)){let t=e.parent;c=t!=null&&!Z.has(t.name)?t.from:e.from;for(let t=e.prevSibling;t!=null;t=t.prevSibling)if(t.name===`Body`||t.name===`Block`){c=t.nextSibling?.from??e.from;break}}let l=(0,X.default)(a,c)-1,u=(0,X.default)(a,n.to-1)-1;if(l!==(0,X.default)(a,e.to-1)-1){i.add(l);for(let e=Math.max(l+1,u-re+2);e<=u;e+=1)i.add(e);if([`}`,`]`,`)`,`JSXCloseTag`].includes(r.name)){let e=(0,X.default)(a,r.from)-1,t=(0,X.default)(a,r.to-1)-1;for(let n=e;n<=t;n+=1)i.add(n)}}}}),i}function oe(e){let t=e.hunks.at(-1);if(!(e.isPartial||t==null||e.type===`new`||e.type===`deleted`||t.additionLineIndex+t.additionCount===e.additionLines.length&&e.hunks.every(e=>e.collapsedBefore===0)))switch(e.name.split(`.`).at(-1)?.toLowerCase()){case`ts`:case`mts`:case`cts`:return`typescript`;case`tsx`:return`tsx`;case`js`:case`jsx`:case`mjs`:case`cjs`:return`javascript`;case`py`:case`pyi`:return`python`;case`rs`:return`rust`;case`go`:return`go`;case`java`:return`java`;case void 0:default:return}}async function se(e){switch(e){case`javascript`:case`typescript`:case`tsx`:{let{parser:t}=await o(async()=>{let{parser:e}=await import(`./dist-B3ryYHFc.js`);return{parser:e}},__vite__mapDeps([0,1,2]),import.meta.url);return t.configure({dialect:{typescript:`ts`,tsx:`ts jsx`,javascript:`jsx`}[e]})}case`python`:return(await o(async()=>{let{parser:e}=await import(`./dist-BlcGoL-f.js`);return{parser:e}},__vite__mapDeps([3,2]),import.meta.url)).parser;case`rust`:return(await o(async()=>{let{parser:e}=await import(`./dist-CovfaPSU.js`);return{parser:e}},__vite__mapDeps([4,2]),import.meta.url)).parser;case`go`:return(await o(async()=>{let{parser:e}=await import(`./dist-BffDxUqy.js`);return{parser:e}},__vite__mapDeps([5,2]),import.meta.url)).parser;case`java`:return(await o(async()=>{let{parser:e}=await import(`./dist-CGMOUTnX.js`);return{parser:e}},__vite__mapDeps([6,2]),import.meta.url)).parser}}var ce=`:is([data-diff], [data-file])`,le=s(l,e=>({queryKey:[`diff-context-parser`,e],queryFn:()=>se(e),staleTime:1/0}));function ue(e){let t=(0,V.c)(7),n;t[0]!==e.expandUnchanged||t[1]!==e.fileDiff||t[2]!==e.hunkSeparators?(n=(e.hunkSeparators??`line-info`)===`line-info`&&!e.expandUnchanged?oe(e.fileDiff):void 0,t[0]=e.expandUnchanged,t[1]=e.fileDiff,t[2]=e.hunkSeparators,t[3]=n):n=t[3];let r=n,i;return t[4]!==r||t[5]!==e?(i=r==null?(0,x.jsx)($,{...e}):(0,x.jsx)(de,{...e,language:r}),t[4]=r,t[5]=e,t[6]=i):i=t[6],i}function de(e){let t=(0,V.c)(6),{language:n,...r}=e,i=_(`1894478438`),a;t[0]===i?a=t[1]:(a={enabled:i},t[0]=i,t[1]=a);let{data:o}=c(le,n,a),s=i?ae(r.fileDiff,o):r.fileDiff,l=s===r.fileDiff?void 0:3,u;return t[2]!==s||t[3]!==r||t[4]!==l?(u=(0,x.jsx)($,{...r,fileDiff:s,collapsedContextThreshold:l}),t[2]=s,t[3]=r,t[4]=l,t[5]=u):u=t[5],u}function $(e){let t=(0,V.c)(49),n,r,i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y,b;t[0]===e?(n=t[1],r=t[2],i=t[3],a=t[4],o=t[5],s=t[6],c=t[7],l=t[8],u=t[9],d=t[10],f=t[11],p=t[12],m=t[13],h=t[14],g=t[15],_=t[16],v=t[17],y=t[18],b=t[19]):({alignCommentGutter:m,className:n,fileDiff:i,diffIndicators:h,hunkSeparators:g,lineAnnotations:a,lineDiffType:o,metrics:s,onGutterUtilityClick:c,onPostRender:l,onPostRenderInstance:u,renderAnnotation:d,selectedLines:p,overflow:_,theme:b,themeType:v,useReviewLineInfoSeparators:y,collapsedContextThreshold:r,...f}=e,t[0]=e,t[1]=n,t[2]=r,t[3]=i,t[4]=a,t[5]=o,t[6]=s,t[7]=c,t[8]=l,t[9]=u,t[10]=d,t[11]=f,t[12]=p,t[13]=m,t[14]=h,t[15]=g,t[16]=_,t[17]=v,t[18]=y,t[19]=b);let S=m!==void 0&&m,C=h===void 0?`bars`:h,w=g===void 0?`line-info`:g,T=_===void 0?`scroll`:_,E=v===void 0?`system`:v,D=y!==void 0&&y,O=c!=null,k;t[20]!==l||t[21]!==u?(k=(e,t,n)=>{u?.(e,t,n);let r=e.shadowRoot?.querySelectorAll(`[data-placeholder]`);if(n===`unmount`){r?.length===0&&e.shadowRoot?.replaceChildren();return}r!=null&&r.length>1&&e.shadowRoot?.replaceChildren(r.item(r.length-1)),l?.(e)},t[20]=l,t[21]=u,t[22]=k):k=t[22];let A;t[23]!==S||t[24]!==D?(A=G({alignCommentGutter:S,includeDiffHeader:!0,includeSimpleLineSeparators:!0,rootSelector:ce,surface:`var(--codex-diffs-surface)`,useReviewLineInfoSeparators:D}),t[23]=S,t[24]=D,t[25]=A):A=t[25];let j;t[26]!==r||t[27]!==C||t[28]!==w||t[29]!==o||t[30]!==c||t[31]!==T||t[32]!==f||t[33]!==O||t[34]!==k||t[35]!==A||t[36]!==b||t[37]!==E?(j={overflow:T,hunkSeparators:w,collapsedContextThreshold:r,themeType:E,theme:b,disableFileHeader:!0,diffIndicators:C,enableGutterUtility:O,lineDiffType:o,onGutterUtilityClick:c,onPostRender:k,unsafeCSS:A,...f},t[26]=r,t[27]=C,t[28]=w,t[29]=o,t[30]=c,t[31]=T,t[32]=f,t[33]=O,t[34]=k,t[35]=A,t[36]=b,t[37]=E,t[38]=j):j=t[38];let M;t[39]!==i||t[40]!==a||t[41]!==s||t[42]!==d||t[43]!==p||t[44]!==j?(M=(0,x.jsx)(B,{fileDiff:i,lineAnnotations:a,metrics:s,renderAnnotation:d,selectedLines:p,options:j}),t[39]=i,t[40]=a,t[41]=s,t[42]=d,t[43]=p,t[44]=j,t[45]=M):M=t[45];let N;return t[46]!==n||t[47]!==M?(N=(0,x.jsx)(`div`,{className:n,children:M}),t[46]=n,t[47]=M,t[48]=N):N=t[48],N}export{I as a,N as c,k as d,T as f,F as i,A as l,C as m,K as n,P as o,E as p,G as r,M as s,ue as t,D as u};