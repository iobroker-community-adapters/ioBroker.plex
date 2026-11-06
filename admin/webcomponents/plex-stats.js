import{jsx as e,jsxs as t,createRoot as n}from"../../../lib/esm/react-19.js";var r=`iob-dialog-close`;function i(e){return!!e.form}var a=[`header`,`staticText`,`divider`];function o(e,t){return e==null?``:typeof e==`object`?e[t]||e.en||Object.values(e).find(e=>!!e)||``:String(e)}function s(e){let t={};for(let[n,r]of Object.entries(e.items||{}))r&&!a.includes(r.type)&&(t[n]=r.type);return t}function c(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?e.toString():JSON.stringify(e)}function l(e,t){if(t!=null)switch(e){case`number`:case`slider`:{if(typeof t==`number`)return Number.isFinite(t)?t:void 0;let e=c(t).trim().replace(`,`,`.`);if(!e)return;let n=Number(e);return Number.isFinite(n)?n:void 0}case`checkbox`:return t===!0||t===`true`||t===1||t===`1`;default:return c(t)}}function u(e,t){let n={};for(let[r,i]of Object.entries(e)){let e=l(i,t[r]);e!==void 0&&(n[r]=e)}return n}var d=`"Roboto", "Helvetica", "Arial", sans-serif`,f=Object.freeze({type:`light`,primary:`#3399CC`,primaryContrast:`#FFFFFF`,secondary:`#164477`,secondaryContrast:`#FFFFFF`,background:`#FFFFFF`,paper:`#FFFFFF`,text:`rgba(0, 0, 0, 0.87)`,textSecondary:`rgba(0, 0, 0, 0.6)`,divider:`rgba(0, 0, 0, 0.12)`,error:`#D32F2F`,warning:`#ED6C02`,info:`#0288D1`,success:`#2E7D32`,fontFamily:d,fontSize:14,borderRadius:4}),p=Object.freeze({type:`dark`,primary:`#4DABF5`,primaryContrast:`rgba(0, 0, 0, 0.87)`,secondary:`#436A93`,secondaryContrast:`#FFFFFF`,background:`#121212`,paper:`#121212`,text:`#FFFFFF`,textSecondary:`rgba(255, 255, 255, 0.7)`,divider:`rgba(255, 255, 255, 0.12)`,error:`#F44336`,warning:`#FFA726`,info:`#29B6F6`,success:`#66BB6A`,fontFamily:d,fontSize:14,borderRadius:4}),m=[`primary`,`primaryContrast`,`secondary`,`secondaryContrast`,`background`,`paper`,`text`,`textSecondary`,`divider`,`error`,`warning`,`info`,`success`,`fontFamily`],h=[`fontSize`,`borderRadius`];function g(e){return{...e===`dark`?p:f}}function _(e){if(!e||typeof e!=`object`)return g(typeof e==`string`?e:`light`);let t=e,n=g(typeof t.type==`string`?t.type:`light`);for(let e of m){let r=t[e];typeof r==`string`&&r.trim()&&(n[e]=r.trim())}for(let e of h){let r=t[e],i=typeof r==`string`?parseFloat(r):r;typeof i==`number`&&Number.isFinite(i)&&i>=0&&(n[e]=i)}return n}function v(e,t){return e.type===t.type&&m.every(n=>e[n]===t[n])&&h.every(n=>e[n]===t[n])}function y(e){return`--iob-${e.replace(/[A-Z]/g,e=>`-${e.toLowerCase()}`)}`}function b(e){let t={};for(let n of m)t[y(n)]=e[n];for(let n of h)t[y(n)]=`${e[n]}px`;return t[`color-scheme`]=e.type,t}var x={ok:{en:`OK`,"zh-cn":`确定`},cancel:{en:`Cancel`,de:`Abbrechen`,ru:`Отмена`,pt:`Cancelar`,nl:`Annuleren`,fr:`Annuler`,it:`Annulla`,es:`Cancelar`,pl:`Anuluj`,uk:`Скасувати`,"zh-cn":`取消`},close:{en:`Close`,de:`Schließen`,ru:`Закрыть`,pt:`Fechar`,nl:`Sluiten`,fr:`Fermer`,it:`Chiudi`,es:`Cerrar`,pl:`Zamknij`,uk:`Закрити`,"zh-cn":`关闭`}},S=`
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
`;function C(e){if(!e)return null;try{let t=Function(`data`,`return (${e});`);return e=>{try{return!!t(e)}catch{return!1}}}catch{return null}}function w(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?String(e):``}function T(e){let{input:t,setting:n}=e;if(t)return t instanceof HTMLInputElement&&t.type===`checkbox`?t.checked:t instanceof HTMLSelectElement?n.options?.[t.selectedIndex]?.value:t.value}function E(e,t,n,r,i){let a={name:t,setting:n,box:e.createElement(`div`),hidden:C(n.hidden),disabled:C(n.disabled)},s=o(n.label,i);switch(n.type){case`header`:return a.box=e.createElement(`h3`),a.box.textContent=o(n.text,i)||s,a;case`staticText`:return a.box=e.createElement(`p`),a.box.textContent=o(n.text,i)||s,a;case`divider`:return a.box=e.createElement(`hr`),a}let c=e.createElement(`label`);a.box=c;let l=e.createElement(`span`);if(l.textContent=s||t,n.type===`checkbox`){let t=e.createElement(`input`);t.type=`checkbox`,t.checked=r===!0||r===`true`,c.className=`check`,c.append(t,l),a.input=t}else if(n.type===`select`){let t=e.createElement(`select`);for(let r of n.options||[]){let n=e.createElement(`option`);n.textContent=o(r.label,i),t.append(n)}let s=(n.options||[]).findIndex(e=>String(e.value)===w(r));t.selectedIndex=s===-1?0:s,c.append(l,t),a.input=t}else if(n.type===`text`&&(n.minRows||1)>1){let t=e.createElement(`textarea`);t.rows=n.minRows||2,t.value=w(r),c.append(l,t),a.input=t}else{let t=e.createElement(`input`),i=w(r);switch(n.type){case`number`:case`slider`:t.type=n.type===`slider`?`range`:`number`,n.min!==void 0&&(t.min=String(n.min)),n.max!==void 0&&(t.max=String(n.max)),t.step=n.step===void 0?`any`:String(n.step);break;case`password`:t.type=`password`;break;case`color`:t.type=!i||/^#[0-9a-f]{6}$/i.test(i)?`color`:`text`;break;default:t.type=`text`}if(t.value=i,t.type===`range`){let n=e.createElement(`output`);n.textContent=t.value,t.addEventListener(`input`,()=>n.textContent=t.value),l.append(`: `,n)}c.append(l,t),a.input=t}if(n.help){let t=e.createElement(`span`);t.className=`help`,t.textContent=o(n.help,i),c.append(t)}return a}function D(e,t={}){let n=t.lang||`en`,a=document,c=e=>x[e][n]||x[e].en||e,l=a.createElement(`div`);l.setAttribute(`data-iob-dialog`,``);let d=l.attachShadow({mode:`open`}),f=a.createElement(`style`);f.textContent=S;let p=a.createElement(`dialog`),m=_(t.theme);p.className=m.type===`dark`?`dark`:``;for(let[e,t]of Object.entries(b(m)))p.style.setProperty(e,t);e.width&&(p.style.width=`${e.width}px`),e.height&&(p.style.height=`${e.height}px`);let h=a.createElement(`form`),g=a.createElement(`header`),v=a.createElement(`span`);v.textContent=o(e.title,n);let y=a.createElement(`button`);y.type=`button`,y.className=`close`,y.title=c(`close`),y.setAttribute(`aria-label`,c(`close`)),y.textContent=`×`,g.append(v,y);let C=a.createElement(`div`);return C.className=`body`,h.append(g,C),p.append(h),d.append(f,p),new Promise(t=>{let f=!1,m=e=>{f||(f=!0,p.open&&p.close(),l.remove(),t(e))};if(y.addEventListener(`click`,()=>m(null)),p.addEventListener(`close`,()=>m(null)),h.addEventListener(`submit`,e=>e.preventDefault()),i(e)){let t={},r=[];for(let[t,i]of Object.entries(e.form.items||{})){let o=e.data?.[t]??i.default,s=E(a,t,i,o,n);r.push(s),C.append(s.box)}let i=()=>{for(let e of r)e.input&&(t[e.name]=T(e));return t},l=()=>{let e=i();for(let t of r)t.box.hidden=t.hidden?t.hidden(e):!1,t.input&&(t.input.disabled=t.disabled?t.disabled(e):!1)};h.addEventListener(`input`,l),h.addEventListener(`change`,l),l();let d=r.find(e=>e.input&&!e.box.hidden&&!e.input.disabled);d?.input&&(d.input.autofocus=!0);let f=a.createElement(`footer`),p=a.createElement(`button`);p.type=`button`,p.textContent=o(e.cancel,n)||c(`cancel`),p.addEventListener(`click`,()=>m(null));let g=a.createElement(`button`);g.type=`submit`,g.className=`primary`,g.textContent=o(e.ok,n)||c(`ok`),f.append(p,g),h.append(f),h.addEventListener(`submit`,()=>m(u(s(e.form),i())))}else C.append(e.element),p.addEventListener(r,e=>m(e.detail??null));a.body.append(l),p.showModal(),d.activeElement&&d.activeElement!==y||(p.tabIndex=-1,p.focus())})}function O(e){return[...new Set(e.filter(e=>typeof e==`string`&&!!e))]}var k=[`socket`,`dialogs`,`theme`,`editMode`,`settings`,`value`],A=class extends HTMLElement{states={};objects={};#e=null;#t={};#n=_(`light`);#r=!1;#i=null;#a=void 0;#o=null;#s=!1;#c=(e,t)=>{this.#o?.states.includes(e)&&(this.states[e]=t||null,this.#_())};#l=(e,t)=>{this.#o?.objects.includes(e)&&(this.objects[e]=t||null,this.#d())};get socket(){return this.#e}set socket(e){this.#e=e||null,this.#d()}get settings(){return this.#t}set settings(e){this.#t=e||{},this.#d()}get theme(){return this.#n}set theme(e){let t=_(e);v(t,this.#n)||(this.#n=t,this.#u(),this.#_())}get editMode(){return this.#r}set editMode(e){let t=!!e;t!==this.#r&&(this.#r=t,this.#_())}get dialogs(){return this.#i}set dialogs(e){this.#i=e||null}get value(){return this.#a}set value(e){e!==this.#a&&(this.#a=e,this.#_())}connectedCallback(){for(let e of k)if(Object.prototype.hasOwnProperty.call(this,e)){let t=this[e];delete this[e],this[e]=t}this.#u(),this.#d()}disconnectedCallback(){this.#g()}getStateIds(e){return[]}getObjectIds(e){return[]}get systemLang(){return this.#e?.systemLang||`en`}text(e){return o(e,this.systemLang)}setState(e,t){return this.#e&&!this.#r?this.#e.setState(e,t):Promise.resolve()}changeValue(e){return this.#r||this.emit(`iob-change`,e)?!1:(this.value=e,!0)}emit(e,t){return this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0,cancelable:!0}))}async openDialog(e){if(this.#r)return null;let t=this.#i?await this.#i.open(e):await D(e,{lang:this.systemLang,theme:this.#n});return i(e)?t&&typeof t==`object`?u(s(e.form),t):null:t??null}#u(){for(let[e,t]of Object.entries(b(this.#n)))this.style.setProperty(e,t)}#d(){if(!this.isConnected)return;let e=this.#e,t=e?O(this.getStateIds(this.#t)):[],n=e?O(this.getObjectIds(this.#t)):[];this.#o&&this.#o.socket!==e&&this.#g();let r=this.#o?.states||[],i=this.#o?.objects||[],a=r.filter(e=>!t.includes(e)),o=i.filter(e=>!n.includes(e)),s=t.filter(e=>!r.includes(e)),c=n.filter(e=>!i.includes(e));e&&a.length&&e.unsubscribeState(a,this.#c),e&&o.length&&this.#h(e,o);for(let e of a)delete this.states[e];for(let e of[...a,...o])!t.includes(e)&&!n.includes(e)&&delete this.objects[e];this.#o=e&&(t.length||n.length)?{socket:e,states:t,objects:n}:null,e&&s.length&&this.#p(e,s),e&&c.length&&this.#m(e,c),this.#_()}#f(e,t,n){return this.#o?.socket===e&&this.#o[t].includes(n)}#p(e,t){e.subscribeState(t,this.#c).catch(e=>console.warn(`<${this.localName}>: cannot subscribe ${t.join(`, `)}: ${e}`));for(let n of t)e.getState(n).then(t=>{this.#f(e,`states`,n)&&this.states[n]===void 0&&(this.states[n]=t||null,this.#_())}).catch(()=>{}),e.getObject(n).then(t=>{this.#f(e,`states`,n)&&!this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#_())}).catch(()=>{})}#m(e,t){e.subscribeObject(t,this.#l).catch(e=>console.warn(`<${this.localName}>: cannot subscribe the objects ${t.join(`, `)}: ${e}`));for(let n of t)e.getObject(n).then(t=>{this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#d())}).catch(()=>{})}#h(e,t){e.unsubscribeObject(t,this.#l).catch(()=>{})}#g(){if(this.#o){let{socket:e,states:t,objects:n}=this.#o;t.length&&e.unsubscribeState(t,this.#c),n.length&&this.#h(e,n),this.#o=null}this.states={},this.objects={}}#_(){this.#s||(this.#s=!0,queueMicrotask(()=>{this.#s=!1,this.isConnected&&this.render()}))}};function j(e,t){let n=typeof e==`string`?e:e.tag;customElements.get(n)||customElements.define(n,t)}var M=`iob-plex-stats`;function N(e){if(!e)return null;let t=e.trim().replace(/^system\.adapter\./,``);return/^\d+$/.test(t)?`plex.${t}`:/^plex\.\d+$/.test(t)?t:null}function P(e){if(!e||e<=0)return`0m`;let t=Math.floor(e/3600),n=Math.floor(e%3600/60);return t?`${t}h ${n}m`:`${n}m`}var F={play:`M8 5v14l11-7z`,pause:`M6 19h4V5H6v14zm8-14v14h4V5h-4z`,stop:`M6 6h12v12H6z`,skipNext:`M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z`,skipPrevious:`M6 6h2v12H6zm3.5 6 8.5 6V6z`,replay:`M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z`,star:`M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z`,libraryAdd:`M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z`,bookmark:`M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z`,devices:`M3 6h18V4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V6zm10 6H9v1.78c-.61.55-1 1.33-1 2.22s.39 1.67 1 2.22V20h4v-1.78c.61-.55 1-1.34 1-2.22s-.39-1.67-1-2.22V12zm-2 5.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM22 8h-6c-.5 0-1 .5-1 1v10c0 .5.5 1 1 1h6c.5 0 1-.5 1-1V9c0-.5-.5-1-1-1zm-1 10h-4v-8h4v8z`,storage:`M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z`,warning:`M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z`,update:`M17 1.01 7 1c-1.1 0-1.99.9-1.99 2v18c0 1.1.89 2 1.99 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-1-6h-3V8h-2v5H8l4 4 4-4z`,help:`M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z`,movie:`M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z`,tv:`M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z`,music:`M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z`,person:`M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z`,history:`M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z`,chart:`M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z`};function I({name:t,className:n}){let r=t===`forward`?F.replay:F[t];return/* @__PURE__ */ e(`svg`,{className:n,viewBox:`0 0 24 24`,"aria-hidden":`true`,focusable:`false`,style:t===`forward`?{transform:`scaleX(-1)`}:void 0,children:/* @__PURE__ */ e(`path`,{d:r})})}var L={chooseInstance:`Choose an instance of the Plex adapter in the settings`,notInstance:`Not an instance of the Plex adapter`,notPlayer:`Not a player of the Plex adapter`,nothingPlaying:`Nothing is playing`,playing:`Playing`,paused:`Paused`,play:`Play`,pause:`Pause`,stop:`Stop`,previous:`Previous`,next:`Next`,stepBack:`Skip back`,stepForward:`Skip forward`,noEvents:`No events yet`,today:`Today`,yesterday:`Yesterday`,account:`User`,player:`Player`,media:`Type`,source:`Source`,time:`Time`,topUsers:`Top users`,topLibraries:`Top libraries`,noData:`No data`,noStats:`No statistics from Tautulli yet: enable Tautulli and the statistics in the settings of the instance`,period24h:`24 h`,period7d:`7 days`,period30d:`30 days`,periodAll:`All time`,plays:`plays`},R={en:L,de:{chooseInstance:`Instanz des Plex-Adapters in den Einstellungen wählen`,notInstance:`Keine Instanz des Plex-Adapters`,notPlayer:`Kein Player des Plex-Adapters`,nothingPlaying:`Es läuft nichts`,playing:`Läuft`,paused:`Pausiert`,play:`Wiedergabe`,pause:`Pause`,stop:`Stopp`,previous:`Zurück`,next:`Weiter`,stepBack:`Zurückspulen`,stepForward:`Vorspulen`,noEvents:`Noch keine Ereignisse`,today:`Heute`,yesterday:`Gestern`,account:`Benutzer`,player:`Player`,media:`Art`,source:`Quelle`,time:`Zeit`,topUsers:`Top-Benutzer`,topLibraries:`Top-Bibliotheken`,noData:`Keine Daten`,noStats:`Noch keine Statistik von Tautulli: Tautulli und die Statistik in den Einstellungen der Instanz aktivieren`,period24h:`24 Std.`,period7d:`7 Tage`,period30d:`30 Tage`,periodAll:`Gesamt`,plays:`Wiedergaben`},ru:{chooseInstance:`Выберите экземпляр адаптера Plex в настройках`,notInstance:`Это не экземпляр адаптера Plex`,notPlayer:`Это не плеер адаптера Plex`,nothingPlaying:`Ничего не воспроизводится`,playing:`Воспроизводится`,paused:`Пауза`,play:`Воспроизвести`,pause:`Пауза`,stop:`Стоп`,previous:`Предыдущий`,next:`Следующий`,stepBack:`Перемотать назад`,stepForward:`Перемотать вперёд`,noEvents:`Событий пока нет`,today:`Сегодня`,yesterday:`Вчера`,account:`Пользователь`,player:`Плеер`,media:`Тип`,source:`Источник`,time:`Время`,topUsers:`Топ пользователей`,topLibraries:`Топ библиотек`,noData:`Нет данных`,noStats:`Статистики от Tautulli пока нет: включите Tautulli и статистику в настройках экземпляра`,period24h:`24 ч`,period7d:`7 дней`,period30d:`30 дней`,periodAll:`Всё время`,plays:`воспр.`},pt:{chooseInstance:`Escolha uma instância do adaptador Plex nas configurações`,notInstance:`Não é uma instância do adaptador Plex`,notPlayer:`Não é um leitor do adaptador Plex`,nothingPlaying:`Nada a reproduzir`,playing:`A reproduzir`,paused:`Em pausa`,play:`Reproduzir`,pause:`Pausa`,stop:`Parar`,previous:`Anterior`,next:`Seguinte`,stepBack:`Recuar`,stepForward:`Avançar`,noEvents:`Ainda sem eventos`,today:`Hoje`,yesterday:`Ontem`,account:`Utilizador`,player:`Leitor`,media:`Tipo`,source:`Origem`,time:`Hora`,topUsers:`Principais utilizadores`,topLibraries:`Principais bibliotecas`,noData:`Sem dados`,noStats:`Ainda sem estatísticas do Tautulli: ative o Tautulli e as estatísticas nas configurações da instância`,period24h:`24 h`,period7d:`7 dias`,period30d:`30 dias`,periodAll:`Sempre`,plays:`reproduções`},nl:{chooseInstance:`Kies een instantie van de Plex-adapter in de instellingen`,notInstance:`Geen instantie van de Plex-adapter`,notPlayer:`Geen speler van de Plex-adapter`,nothingPlaying:`Er speelt niets`,playing:`Speelt`,paused:`Gepauzeerd`,play:`Afspelen`,pause:`Pauze`,stop:`Stoppen`,previous:`Vorige`,next:`Volgende`,stepBack:`Terugspoelen`,stepForward:`Vooruitspoelen`,noEvents:`Nog geen gebeurtenissen`,today:`Vandaag`,yesterday:`Gisteren`,account:`Gebruiker`,player:`Speler`,media:`Soort`,source:`Bron`,time:`Tijd`,topUsers:`Topgebruikers`,topLibraries:`Topbibliotheken`,noData:`Geen gegevens`,noStats:`Nog geen statistieken van Tautulli: schakel Tautulli en de statistieken in de instellingen van de instantie in`,period24h:`24 u`,period7d:`7 dagen`,period30d:`30 dagen`,periodAll:`Altijd`,plays:`keer afgespeeld`},fr:{chooseInstance:`Choisissez une instance de l'adaptateur Plex dans les paramètres`,notInstance:`Pas une instance de l'adaptateur Plex`,notPlayer:`Pas un lecteur de l'adaptateur Plex`,nothingPlaying:`Aucune lecture en cours`,playing:`En lecture`,paused:`En pause`,play:`Lecture`,pause:`Pause`,stop:`Arrêt`,previous:`Précédent`,next:`Suivant`,stepBack:`Reculer`,stepForward:`Avancer`,noEvents:`Pas encore d'événements`,today:`Aujourd'hui`,yesterday:`Hier`,account:`Utilisateur`,player:`Lecteur`,media:`Type`,source:`Source`,time:`Heure`,topUsers:`Meilleurs utilisateurs`,topLibraries:`Meilleures bibliothèques`,noData:`Aucune donnée`,noStats:`Pas encore de statistiques de Tautulli : activez Tautulli et les statistiques dans les paramètres de l'instance`,period24h:`24 h`,period7d:`7 jours`,period30d:`30 jours`,periodAll:`Toujours`,plays:`lectures`},it:{chooseInstance:`Scegli un'istanza dell'adattatore Plex nelle impostazioni`,notInstance:`Non è un'istanza dell'adattatore Plex`,notPlayer:`Non è un lettore dell'adattatore Plex`,nothingPlaying:`Nessuna riproduzione`,playing:`In riproduzione`,paused:`In pausa`,play:`Riproduci`,pause:`Pausa`,stop:`Stop`,previous:`Precedente`,next:`Successivo`,stepBack:`Indietro`,stepForward:`Avanti`,noEvents:`Ancora nessun evento`,today:`Oggi`,yesterday:`Ieri`,account:`Utente`,player:`Lettore`,media:`Tipo`,source:`Fonte`,time:`Ora`,topUsers:`Utenti principali`,topLibraries:`Librerie principali`,noData:`Nessun dato`,noStats:`Ancora nessuna statistica da Tautulli: attiva Tautulli e le statistiche nelle impostazioni dell'istanza`,period24h:`24 h`,period7d:`7 giorni`,period30d:`30 giorni`,periodAll:`Sempre`,plays:`riproduzioni`},es:{chooseInstance:`Elija una instancia del adaptador Plex en la configuración`,notInstance:`No es una instancia del adaptador Plex`,notPlayer:`No es un reproductor del adaptador Plex`,nothingPlaying:`No se reproduce nada`,playing:`Reproduciendo`,paused:`En pausa`,play:`Reproducir`,pause:`Pausa`,stop:`Detener`,previous:`Anterior`,next:`Siguiente`,stepBack:`Retroceder`,stepForward:`Avanzar`,noEvents:`Aún no hay eventos`,today:`Hoy`,yesterday:`Ayer`,account:`Usuario`,player:`Reproductor`,media:`Tipo`,source:`Origen`,time:`Hora`,topUsers:`Usuarios principales`,topLibraries:`Bibliotecas principales`,noData:`Sin datos`,noStats:`Aún no hay estadísticas de Tautulli: active Tautulli y las estadísticas en la configuración de la instancia`,period24h:`24 h`,period7d:`7 días`,period30d:`30 días`,periodAll:`Siempre`,plays:`reproducciones`},pl:{chooseInstance:`Wybierz instancję adaptera Plex w ustawieniach`,notInstance:`To nie jest instancja adaptera Plex`,notPlayer:`To nie jest odtwarzacz adaptera Plex`,nothingPlaying:`Nic nie jest odtwarzane`,playing:`Odtwarzanie`,paused:`Wstrzymano`,play:`Odtwórz`,pause:`Pauza`,stop:`Zatrzymaj`,previous:`Poprzedni`,next:`Następny`,stepBack:`Przewiń wstecz`,stepForward:`Przewiń do przodu`,noEvents:`Brak zdarzeń`,today:`Dzisiaj`,yesterday:`Wczoraj`,account:`Użytkownik`,player:`Odtwarzacz`,media:`Rodzaj`,source:`Źródło`,time:`Czas`,topUsers:`Najaktywniejsi użytkownicy`,topLibraries:`Najpopularniejsze biblioteki`,noData:`Brak danych`,noStats:`Brak statystyk z Tautulli: włącz Tautulli i statystyki w ustawieniach instancji`,period24h:`24 godz.`,period7d:`7 dni`,period30d:`30 dni`,periodAll:`Cały czas`,plays:`odtworzeń`},uk:{chooseInstance:`Виберіть екземпляр адаптера Plex у налаштуваннях`,notInstance:`Це не екземпляр адаптера Plex`,notPlayer:`Це не плеєр адаптера Plex`,nothingPlaying:`Нічого не відтворюється`,playing:`Відтворюється`,paused:`Пауза`,play:`Відтворити`,pause:`Пауза`,stop:`Стоп`,previous:`Попередній`,next:`Наступний`,stepBack:`Перемотати назад`,stepForward:`Перемотати вперед`,noEvents:`Подій ще немає`,today:`Сьогодні`,yesterday:`Учора`,account:`Користувач`,player:`Плеєр`,media:`Тип`,source:`Джерело`,time:`Час`,topUsers:`Топ користувачів`,topLibraries:`Топ бібліотек`,noData:`Немає даних`,noStats:`Статистики від Tautulli ще немає: увімкніть Tautulli і статистику в налаштуваннях екземпляра`,period24h:`24 год`,period7d:`7 днів`,period30d:`30 днів`,periodAll:`Весь час`,plays:`відтв.`},"zh-cn":{chooseInstance:`请在设置中选择 Plex 适配器实例`,notInstance:`不是 Plex 适配器的实例`,notPlayer:`不是 Plex 适配器的播放器`,nothingPlaying:`当前没有播放`,playing:`正在播放`,paused:`已暂停`,play:`播放`,pause:`暂停`,stop:`停止`,previous:`上一个`,next:`下一个`,stepBack:`快退`,stepForward:`快进`,noEvents:`暂无事件`,today:`今天`,yesterday:`昨天`,account:`用户`,player:`播放器`,media:`类型`,source:`来源`,time:`时间`,topUsers:`热门用户`,topLibraries:`热门媒体库`,noData:`无数据`,noStats:`尚无来自 Tautulli 的统计：请在实例设置中启用 Tautulli 和统计`,period24h:`24 小时`,period7d:`7 天`,period30d:`30 天`,periodAll:`全部`,plays:`次播放`}};function z(e,t){return R[e]?.[t]||L[t]}function B(e){return[...new Set(e.filter(Boolean))].sort().join(`
`)}function V({text:n,icon:r,editMode:i}){return/* @__PURE__ */ t(`div`,{className:`hint${i?` edit`:``}`,children:[/* @__PURE__ */ e(I,{name:r}),/* @__PURE__ */ e(`span`,{children:n})]})}var H=class extends A{#e;#t=``;constructor(e){super();let t=this.attachShadow({mode:`open`}),r=document.createElement(`style`);r.textContent=e;let i=document.createElement(`div`);i.className=`mount`,t.append(r,i),this.#e=n(i)}getStateIds(e){let t=this.getWantedIds(e);return this.#t=B(t),t}render(){this.socket&&B(this.getWantedIds(this.settings))!==this.#t?this.resubscribe():this.#e.render(this.draw())}resubscribe(){let e=this.settings;this.settings=e}word=e=>z(this.systemLang,e)},U=`
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

.stats {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: var(--pad);
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    overflow: hidden;
    font-size: clamp(11px, 3.4cqi, 14px);
    user-select: none;
}
.periods {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.3em;
}
.periods button {
    padding: 0.15em 0.7em;
    font-size: 0.8em;
    border-radius: 999px;
    border: 1px solid var(--iob-divider);
}
.periods button:hover:not(:disabled) {
    background: var(--soft);
}
.periods button.active {
    border-color: transparent;
    background: var(--iob-primary);
    color: var(--iob-primary-contrast);
}
.lists {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    display: grid;
    grid-template-columns: 1fr;
    align-content: start;
    gap: 0.8em 1.2em;
}
@container (min-width: 440px) {
    .lists.both {
        grid-template-columns: 1fr 1fr;
    }
}
.list h3 {
    margin: 0 0 0.3em;
    font-size: 0.75em;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--iob-text-secondary);
}
.entry {
    --share: 0%;
    display: grid;
    grid-template-columns: 1.3em minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.5em;
    padding: 0.25em 0.4em;
    border-radius: var(--iob-border-radius);
    background: linear-gradient(
        to right,
        color-mix(in srgb, var(--iob-primary) 16%, transparent) var(--share),
        transparent var(--share)
    );
}
.rank,
.plays {
    font-size: 0.85em;
    color: var(--iob-text-secondary);
    font-variant-numeric: tabular-nums;
}
.name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.watch {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.plays {
    white-space: nowrap;
    text-align: right;
    min-width: 3.5em;
}
.plays svg {
    width: 0.9em;
    height: 0.9em;
    fill: currentColor;
    vertical-align: -0.1em;
}
.none {
    padding: 0.8em 0;
    text-align: center;
    color: var(--iob-text-secondary);
}
`,W=5,G={"24h":`01-last_24h`,"7d":`02-last_7d`,"30d":`03-last_30d`,all:`00-all_time`},K=[{period:`24h`,word:`period24h`},{period:`7d`,word:`period7d`},{period:`30d`,word:`period30d`},{period:`all`,word:`periodAll`}];function q(e){return typeof e==`string`&&e in G}function J(e,t){let n=[];for(let r of Object.keys(t)){let t=r.slice(e.length+1).match(/^statistics\.(users|libraries)\.([^.]+)$/);t&&n.push({kind:t[1],id:t[2]})}return n}function Y(e){return e.show===`users`?[`users`]:e.show===`libraries`?[`libraries`]:[`users`,`libraries`]}function X(e,t,n){let r=`${e}.statistics.${t.kind}.${t.id}.${G[n]}`;return{time:`${r}.total_time`,plays:`${r}.total_plays`,name:t.kind===`users`?`${e}.users.${t.id}.friendly_name`:`${e}.libraries.${t.id}.title`}}function Z({title:n,rows:r,word:i}){let a=Math.max(1,...r.map(e=>e.seconds));return/* @__PURE__ */ t(`div`,{className:`list`,children:[/* @__PURE__ */ e(`h3`,{children:n}),r.length?r.map((n,r)=>/* @__PURE__ */ t(`div`,{className:`entry`,style:{"--share":`${n.seconds/a*100}%`},children:[/* @__PURE__ */ e(`span`,{className:`rank`,children:r+1}),/* @__PURE__ */ e(`span`,{className:`name`,title:n.name,children:n.name}),/* @__PURE__ */ e(`span`,{className:`watch`,children:P(n.seconds)}),/* @__PURE__ */ t(`span`,{className:`plays`,title:`${n.plays} ${i(`plays`)}`,children:[n.plays,` `,/* @__PURE__ */ e(I,{name:`play`})]})]},n.name)):/* @__PURE__ */ e(`div`,{className:`none`,children:i(`noData`)})]})}j(M,class extends H{#e=null;#t=``;#n=null;#r=null;#i=void 0;constructor(){super(U)}#a(e){return this.#r&&this.#i===e.period?this.#r:q(e.period)?e.period:`7d`}#o(e){return e===this.#t&&this.socket===this.#n?this.#e:null}getWantedIds(e){let t=N(e.instance),n=t?this.#o(t):null;if(!t||!n)return[];let r=this.#a(e),i=Y(e);return n.filter(e=>i.includes(e.kind)).flatMap(e=>Object.values(X(t,e,r)))}#s(e){let t=this.socket;if(!t||e===this.#t&&t===this.#n)return;this.#t=e,this.#n=t,this.#e=null;let n=`${e}.statistics.`;t.getObjectViewSystem(`channel`,n,`${n}香`).then(t=>J(e,t)).catch(t=>(console.warn(`<${this.localName}>: cannot read the statistics of ${e}: ${String(t)}`),[])).then(n=>{e===this.#t&&t===this.#n&&(this.#e=n,this.resubscribe())}).catch(()=>void 0)}#c(e,t,n,r){let i=Math.max(1,Math.round(Number(this.settings.count)||W));return t.filter(e=>e.kind===n).map(t=>{let i=X(e,t,r),a=this.states[i.name]?.val;return{name:typeof a==`string`&&a?a:n===`libraries`?t.id.replace(/^\d+-/,``):t.id,plays:Number(this.states[i.plays]?.val)||0,seconds:Number(this.states[i.time]?.val)||0}}).filter(e=>e.plays>0||e.seconds>0).sort((e,t)=>t.seconds-e.seconds||t.plays-e.plays).slice(0,i)}#l(e){this.editMode||(this.#r=e,this.#i=this.settings.period,this.resubscribe())}draw(){let n=this.settings,r=N(n.instance);if(!r)return/* @__PURE__ */ e(V,{text:this.word(n.instance?`notInstance`:`chooseInstance`),icon:`chart`,editMode:this.editMode});this.#s(r);let i=this.#o(r);if(!i)return/* @__PURE__ */ e(`div`,{className:`stats`});let a=Y(n);if(!i.some(e=>a.includes(e.kind)))return/* @__PURE__ */ e(V,{text:this.word(`noStats`),icon:`chart`,editMode:this.editMode});let o=this.#a(n);return/* @__PURE__ */ t(`div`,{className:`stats${this.editMode?` edit`:``}`,children:[/* @__PURE__ */ e(`div`,{className:`periods`,children:K.map(t=>/* @__PURE__ */ e(`button`,{type:`button`,className:t.period===o?`active`:void 0,"aria-pressed":t.period===o,disabled:this.editMode,onClick:()=>this.#l(t.period),children:this.word(t.word)},t.period))}),/* @__PURE__ */ e(`div`,{className:`lists scroll${a.length>1?` both`:``}`,children:a.map(t=>/* @__PURE__ */ e(Z,{title:this.word(t===`users`?`topUsers`:`topLibraries`),rows:this.#c(r,i,t,o),word:this.word},t))})]})}});