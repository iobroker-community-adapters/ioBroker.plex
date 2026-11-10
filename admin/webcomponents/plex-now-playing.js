import{useState as e,Fragment as t,jsx as n,jsxs as r,createRoot as i}from"../../../lib/esm/react-19.js";var a=`iob-dialog-close`;function o(e){return!!e.form}var s=[`header`,`staticText`,`divider`];function c(e,t){return e==null?``:typeof e==`object`?e[t]||e.en||Object.values(e).find(e=>!!e)||``:String(e)}function l(e){let t={};for(let[n,r]of Object.entries(e.items||{}))r&&!s.includes(r.type)&&(t[n]=r.type);return t}function u(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?e.toString():JSON.stringify(e)}function d(e,t){if(t!=null)switch(e){case`number`:case`slider`:{if(typeof t==`number`)return Number.isFinite(t)?t:void 0;let e=u(t).trim().replace(`,`,`.`);if(!e)return;let n=Number(e);return Number.isFinite(n)?n:void 0}case`checkbox`:return t===!0||t===`true`||t===1||t===`1`;default:return u(t)}}function f(e,t){let n={};for(let[r,i]of Object.entries(e)){let e=d(i,t[r]);e!==void 0&&(n[r]=e)}return n}var p=`"Roboto", "Helvetica", "Arial", sans-serif`,m=Object.freeze({type:`light`,primary:`#3399CC`,primaryContrast:`#FFFFFF`,secondary:`#164477`,secondaryContrast:`#FFFFFF`,background:`#FFFFFF`,paper:`#FFFFFF`,text:`rgba(0, 0, 0, 0.87)`,textSecondary:`rgba(0, 0, 0, 0.6)`,divider:`rgba(0, 0, 0, 0.12)`,error:`#D32F2F`,warning:`#ED6C02`,info:`#0288D1`,success:`#2E7D32`,fontFamily:p,fontSize:14,borderRadius:4}),h=Object.freeze({type:`dark`,primary:`#4DABF5`,primaryContrast:`rgba(0, 0, 0, 0.87)`,secondary:`#436A93`,secondaryContrast:`#FFFFFF`,background:`#121212`,paper:`#121212`,text:`#FFFFFF`,textSecondary:`rgba(255, 255, 255, 0.7)`,divider:`rgba(255, 255, 255, 0.12)`,error:`#F44336`,warning:`#FFA726`,info:`#29B6F6`,success:`#66BB6A`,fontFamily:p,fontSize:14,borderRadius:4}),g=[`primary`,`primaryContrast`,`secondary`,`secondaryContrast`,`background`,`paper`,`text`,`textSecondary`,`divider`,`error`,`warning`,`info`,`success`,`fontFamily`],_=[`fontSize`,`borderRadius`];function v(e){return{...e===`dark`?h:m}}function y(e){if(!e||typeof e!=`object`)return v(typeof e==`string`?e:`light`);let t=e,n=v(typeof t.type==`string`?t.type:`light`);for(let e of g){let r=t[e];typeof r==`string`&&r.trim()&&(n[e]=r.trim())}for(let e of _){let r=t[e],i=typeof r==`string`?parseFloat(r):r;typeof i==`number`&&Number.isFinite(i)&&i>=0&&(n[e]=i)}return n}function b(e,t){return e.type===t.type&&g.every(n=>e[n]===t[n])&&_.every(n=>e[n]===t[n])}function x(e){return`--iob-${e.replace(/[A-Z]/g,e=>`-${e.toLowerCase()}`)}`}function S(e){let t={};for(let n of g)t[x(n)]=e[n];for(let n of _)t[x(n)]=`${e[n]}px`;return t[`color-scheme`]=e.type,t}var C={ok:{en:`OK`,"zh-cn":`确定`},cancel:{en:`Cancel`,de:`Abbrechen`,ru:`Отмена`,pt:`Cancelar`,nl:`Annuleren`,fr:`Annuler`,it:`Annulla`,es:`Cancelar`,pl:`Anuluj`,uk:`Скасувати`,"zh-cn":`取消`},close:{en:`Close`,de:`Schließen`,ru:`Закрыть`,pt:`Fechar`,nl:`Sluiten`,fr:`Fermer`,it:`Chiudi`,es:`Cerrar`,pl:`Zamknij`,uk:`Закрити`,"zh-cn":`关闭`}},ee=`
dialog {
    box-sizing: border-box;
    width: 480px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
    padding: 0;
    border: 0;
    border-radius: calc(var(--iob-border-radius) * 2);
    background: var(--iob-paper);
    color: var(--iob-text);
    font-family: var(--iob-font-family);
    font-size: var(--iob-font-size);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
/* as the dialogs of MUI: a dark paper gets lighter the higher it lies */
dialog.dark { background-image: linear-gradient(rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.16)); }
dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
dialog:focus { outline: none; }
form { display: flex; flex-direction: column; height: 100%; max-height: inherit; margin: 0; }
header { display: flex; align-items: center; gap: 8px; padding: 12px 8px 12px 16px; font-size: 1.15em; font-weight: 500; }
header span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.body { flex: 1; min-height: 0; padding: 0 16px 16px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 16px 16px; }
button { font: inherit; padding: 6px 16px; border-radius: var(--iob-border-radius); border: 1px solid var(--iob-primary); background: transparent; color: var(--iob-primary); cursor: pointer; }
button.primary { background: var(--iob-primary); color: var(--iob-primary-contrast); }
button.close { border: 0; padding: 2px 8px; font-size: 1.4em; line-height: 1; color: var(--iob-text-secondary); }
label { display: flex; flex-direction: column; gap: 4px; }
label.check { flex-direction: row; align-items: center; gap: 8px; }
input, select, textarea { font: inherit; accent-color: var(--iob-primary); }
.help { color: var(--iob-text-secondary); font-size: 0.85em; }
h3 { margin: 4px 0 0; font-size: 1em; }
p { margin: 0; }
hr { width: 100%; border: 0; border-top: 1px solid var(--iob-divider); margin: 0; }
[hidden] { display: none !important; }
`;function w(e){if(!e)return null;try{let t=Function(`data`,`return (${e});`);return e=>{try{return!!t(e)}catch{return!1}}}catch{return null}}function T(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?String(e):``}function E(e){let{input:t,setting:n}=e;if(t)return t instanceof HTMLInputElement&&t.type===`checkbox`?t.checked:t instanceof HTMLSelectElement?n.options?.[t.selectedIndex]?.value:t.value}function te(e,t,n,r,i){let a={name:t,setting:n,box:e.createElement(`div`),hidden:w(n.hidden),disabled:w(n.disabled)},o=c(n.label,i);switch(n.type){case`header`:return a.box=e.createElement(`h3`),a.box.textContent=c(n.text,i)||o,a;case`staticText`:return a.box=e.createElement(`p`),a.box.textContent=c(n.text,i)||o,a;case`divider`:return a.box=e.createElement(`hr`),a}let s=e.createElement(`label`);a.box=s;let l=e.createElement(`span`);if(l.textContent=o||t,n.type===`checkbox`){let t=e.createElement(`input`);t.type=`checkbox`,t.checked=r===!0||r===`true`,s.className=`check`,s.append(t,l),a.input=t}else if(n.type===`select`){let t=e.createElement(`select`);for(let r of n.options||[]){let n=e.createElement(`option`);n.textContent=c(r.label,i),t.append(n)}let o=(n.options||[]).findIndex(e=>String(e.value)===T(r));t.selectedIndex=o===-1?0:o,s.append(l,t),a.input=t}else if(n.type===`text`&&(n.minRows||1)>1){let t=e.createElement(`textarea`);t.rows=n.minRows||2,t.value=T(r),s.append(l,t),a.input=t}else{let t=e.createElement(`input`),i=T(r);switch(n.type){case`number`:case`slider`:t.type=n.type===`slider`?`range`:`number`,n.min!==void 0&&(t.min=String(n.min)),n.max!==void 0&&(t.max=String(n.max)),t.step=n.step===void 0?`any`:String(n.step);break;case`password`:t.type=`password`;break;case`color`:t.type=!i||/^#[0-9a-f]{6}$/i.test(i)?`color`:`text`;break;default:t.type=`text`}if(t.value=i,t.type===`range`){let n=e.createElement(`output`);n.textContent=t.value,t.addEventListener(`input`,()=>n.textContent=t.value),l.append(`: `,n)}s.append(l,t),a.input=t}if(n.help){let t=e.createElement(`span`);t.className=`help`,t.textContent=c(n.help,i),s.append(t)}return a}function D(e,t={}){let n=t.lang||`en`,r=document,i=e=>C[e][n]||C[e].en||e,s=r.createElement(`div`);s.setAttribute(`data-iob-dialog`,``);let u=s.attachShadow({mode:`open`}),d=r.createElement(`style`);d.textContent=ee;let p=r.createElement(`dialog`),m=y(t.theme);p.className=m.type===`dark`?`dark`:``;for(let[e,t]of Object.entries(S(m)))p.style.setProperty(e,t);e.width&&(p.style.width=`${e.width}px`),e.height&&(p.style.height=`${e.height}px`);let h=r.createElement(`form`),g=r.createElement(`header`),_=r.createElement(`span`);_.textContent=c(e.title,n);let v=r.createElement(`button`);v.type=`button`,v.className=`close`,v.title=i(`close`),v.setAttribute(`aria-label`,i(`close`)),v.textContent=`×`,g.append(_,v);let b=r.createElement(`div`);return b.className=`body`,h.append(g,b),p.append(h),u.append(d,p),new Promise(t=>{let d=!1,m=e=>{d||(d=!0,p.open&&p.close(),s.remove(),t(e))};if(v.addEventListener(`click`,()=>m(null)),p.addEventListener(`close`,()=>m(null)),h.addEventListener(`submit`,e=>e.preventDefault()),o(e)){let t={},a=[];for(let[t,i]of Object.entries(e.form.items||{})){let o=e.data?.[t]??i.default,s=te(r,t,i,o,n);a.push(s),b.append(s.box)}let o=()=>{for(let e of a)e.input&&(t[e.name]=E(e));return t},s=()=>{let e=o();for(let t of a)t.box.hidden=t.hidden?t.hidden(e):!1,t.input&&(t.input.disabled=t.disabled?t.disabled(e):!1)};h.addEventListener(`input`,s),h.addEventListener(`change`,s),s();let u=a.find(e=>e.input&&!e.box.hidden&&!e.input.disabled);u?.input&&(u.input.autofocus=!0);let d=r.createElement(`footer`),p=r.createElement(`button`);p.type=`button`,p.textContent=c(e.cancel,n)||i(`cancel`),p.addEventListener(`click`,()=>m(null));let g=r.createElement(`button`);g.type=`submit`,g.className=`primary`,g.textContent=c(e.ok,n)||i(`ok`),d.append(p,g),h.append(d),h.addEventListener(`submit`,()=>m(f(l(e.form),o())))}else b.append(e.element),p.addEventListener(a,e=>m(e.detail??null));r.body.append(s),p.showModal(),u.activeElement&&u.activeElement!==v||(p.tabIndex=-1,p.focus())})}function O(e){return[...new Set(e.filter(e=>typeof e==`string`&&!!e))]}var ne=[`socket`,`dialogs`,`theme`,`editMode`,`settings`,`value`],re=class extends HTMLElement{states={};objects={};#e=null;#t={};#n=y(`light`);#r=!1;#i=null;#a=void 0;#o=null;#s=!1;#c=(e,t)=>{this.#o?.states.includes(e)&&(this.states[e]=t||null,this.#_())};#l=(e,t)=>{this.#o?.objects.includes(e)&&(this.objects[e]=t||null,this.#d())};get socket(){return this.#e}set socket(e){this.#e=e||null,this.#d()}get settings(){return this.#t}set settings(e){this.#t=e||{},this.#d()}get theme(){return this.#n}set theme(e){let t=y(e);b(t,this.#n)||(this.#n=t,this.#u(),this.#_())}get editMode(){return this.#r}set editMode(e){let t=!!e;t!==this.#r&&(this.#r=t,this.#_())}get dialogs(){return this.#i}set dialogs(e){this.#i=e||null}get value(){return this.#a}set value(e){e!==this.#a&&(this.#a=e,this.#_())}connectedCallback(){for(let e of ne)if(Object.prototype.hasOwnProperty.call(this,e)){let t=this[e];delete this[e],this[e]=t}this.#u(),this.#d()}disconnectedCallback(){this.#g()}getStateIds(e){return[]}getObjectIds(e){return[]}get systemLang(){return this.#e?.systemLang||`en`}text(e){return c(e,this.systemLang)}setState(e,t){return this.#e&&!this.#r?this.#e.setState(e,t):Promise.resolve()}changeValue(e){return this.#r||this.emit(`iob-change`,e)?!1:(this.value=e,!0)}emit(e,t){return this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0,cancelable:!0}))}async openDialog(e){if(this.#r)return null;let t=this.#i?await this.#i.open(e):await D(e,{lang:this.systemLang,theme:this.#n});return o(e)?t&&typeof t==`object`?f(l(e.form),t):null:t??null}#u(){for(let[e,t]of Object.entries(S(this.#n)))this.style.setProperty(e,t)}#d(){if(!this.isConnected)return;let e=this.#e,t=e?O(this.getStateIds(this.#t)):[],n=e?O(this.getObjectIds(this.#t)):[];this.#o&&this.#o.socket!==e&&this.#g();let r=this.#o?.states||[],i=this.#o?.objects||[],a=r.filter(e=>!t.includes(e)),o=i.filter(e=>!n.includes(e)),s=t.filter(e=>!r.includes(e)),c=n.filter(e=>!i.includes(e));e&&a.length&&e.unsubscribeState(a,this.#c),e&&o.length&&this.#h(e,o);for(let e of a)delete this.states[e];for(let e of[...a,...o])!t.includes(e)&&!n.includes(e)&&delete this.objects[e];this.#o=e&&(t.length||n.length)?{socket:e,states:t,objects:n}:null,e&&s.length&&this.#p(e,s),e&&c.length&&this.#m(e,c),this.#_()}#f(e,t,n){return this.#o?.socket===e&&this.#o[t].includes(n)}#p(e,t){e.subscribeState(t,this.#c).catch(e=>console.warn(`<${this.localName}>: cannot subscribe ${t.join(`, `)}: ${e}`));for(let n of t)e.getState(n).then(t=>{this.#f(e,`states`,n)&&this.states[n]===void 0&&(this.states[n]=t||null,this.#_())}).catch(()=>{}),e.getObject(n).then(t=>{this.#f(e,`states`,n)&&!this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#_())}).catch(()=>{})}#m(e,t){e.subscribeObject(t,this.#l).catch(e=>console.warn(`<${this.localName}>: cannot subscribe the objects ${t.join(`, `)}: ${e}`));for(let n of t)e.getObject(n).then(t=>{this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#d())}).catch(()=>{})}#h(e,t){e.unsubscribeObject(t,this.#l).catch(()=>{})}#g(){if(this.#o){let{socket:e,states:t,objects:n}=this.#o;t.length&&e.unsubscribeState(t,this.#c),n.length&&this.#h(e,n),this.#o=null}this.states={},this.objects={}}#_(){this.#s||(this.#s=!0,queueMicrotask(()=>{this.#s=!1,this.isConnected&&this.render()}))}};function ie(e,t){let n=typeof e==`string`?e:e.tag;customElements.get(n)||customElements.define(n,t)}var k=`iob-plex-now-playing`;function ae(e){if(!e)return null;let t=e.trim().replace(/^system\.adapter\./,``);return/^\d+$/.test(t)?`plex.${t}`:/^plex\.\d+$/.test(t)?t:null}function A(e){let t=Math.max(0,Math.floor(e||0)),n=Math.floor(t/3600),r=Math.floor(t%3600/60),i=String(t%60).padStart(2,`0`);return n?`${n}:${String(r).padStart(2,`0`)}:${i}`:`${r}:${i}`}var j=/* @__PURE__ */ new Set([`play`,`resume`,`media.play`,`media.resume`]),M=/* @__PURE__ */ new Set([`pause`,`media.pause`]),N=/* @__PURE__ */ new Set([`stop`,`media.stop`]);[...j,...M,...N];var P=null;function oe(e){if(typeof e!=`string`||!e)return[];if(P?.raw===e)return P.events;let t=[];try{let n=JSON.parse(e);Array.isArray(n)&&(t=n.filter(e=>!!e&&typeof e==`object`&&typeof e.event==`string`).sort((e,t)=>(Number(t.timestamp)||0)-(Number(e.timestamp)||0)))}catch{}return P={raw:e,events:t},t}function se(e){let t=/* @__PURE__ */ new Set,n=[];for(let r of e){let e=r.player,i=r.event;if(!e||t.has(e))continue;let a=j.has(i),o=M.has(i);(a||o||N.has(i))&&(t.add(e),(a||o)&&n.push({player:e,account:r.account,media:r.media,message:r.message,caption:r.caption,thumb:r.thumb,season:typeof r.season==`number`?r.season:void 0,episode:typeof r.episode==`number`?r.episode:void 0,paused:o,timestamp:Number(r.timestamp)||0}))}return n}function ce(e,t){let n=``;return typeof e==`number`&&(n+=`S${String(e).padStart(2,`0`)}`),typeof t==`number`&&(n+=`E${String(t).padStart(2,`0`)}`),n}var F={play:`M8 5v14l11-7z`,pause:`M6 19h4V5H6v14zm8-14v14h4V5h-4z`,stop:`M6 6h12v12H6z`,skipNext:`M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z`,skipPrevious:`M6 6h2v12H6zm3.5 6 8.5 6V6z`,replay:`M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z`,star:`M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z`,libraryAdd:`M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z`,bookmark:`M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z`,devices:`M3 6h18V4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V6zm10 6H9v1.78c-.61.55-1 1.33-1 2.22s.39 1.67 1 2.22V20h4v-1.78c.61-.55 1-1.34 1-2.22s-.39-1.67-1-2.22V12zm-2 5.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM22 8h-6c-.5 0-1 .5-1 1v10c0 .5.5 1 1 1h6c.5 0 1-.5 1-1V9c0-.5-.5-1-1-1zm-1 10h-4v-8h4v8z`,storage:`M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z`,warning:`M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z`,update:`M17 1.01 7 1c-1.1 0-1.99.9-1.99 2v18c0 1.1.89 2 1.99 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-1-6h-3V8h-2v5H8l4 4 4-4z`,help:`M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z`,movie:`M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z`,tv:`M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z`,music:`M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z`,person:`M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z`,history:`M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z`,chart:`M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z`};function I({name:e,className:t}){let r=e===`forward`?F.replay:F[e];return/* @__PURE__ */ n(`svg`,{className:t,viewBox:`0 0 24 24`,"aria-hidden":`true`,focusable:`false`,style:e===`forward`?{transform:`scaleX(-1)`}:void 0,children:/* @__PURE__ */ n(`path`,{d:r})})}function le(e){switch(e){case`track`:case`album`:case`artist`:return`music`;case`episode`:case`show`:case`season`:return`tv`;default:return`movie`}}var L={chooseInstance:`Choose an instance of the Plex adapter in the settings`,notInstance:`Not an instance of the Plex adapter`,notPlayer:`Not a player of the Plex adapter`,nothingPlaying:`Nothing is playing`,playing:`Playing`,paused:`Paused`,play:`Play`,pause:`Pause`,stop:`Stop`,previous:`Previous`,next:`Next`,stepBack:`Skip back`,stepForward:`Skip forward`,noEvents:`No events yet`,today:`Today`,yesterday:`Yesterday`,account:`User`,player:`Player`,media:`Type`,source:`Source`,time:`Time`,topUsers:`Top users`,topLibraries:`Top libraries`,noData:`No data`,noStats:`No statistics from Tautulli yet: enable Tautulli and the statistics in the settings of the instance`,period24h:`24 h`,period7d:`7 days`,period30d:`30 days`,periodAll:`All time`,plays:`plays`},R={en:L,de:{chooseInstance:`Instanz des Plex-Adapters in den Einstellungen wählen`,notInstance:`Keine Instanz des Plex-Adapters`,notPlayer:`Kein Player des Plex-Adapters`,nothingPlaying:`Es läuft nichts`,playing:`Läuft`,paused:`Pausiert`,play:`Wiedergabe`,pause:`Pause`,stop:`Stopp`,previous:`Zurück`,next:`Weiter`,stepBack:`Zurückspulen`,stepForward:`Vorspulen`,noEvents:`Noch keine Ereignisse`,today:`Heute`,yesterday:`Gestern`,account:`Benutzer`,player:`Player`,media:`Art`,source:`Quelle`,time:`Zeit`,topUsers:`Top-Benutzer`,topLibraries:`Top-Bibliotheken`,noData:`Keine Daten`,noStats:`Noch keine Statistik von Tautulli: Tautulli und die Statistik in den Einstellungen der Instanz aktivieren`,period24h:`24 Std.`,period7d:`7 Tage`,period30d:`30 Tage`,periodAll:`Gesamt`,plays:`Wiedergaben`},ru:{chooseInstance:`Выберите экземпляр адаптера Plex в настройках`,notInstance:`Это не экземпляр адаптера Plex`,notPlayer:`Это не плеер адаптера Plex`,nothingPlaying:`Ничего не воспроизводится`,playing:`Воспроизводится`,paused:`Пауза`,play:`Воспроизвести`,pause:`Пауза`,stop:`Стоп`,previous:`Предыдущий`,next:`Следующий`,stepBack:`Перемотать назад`,stepForward:`Перемотать вперёд`,noEvents:`Событий пока нет`,today:`Сегодня`,yesterday:`Вчера`,account:`Пользователь`,player:`Плеер`,media:`Тип`,source:`Источник`,time:`Время`,topUsers:`Топ пользователей`,topLibraries:`Топ библиотек`,noData:`Нет данных`,noStats:`Статистики от Tautulli пока нет: включите Tautulli и статистику в настройках экземпляра`,period24h:`24 ч`,period7d:`7 дней`,period30d:`30 дней`,periodAll:`Всё время`,plays:`воспр.`},pt:{chooseInstance:`Escolha uma instância do adaptador Plex nas configurações`,notInstance:`Não é uma instância do adaptador Plex`,notPlayer:`Não é um leitor do adaptador Plex`,nothingPlaying:`Nada a reproduzir`,playing:`A reproduzir`,paused:`Em pausa`,play:`Reproduzir`,pause:`Pausa`,stop:`Parar`,previous:`Anterior`,next:`Seguinte`,stepBack:`Recuar`,stepForward:`Avançar`,noEvents:`Ainda sem eventos`,today:`Hoje`,yesterday:`Ontem`,account:`Utilizador`,player:`Leitor`,media:`Tipo`,source:`Origem`,time:`Hora`,topUsers:`Principais utilizadores`,topLibraries:`Principais bibliotecas`,noData:`Sem dados`,noStats:`Ainda sem estatísticas do Tautulli: ative o Tautulli e as estatísticas nas configurações da instância`,period24h:`24 h`,period7d:`7 dias`,period30d:`30 dias`,periodAll:`Sempre`,plays:`reproduções`},nl:{chooseInstance:`Kies een instantie van de Plex-adapter in de instellingen`,notInstance:`Geen instantie van de Plex-adapter`,notPlayer:`Geen speler van de Plex-adapter`,nothingPlaying:`Er speelt niets`,playing:`Speelt`,paused:`Gepauzeerd`,play:`Afspelen`,pause:`Pauze`,stop:`Stoppen`,previous:`Vorige`,next:`Volgende`,stepBack:`Terugspoelen`,stepForward:`Vooruitspoelen`,noEvents:`Nog geen gebeurtenissen`,today:`Vandaag`,yesterday:`Gisteren`,account:`Gebruiker`,player:`Speler`,media:`Soort`,source:`Bron`,time:`Tijd`,topUsers:`Topgebruikers`,topLibraries:`Topbibliotheken`,noData:`Geen gegevens`,noStats:`Nog geen statistieken van Tautulli: schakel Tautulli en de statistieken in de instellingen van de instantie in`,period24h:`24 u`,period7d:`7 dagen`,period30d:`30 dagen`,periodAll:`Altijd`,plays:`keer afgespeeld`},fr:{chooseInstance:`Choisissez une instance de l'adaptateur Plex dans les paramètres`,notInstance:`Pas une instance de l'adaptateur Plex`,notPlayer:`Pas un lecteur de l'adaptateur Plex`,nothingPlaying:`Aucune lecture en cours`,playing:`En lecture`,paused:`En pause`,play:`Lecture`,pause:`Pause`,stop:`Arrêt`,previous:`Précédent`,next:`Suivant`,stepBack:`Reculer`,stepForward:`Avancer`,noEvents:`Pas encore d'événements`,today:`Aujourd'hui`,yesterday:`Hier`,account:`Utilisateur`,player:`Lecteur`,media:`Type`,source:`Source`,time:`Heure`,topUsers:`Meilleurs utilisateurs`,topLibraries:`Meilleures bibliothèques`,noData:`Aucune donnée`,noStats:`Pas encore de statistiques de Tautulli : activez Tautulli et les statistiques dans les paramètres de l'instance`,period24h:`24 h`,period7d:`7 jours`,period30d:`30 jours`,periodAll:`Toujours`,plays:`lectures`},it:{chooseInstance:`Scegli un'istanza dell'adattatore Plex nelle impostazioni`,notInstance:`Non è un'istanza dell'adattatore Plex`,notPlayer:`Non è un lettore dell'adattatore Plex`,nothingPlaying:`Nessuna riproduzione`,playing:`In riproduzione`,paused:`In pausa`,play:`Riproduci`,pause:`Pausa`,stop:`Stop`,previous:`Precedente`,next:`Successivo`,stepBack:`Indietro`,stepForward:`Avanti`,noEvents:`Ancora nessun evento`,today:`Oggi`,yesterday:`Ieri`,account:`Utente`,player:`Lettore`,media:`Tipo`,source:`Fonte`,time:`Ora`,topUsers:`Utenti principali`,topLibraries:`Librerie principali`,noData:`Nessun dato`,noStats:`Ancora nessuna statistica da Tautulli: attiva Tautulli e le statistiche nelle impostazioni dell'istanza`,period24h:`24 h`,period7d:`7 giorni`,period30d:`30 giorni`,periodAll:`Sempre`,plays:`riproduzioni`},es:{chooseInstance:`Elija una instancia del adaptador Plex en la configuración`,notInstance:`No es una instancia del adaptador Plex`,notPlayer:`No es un reproductor del adaptador Plex`,nothingPlaying:`No se reproduce nada`,playing:`Reproduciendo`,paused:`En pausa`,play:`Reproducir`,pause:`Pausa`,stop:`Detener`,previous:`Anterior`,next:`Siguiente`,stepBack:`Retroceder`,stepForward:`Avanzar`,noEvents:`Aún no hay eventos`,today:`Hoy`,yesterday:`Ayer`,account:`Usuario`,player:`Reproductor`,media:`Tipo`,source:`Origen`,time:`Hora`,topUsers:`Usuarios principales`,topLibraries:`Bibliotecas principales`,noData:`Sin datos`,noStats:`Aún no hay estadísticas de Tautulli: active Tautulli y las estadísticas en la configuración de la instancia`,period24h:`24 h`,period7d:`7 días`,period30d:`30 días`,periodAll:`Siempre`,plays:`reproducciones`},pl:{chooseInstance:`Wybierz instancję adaptera Plex w ustawieniach`,notInstance:`To nie jest instancja adaptera Plex`,notPlayer:`To nie jest odtwarzacz adaptera Plex`,nothingPlaying:`Nic nie jest odtwarzane`,playing:`Odtwarzanie`,paused:`Wstrzymano`,play:`Odtwórz`,pause:`Pauza`,stop:`Zatrzymaj`,previous:`Poprzedni`,next:`Następny`,stepBack:`Przewiń wstecz`,stepForward:`Przewiń do przodu`,noEvents:`Brak zdarzeń`,today:`Dzisiaj`,yesterday:`Wczoraj`,account:`Użytkownik`,player:`Odtwarzacz`,media:`Rodzaj`,source:`Źródło`,time:`Czas`,topUsers:`Najaktywniejsi użytkownicy`,topLibraries:`Najpopularniejsze biblioteki`,noData:`Brak danych`,noStats:`Brak statystyk z Tautulli: włącz Tautulli i statystyki w ustawieniach instancji`,period24h:`24 godz.`,period7d:`7 dni`,period30d:`30 dni`,periodAll:`Cały czas`,plays:`odtworzeń`},uk:{chooseInstance:`Виберіть екземпляр адаптера Plex у налаштуваннях`,notInstance:`Це не екземпляр адаптера Plex`,notPlayer:`Це не плеєр адаптера Plex`,nothingPlaying:`Нічого не відтворюється`,playing:`Відтворюється`,paused:`Пауза`,play:`Відтворити`,pause:`Пауза`,stop:`Стоп`,previous:`Попередній`,next:`Наступний`,stepBack:`Перемотати назад`,stepForward:`Перемотати вперед`,noEvents:`Подій ще немає`,today:`Сьогодні`,yesterday:`Учора`,account:`Користувач`,player:`Плеєр`,media:`Тип`,source:`Джерело`,time:`Час`,topUsers:`Топ користувачів`,topLibraries:`Топ бібліотек`,noData:`Немає даних`,noStats:`Статистики від Tautulli ще немає: увімкніть Tautulli і статистику в налаштуваннях екземпляра`,period24h:`24 год`,period7d:`7 днів`,period30d:`30 днів`,periodAll:`Весь час`,plays:`відтв.`},"zh-cn":{chooseInstance:`请在设置中选择 Plex 适配器实例`,notInstance:`不是 Plex 适配器的实例`,notPlayer:`不是 Plex 适配器的播放器`,nothingPlaying:`当前没有播放`,playing:`正在播放`,paused:`已暂停`,play:`播放`,pause:`暂停`,stop:`停止`,previous:`上一个`,next:`下一个`,stepBack:`快退`,stepForward:`快进`,noEvents:`暂无事件`,today:`今天`,yesterday:`昨天`,account:`用户`,player:`播放器`,media:`类型`,source:`来源`,time:`时间`,topUsers:`热门用户`,topLibraries:`热门媒体库`,noData:`无数据`,noStats:`尚无来自 Tautulli 的统计：请在实例设置中启用 Tautulli 和统计`,period24h:`24 小时`,period7d:`7 天`,period30d:`30 天`,periodAll:`全部`,plays:`次播放`}};function z(e,t){return R[e]?.[t]||L[t]}function B(e){return[...new Set(e.filter(Boolean))].sort().join(`
`)}function V({text:e,icon:t,editMode:i}){return/* @__PURE__ */ r(`div`,{className:`hint${i?` edit`:``}`,children:[/* @__PURE__ */ n(I,{name:t}),/* @__PURE__ */ n(`span`,{children:e})]})}var H=class extends re{#e;#t=``;constructor(e){super();let t=this.attachShadow({mode:`open`}),n=document.createElement(`style`);n.textContent=e;let r=document.createElement(`div`);r.className=`mount`,t.append(n,r),this.#e=i(r)}getStateIds(e){let t=this.getWantedIds(e);return this.#t=B(t),t}render(){this.socket&&B(this.getWantedIds(this.settings))!==this.#t?this.resubscribe():this.#e.render(this.draw())}resubscribe(){let e=this.settings;this.settings=e}word=e=>z(this.systemLang,e)},U=/[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu,W=`_recent-player`;function ue(e){return e.replace(U,`#`).toLowerCase()}function G(e){let t=e?.trim().match(/^(plex\.\d+\._playing\.[^.]+)(\.|$)/);return!t||t[1].endsWith(`.${W}`)||/\._playing\.(players|streams)$/.test(t[1])?null:t[1]}function K(e,t){return e.slice(e.lastIndexOf(`.`)+1).startsWith(`${ue(t)}-`)}function de(e,t){let n=`${e}._playing.`,r=Object.keys(t),i=[];for(let e of r){let a=e.slice(n.length);if(!e.startsWith(n)||!a||a.includes(`.`)||a===W)continue;let o=t[e]?.native||{},s=typeof o.lastSeenAt==`string`&&Date.parse(o.lastSeenAt)||0;i.push({id:e,name:a,lastSeen:s,hasControls:r.includes(`${e}._Controls.playback`)||r.includes(`${e}._Controls`)})}return i}function fe(e,t){let n=e.filter(e=>K(e.id,t));return n.sort((e,t)=>Number(t.hasControls)-Number(e.hasControls)||t.lastSeen-e.lastSeen),n[0]||null}var pe=`
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it */
    container-type: size;
    --pad: clamp(2px, 1.5cqmin, 6px);
    --soft: color-mix(in srgb, currentColor 6%, transparent);
    --track: color-mix(in srgb, currentColor 18%, transparent);
}
.edit {
    pointer-events: none;
}
.hint {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 3cqmin, 8px);
    overflow: hidden;
    text-align: center;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 6cqmin, 15px);
}
.hint svg {
    width: clamp(16px, 14cqmin, 36px);
    height: clamp(16px, 14cqmin, 36px);
    fill: currentColor;
    flex: none;
    opacity: 0.7;
}
.scroll {
    scrollbar-width: thin;
}
button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    margin: 0;
    padding: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
button:disabled {
    cursor: default;
}
button:focus-visible {
    outline: 2px solid var(--iob-primary);
    outline-offset: 1px;
}

.streams {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: var(--pad);
    overflow-x: hidden;
    overflow-y: auto;
    display: grid;
    gap: clamp(4px, 2cqmin, 10px);
    user-select: none;
}
.streams.cards {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    /* one player fills the box; more share it down to a readable height and scroll then */
    grid-auto-rows: minmax(min(calc(100cqh - 2 * var(--pad)), 124px), 1fr);
}
.streams.compact {
    grid-template-columns: 1fr;
    grid-auto-rows: max-content;
    align-content: start;
    font-size: clamp(11px, 4cqi, 15px);
}
.cover {
    --ratio: 2 / 3;
    flex: none;
    aspect-ratio: var(--ratio);
    border-radius: var(--iob-border-radius);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--soft);
    color: var(--iob-text-secondary);
}
.cover.square {
    --ratio: 1;
}
.cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.cover svg {
    width: 50%;
    height: 50%;
    fill: currentColor;
    opacity: 0.6;
}
.info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.heading {
    display: flex;
    align-items: center;
    gap: 0.35em;
    min-width: 0;
    font-weight: 600;
    line-height: 1.25;
}
.heading svg {
    width: 1.1em;
    height: 1.1em;
    flex: none;
    fill: var(--iob-primary);
}
.paused .heading svg {
    fill: var(--iob-text-secondary);
}
.title,
.caption,
.meta,
.sub {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.caption,
.meta,
.sub,
.time {
    color: var(--iob-text-secondary);
}
.meta {
    display: flex;
    align-items: center;
    gap: 0.3em;
}
.meta svg {
    width: 1.1em;
    height: 1.1em;
    flex: none;
    fill: currentColor;
}
.meta span {
    overflow: hidden;
    text-overflow: ellipsis;
}
.meta .gap {
    margin-left: 0.6em;
}
.progress {
    display: flex;
    align-items: center;
    gap: 0.6em;
    min-width: 0;
}
.bar {
    flex: 1;
    min-width: 0;
    border-radius: 999px;
    background: var(--track);
    overflow: hidden;
}
.bar span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--iob-primary);
}
.paused .bar span {
    background: var(--iob-text-secondary);
}
.time {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.controls {
    display: flex;
    align-items: center;
    flex: none;
}
.controls button {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
}
.controls button:hover:not(:disabled) {
    background: var(--soft);
}
.controls button svg {
    width: 62%;
    height: 62%;
    fill: currentColor;
}
.controls button.main {
    background: var(--iob-primary);
    color: var(--iob-primary-contrast);
}
.controls button.main:hover:not(:disabled) {
    background: color-mix(in srgb, var(--iob-primary) 85%, currentColor);
}

/* cards: each card is a container of its own, so its parts follow its size */
.card {
    container-type: size;
    min-width: 0;
    min-height: 0;
    border-radius: calc(var(--iob-border-radius) * 2);
    background: var(--soft);
    overflow: hidden;
}
.card-body {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    gap: clamp(6px, 5cqmin, 16px);
    padding: clamp(6px, 6cqmin, 16px);
}
.card .cover {
    height: 100%;
    max-width: 40cqw;
}
.card .info {
    gap: clamp(2px, 2.5cqh, 8px);
}
.card .heading {
    font-size: clamp(12px, 11cqh, 22px);
}
.card .caption {
    font-size: clamp(10px, 8.5cqh, 16px);
}
.card .meta {
    font-size: clamp(10px, 8cqh, 14px);
}
.card .progress {
    font-size: clamp(9px, 7.5cqh, 13px);
}
.card .bar {
    height: clamp(3px, 2.5cqh, 6px);
}
.card .controls {
    gap: clamp(0px, 1.5cqw, 10px);
    margin-top: clamp(0px, 1.5cqh, 6px);
}
.card .controls button {
    width: clamp(24px, 19cqh, 44px);
    height: clamp(24px, 19cqh, 44px);
}
@container (max-height: 118px) {
    .card .caption {
        display: none;
    }
}
@container (max-height: 92px) {
    .card .meta {
        display: none;
    }
}
@container (max-width: 300px) {
    .card .controls .step {
        display: none;
    }
}
@container (max-width: 210px) {
    .card .cover {
        display: none;
    }
}

/* compact: one row per player, the progress as a line below it */
.row {
    position: relative;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.6em;
    padding: 0.4em 0.5em 0.55em;
    border-radius: var(--iob-border-radius);
    background: var(--soft);
}
.row .cover {
    height: 2.6em;
}
.row .heading {
    font-size: 1em;
}
.row .sub {
    font-size: 0.8em;
}
.row .controls {
    gap: 0.15em;
}
.row .controls button {
    width: 2em;
    height: 2em;
}
.row .line {
    position: absolute;
    left: 0.5em;
    right: 0.5em;
    bottom: 0.2em;
    height: 2px;
}
@container (max-width: 220px) {
    .row .cover {
        display: none;
    }
}
`,me=5e3,he=3e5;function q({thumb:t,media:r}){let[i,a]=e(``);return/* @__PURE__ */ n(`div`,{className:`cover${r===`track`||r===`album`||r===`artist`?` square`:``}`,children:t&&i!==t?/* @__PURE__ */ n(`img`,{src:t,alt:``,referrerPolicy:`no-referrer`,onError:()=>a(t)}):/* @__PURE__ */ n(I,{name:le(r)})})}function J({entry:e,withTimes:t}){let{elapsed:i,duration:a}=e;if(i===null&&a===null)return null;let o=a?Math.min(100,Math.max(0,(i||0)/a*100)):0,s=a?/* @__PURE__ */ n(`div`,{className:t?`bar`:`bar line`,children:/* @__PURE__ */ n(`span`,{style:{width:`${o}%`}})}):null;if(!t)return s;let c=a?`${A(i||0)} / ${A(a)}`:A(i||0);return/* @__PURE__ */ r(`div`,{className:`progress`,children:[s,/* @__PURE__ */ n(`span`,{className:`time`,children:c})]})}function Y({icon:e,label:t,className:r,disabled:i,onClick:a}){return/* @__PURE__ */ n(`button`,{type:`button`,className:r,title:t,"aria-label":t,disabled:i,onClick:a,children:/* @__PURE__ */ n(I,{name:e})})}function X({entry:e,full:i,editMode:a,word:o,onCommand:s}){let c=e.channel;if(!e.controllable||!c)return null;let l=e=>()=>s(c,e),u=e.stream.paused;return/* @__PURE__ */ r(`div`,{className:`controls`,children:[i?/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ n(Y,{icon:`skipPrevious`,label:o(`previous`),className:`step`,disabled:a,onClick:l(`skipPrevious`)}),/* @__PURE__ */ n(Y,{icon:`replay`,label:o(`stepBack`),className:`step`,disabled:a,onClick:l(`stepBack`)})]}):null,/* @__PURE__ */ n(Y,{icon:u?`play`:`pause`,label:o(u?`play`:`pause`),className:`main`,disabled:a,onClick:l(u?`play`:`pause`)}),i?/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ n(Y,{icon:`forward`,label:o(`stepForward`),className:`step`,disabled:a,onClick:l(`stepForward`)}),/* @__PURE__ */ n(Y,{icon:`skipNext`,label:o(`next`),className:`step`,disabled:a,onClick:l(`skipNext`)})]}):null,/* @__PURE__ */ n(Y,{icon:`stop`,label:o(`stop`),disabled:a,onClick:l(`stop`)})]})}function Z(e){return e.message||ce(e.season,e.episode)||e.media||e.player}function ge(e){let{entry:i,showCover:a,word:o}=e,{stream:s}=i,c=Z(s),l=o(s.paused?`paused`:`playing`);return/* @__PURE__ */ n(`div`,{className:`card${s.paused?` paused`:``}`,children:/* @__PURE__ */ r(`div`,{className:`card-body`,children:[a?/* @__PURE__ */ n(q,{thumb:s.thumb,media:s.media}):null,/* @__PURE__ */ r(`div`,{className:`info`,children:[/* @__PURE__ */ r(`div`,{className:`heading`,title:`${l}: ${c}`,children:[/* @__PURE__ */ n(I,{name:s.paused?`pause`:`play`}),/* @__PURE__ */ n(`span`,{className:`title`,children:c})]}),s.caption?/* @__PURE__ */ n(`div`,{className:`caption`,title:s.caption,children:s.caption}):null,/* @__PURE__ */ r(`div`,{className:`meta`,children:[/* @__PURE__ */ n(I,{name:`tv`}),/* @__PURE__ */ n(`span`,{children:s.player}),s.account?/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ n(I,{name:`person`,className:`gap`}),/* @__PURE__ */ n(`span`,{children:s.account})]}):null]}),/* @__PURE__ */ n(J,{entry:i,withTimes:!0}),/* @__PURE__ */ n(X,{entry:i,full:!0,editMode:e.editMode,word:o,onCommand:e.onCommand})]})]})})}function _e(e){let{entry:t,showCover:i,word:a}=e,{stream:o}=t,s=Z(o),c=a(o.paused?`paused`:`playing`),l=[o.player,o.account].filter(Boolean);return t.elapsed!==null&&l.push(t.duration?`${A(t.elapsed)} / ${A(t.duration)}`:A(t.elapsed)),/* @__PURE__ */ r(`div`,{className:`row${o.paused?` paused`:``}`,children:[i?/* @__PURE__ */ n(q,{thumb:o.thumb,media:o.media}):null,/* @__PURE__ */ r(`div`,{className:`info`,children:[/* @__PURE__ */ r(`div`,{className:`heading`,title:`${c}: ${s}`,children:[/* @__PURE__ */ n(I,{name:o.paused?`pause`:`play`}),/* @__PURE__ */ n(`span`,{className:`title`,children:s})]}),/* @__PURE__ */ n(`div`,{className:`sub`,title:o.caption||void 0,children:l.join(` · `)})]}),/* @__PURE__ */ n(X,{entry:t,full:!1,editMode:e.editMode,word:e.word,onCommand:e.onCommand}),/* @__PURE__ */ n(J,{entry:t,withTimes:!1})]})}function ve(e){let{entries:t,compact:r,editMode:i,word:a}=e;return t.length?/* @__PURE__ */ n(`div`,{className:`streams scroll ${r?`compact`:`cards`}${i?` edit`:``}`,children:t.map(t=>n(r?_e:ge,{...e,entry:t},t.stream.player))}):/* @__PURE__ */ n(V,{text:a(`nothingPlaying`),icon:`movie`,editMode:i})}function Q(e){let t=Number(e?.val);return e&&e.val!==null&&e.val!==``&&Number.isFinite(t)?t:null}function $(e){let t=ae(e.instance);if(t||e.instance)return t;let n=G(e.player);return n?n.split(`.`).slice(0,2).join(`.`):null}ie(k,class extends H{#e=null;#t=``;#n=null;#r=0;#i=``;#a=null;constructor(){super(pe)}disconnectedCallback(){super.disconnectedCallback(),this.#a&&=(clearTimeout(this.#a),null)}#o(e,t){let n=e.player?G(e.player):null,r=se(oe(this.states[`${t}.events.history`]?.val));return e.showPaused===!1&&(r=r.filter(e=>!e.paused)),n?r.filter(e=>K(n,e.player)).map(e=>({stream:e,channel:n})):r.map(e=>({stream:e,channel:fe(this.#s(t)||[],e.player)?.id||null}))}#s(e){return e===this.#t&&this.socket===this.#n?this.#e:null}getWantedIds(e){let t=$(e);if(!t)return[];let n=[`${t}.events.history`];for(let{channel:r}of this.#o(e,t))r&&(n.push(`${r}.Metadata.viewOffset`,`${r}.Metadata.durationSeconds`),e.showControls!==!1&&n.push(`${r}.Player.controllable`,`${r}._Controls.playback.play`));return n}#c(e,t){let n=this.socket;if(!n)return;let r=e===this.#t&&n===this.#n,i=t.join(`
`);if(r){if(!i)return;let e=(i===this.#i?he:me)-(Date.now()-this.#r);if(e>0){this.#a||=setTimeout(()=>{this.#a=null,this.isConnected&&this.resubscribe()},e);return}}else this.#e=null;this.#t=e,this.#n=n,this.#r=Date.now(),this.#i=i;let a=`${e}._playing.`;n.getObjectViewSystem(`channel`,a,`${a}香`).then(t=>de(e,t)).catch(t=>(console.warn(`<${this.localName}>: cannot read the players of ${e}: ${String(t)}`),[])).then(t=>{e===this.#t&&n===this.#n&&(this.#e=t,this.resubscribe())}).catch(()=>void 0)}draw(){let e=this.settings,t=$(e);if(!t)return/* @__PURE__ */ n(V,{text:this.word(e.instance?`notInstance`:`chooseInstance`),icon:`movie`,editMode:this.editMode});let r=e.player?G(e.player):null;if(e.player&&(!r||!r.startsWith(`${t}.`)))return/* @__PURE__ */ n(V,{text:this.word(`notPlayer`),icon:`tv`,editMode:this.editMode});if(this.states[`${t}.events.history`]===void 0)return/* @__PURE__ */ n(`div`,{className:`streams`});let i=this.#o(e,t);!r&&i.length&&this.#c(t,i.filter(({channel:e})=>!e).map(({stream:e})=>e.player));let a=i.map(({stream:t,channel:n})=>{let r=n?Q(this.states[`${n}.Metadata.viewOffset`]):null,i=n?Q(this.states[`${n}.Metadata.durationSeconds`]):null,a=n?this.objects[`${n}._Controls.playback.play`]:null,o=e.showControls!==!1&&!!a&&this.states[`${n}.Player.controllable`]?.val!==!1;return{stream:t,channel:n,elapsed:r!==null&&r>0?Math.floor(r/1e3):null,duration:i!==null&&i>0?i:null,controllable:o}});return/* @__PURE__ */ n(ve,{entries:a,compact:e.layout===`compact`,showCover:e.showCover!==!1,editMode:this.editMode,word:this.word,onCommand:(e,t)=>void this.setState(`${e}._Controls.playback.${t}`,!0)})}});