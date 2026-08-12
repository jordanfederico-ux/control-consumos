const APP_VERSION="3.2";
const KEY="cc_v1";
const defaults={
  initial:50000,
  sender:"",
  subject:"",
  clientId:"",
  movements:[],
  processedIds:[],
  trackingStart:null,
  alertThreshold:10000,
  lastAlertMovementId:null,
  lastSyncAt:null,
  autoSync:true,
  schemaVersion:3.2
};

const saved=JSON.parse(localStorage.getItem(KEY)||"{}");
const state={...defaults,...saved};
if(!Array.isArray(state.movements)) state.movements=[];
if(!Array.isArray(state.processedIds)) state.processedIds=[];
if(typeof state.autoSync!=="boolean") state.autoSync=true;
if(!("lastSyncAt" in state)) state.lastSyncAt=null;

// V3.2 migration:
// Older versions may have imported historical emails before a tracking start existed.
// Because that history is not trustworthy, clear it once when upgrading to 3.2.
// Settings such as sender, subject, clientId, initial balance, alert threshold and auto-sync are preserved.
if(Number(state.schemaVersion||0)<3.2){
  state.movements=[];
  state.processedIds=[];
  state.trackingStart=null;
  state.lastAlertMovementId=null;
  state.lastSyncAt=null;
  state.schemaVersion=3.2;
  localStorage.setItem(KEY,JSON.stringify(state));
}

for(const m of state.movements){
  if(m.gmailId && !state.processedIds.includes(m.gmailId)) state.processedIds.push(m.gmailId);
}

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("es-UY",{style:"currency",currency:"UYU",minimumFractionDigits:2}).format(Number(n)||0);
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
let tokenClient=null;
let accessToken=null;
let accessTokenExpiresAt=0;
let syncing=false;

function spent(){return state.movements.reduce((s,m)=>s+Number(m.amount),0)}
function balance(){return Number(state.initial||0)-spent()}

function render(){
  const totalSpent=spent(), available=balance();
  $("balance").textContent=money(available);
  $("initial").textContent=money(state.initial);
  $("spent").textContent=money(totalSpent);
  $("count").textContent=state.movements.length;
  $("empty").style.display=state.movements.length?"none":"block";

  const warning=$("warning");
  if(Number(state.alertThreshold)>0 && available<=Number(state.alertThreshold)){
    warning.textContent=`⚠️ Ojo: te quedan ${money(available)}. Tu alerta está configurada en ${money(state.alertThreshold)}.`;
    warning.classList.remove("hidden");
  }else{
    warning.classList.add("hidden");
  }

  $("lastUpdate").textContent=state.lastSyncAt
    ? `Última actualización: ${new Date(state.lastSyncAt).toLocaleString("es-UY",{dateStyle:"short",timeStyle:"short"})}`
    : "Última actualización: nunca";

  $("trackingInfo").textContent=state.trackingStart
    ? `Seguimiento desde ${new Date(state.trackingStart).toLocaleString("es-UY",{dateStyle:"short",timeStyle:"short"})}`
    : "Seguimiento sin fecha de inicio configurada";

  $("movements").innerHTML=[...state.movements].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(m=>`
    <div class="movement">
      <div>
        <div class="merchant">${escapeHtml(m.merchant||"Consumo")}</div>
        <div class="meta">${new Date(m.date).toLocaleString("es-UY",{dateStyle:"short",timeStyle:"short"})}</div>
      </div>
      <div class="amount">− ${money(m.amount)}</div>
    </div>`).join("");
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function setStatus(t){$("status").textContent=t}

function openSettings(){
  $("initialInput").value=state.initial;
  $("senderInput").value=state.sender;
  $("subjectInput").value=state.subject;
  $("clientIdInput").value=state.clientId;
  $("alertInput").value=state.alertThreshold;
  $("autoSyncInput").checked=state.autoSync;
  $("settings").showModal();
}
$("settingsBtn").onclick=openSettings;

$("settingsForm").addEventListener("submit",e=>{
  e.preventDefault();
  state.initial=Number($("initialInput").value)||0;
  state.sender=$("senderInput").value.trim();
  state.subject=$("subjectInput").value.trim();
  state.clientId=$("clientIdInput").value.trim();
  state.alertThreshold=Number($("alertInput").value)||0;
  state.autoSync=$("autoSyncInput").checked;
  state.schemaVersion=3.2;

  // For a brand-new install, saving config establishes the tracking start.
  if(!state.trackingStart){
    state.movements=[];
    state.processedIds=[];
    state.lastAlertMovementId=null;
    state.lastSyncAt=null;
    state.trackingStart=Date.now();
  }

  save(); render(); initGoogle(); $("settings").close();
  setStatus("Configuración guardada.");
});

$("resetTrackingBtn").onclick=(e)=>{
  e.preventDefault();
  state.movements=[];
  state.processedIds=[];
  state.trackingStart=Date.now();
  state.lastAlertMovementId=null;
  state.lastSyncAt=null;
  state.schemaVersion=3.2;
  save();
  render();
  setStatus("Historial borrado. El seguimiento empieza desde ahora.");
  $("settings").close();
};

$("notificationBtn").onclick=async()=>{
  try{
    if(!("Notification" in window)){
      alert("Este navegador no ofrece notificaciones web.");
      return;
    }
    const permission=await Notification.requestPermission();
    if(permission==="granted"){
      alert("Alertas activadas. Te avisaremos al sincronizar cuando el saldo quede por debajo del límite configurado.");
    }else{
      alert("Las alertas no quedaron habilitadas.");
    }
  }catch(e){alert("No se pudieron activar las alertas.");}
};

function extractAmount(text){
  // V3.1: ONLY accept purchases whose currency explicitly says UYU
  // immediately after the numeric amount.
  //
  // Examples accepted:
  //   Importe: 4071.0 UYU   -> 4071.00
  //   Importe: 4.071 UYU    -> 4071.00
  //   Importe: 4.071,50 UYU -> 4071.50
  //   Importe: 4071,5 UYU   -> 4071.50
  //
  // USD (or any other currency) is intentionally ignored.
  const match=text.match(
    /(?:importe|monto|amount|importe\s+de\s+la\s+operaci[oó]n)\s*[:\-]?\s*([0-9][0-9.,\s]*)\s*UYU\b/i
  );
  if(!match) return null;

  let raw=match[1].replace(/\s/g,"").trim();
  if(!raw) return null;

  if(raw.includes(".") && raw.includes(",")){
    // Uruguayan formatting such as 4.071,50
    raw=raw.replace(/\./g,"").replace(",",".");
  } else if(raw.includes(",")){
    // Comma is decimal separator
    const parts=raw.split(",");
    if(parts.length!==2) return null;
    raw=parts[0].replace(/\./g,"")+"."+parts[1];
  } else if(raw.includes(".")){
    const dots=(raw.match(/\./g)||[]).length;

    if(dots>1){
      // 1.234.567 -> 1234567
      raw=raw.replace(/\./g,"");
    } else {
      const [left,right]=raw.split(".");

      if(/^\d{1,2}$/.test(right)){
        // Bank format: 4071.0 UYU means 4071.00, not 40710.
        raw=left+"."+right;
      } else if(/^\d{3}$/.test(right)){
        // Thousands grouping: 4.071 -> 4071
        raw=left+right;
      } else {
        return null;
      }
    }
  }

  const n=Number(raw);
  return Number.isFinite(n) && n>0 ? n : null;
}

function extractMerchant(text){
  const m=text.match(/(?:Comercio|Merchant)\s*:\s*(.+)/i);
  if(m) return m[1].replace(/<[^>]+>/g,"").trim().split(/\n/)[0].slice(0,80);
  return "Consumo";
}

function base64UrlDecode(data){
  const bin=atob(data.replace(/-/g,"+").replace(/_/g,"/"));
  const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
function htmlToText(html){
  const doc=new DOMParser().parseFromString(html,"text/html");
  return doc.body?.innerText || html.replace(/<[^>]*>/g," ");
}
function collectParts(payload,out=[]){
  if(payload?.parts) payload.parts.forEach(p=>collectParts(p,out));
  if(payload?.body?.data) out.push({mime:payload.mimeType,data:payload.body.data});
  return out;
}
function messageText(msg){
  const parts=collectParts(msg.payload,[]);
  let text="";
  for(const p of parts){
    if(p.mime==="text/plain") text+="\n"+base64UrlDecode(p.data);
    else if(p.mime==="text/html") text+="\n"+htmlToText(base64UrlDecode(p.data));
  }
  return text;
}

function initGoogle(){
  if(!state.clientId || !window.google?.accounts?.oauth2) return;
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:state.clientId,
    scope:"https://www.googleapis.com/auth/gmail.readonly",
    // Important: don't force "consent" every time.
    prompt:"",
    callback:async(resp)=>{
      if(resp.error){setStatus("No se pudo autorizar Gmail.");return}
      accessToken=resp.access_token;
      accessTokenExpiresAt=Date.now()+(Number(resp.expires_in||3000)*1000);
      await syncGmail(accessToken);
    },
    error_callback:()=>setStatus("Se cerró o falló la autorización de Google.")
  });
}

async function getMessageIds(token,query){
  const ids=[];
  let pageToken=null;
  let pages=0;
  do{
    let url="https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100";
    if(query) url+="&q="+encodeURIComponent(query);
    if(pageToken) url+="&pageToken="+encodeURIComponent(pageToken);
    const list=await fetch(url,{headers:{Authorization:"Bearer "+token}}).then(r=>r.json());
    if(list.error) throw new Error(list.error.message);
    ids.push(...(list.messages||[]));
    pageToken=list.nextPageToken||null;
    pages++;
  }while(pageToken && pages<5);
  return ids;
}

async function syncGmail(token){
  if(syncing) return;
  syncing=true;
  try{
    setStatus("Buscando nuevos consumos...");
    const q=[];
    if(state.sender) q.push(`from:${state.sender}`);
    if(state.subject) q.push(`subject:"${state.subject.replace(/"/g,"")}"`);

    // Narrow the Gmail search by date, then enforce the exact timestamp below.
    if(state.trackingStart){
      const d=new Date(state.trackingStart-86400000);
      const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
      q.push(`after:${yyyy}/${mm}/${dd}`);
    }

    const items=await getMessageIds(token,q.join(" "));
    const known=new Set(state.processedIds);
    let added=0;
    let newestAddedId=null;

    // Fetch oldest to newest for a natural history order.
    const pending=[];
    for(const item of items){
      if(known.has(item.id)) continue;
      const msg=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`,{
        headers:{Authorization:"Bearer "+token}
      }).then(r=>r.json());
      if(msg.error) throw new Error(msg.error.message);
      pending.push(msg);
    }
    pending.sort((a,b)=>Number(a.internalDate||0)-Number(b.internalDate||0));

    for(const msg of pending){
      const msgTime=Number(msg.internalDate||0);
      // Never import mail that predates the moment tracking began.
      if(state.trackingStart && msgTime<=Number(state.trackingStart)) continue;

      const text=messageText(msg);
      const amount=extractAmount(text);
      if(amount!==null){
        state.movements.push({
          gmailId:msg.id,
          amount,
          merchant:extractMerchant(text),
          date:new Date(msgTime||Date.now()).toISOString()
        });
        state.processedIds.push(msg.id);
        known.add(msg.id);
        newestAddedId=msg.id;
        added++;
      }
    }

    state.lastSyncAt=Date.now();
    save(); render();

    if(added){
      setStatus(`Listo: ${added} consumo(s) nuevo(s).`);
      await maybeAlert(newestAddedId);
    }else{
      setStatus("No hay consumos nuevos.");
    }
  }catch(err){
    console.error(err);
    if(String(err.message||"").includes("401")){
      accessToken=null; accessTokenExpiresAt=0;
      setStatus("La sesión de Google venció. Tocá nuevamente para renovar el acceso.");
    }else setStatus("Error: "+err.message);
  }finally{
    syncing=false;
  }
}

async function maybeAlert(newestId){
  const available=balance();
  if(!(Number(state.alertThreshold)>0 && available<=Number(state.alertThreshold))) return;
  if(!newestId || newestId===state.lastAlertMovementId) return;
  state.lastAlertMovementId=newestId;
  save();

  const title="Control de Consumos";
  const body=`⚠️ Te quedan ${money(available)} de saldo.`;

  try{
    if("Notification" in window && Notification.permission==="granted"){
      const reg=await navigator.serviceWorker?.ready;
      if(reg) await reg.showNotification(title,{body,tag:"saldo-bajo"});
      else new Notification(title,{body});
    }
  }catch(e){console.warn("Notificación no disponible",e)}
}


function startSync({automatic=false}={}){
  if(!state.clientId){
    if(!automatic){
      openSettings();
      setStatus("Primero configurá el Google OAuth Client ID.");
    }
    return;
  }

  if(!state.trackingStart){
    if(!automatic){
      setStatus("Primero elegí desde cuándo empezar el seguimiento en Configuración.");
      openSettings();
    }
    return;
  }

  initGoogle();

  // If we still have a valid token in this browser session, sync immediately.
  if(accessToken && Date.now()<accessTokenExpiresAt-60000){
    syncGmail(accessToken);
    return;
  }

  if(automatic){
    // Browser OAuth cannot silently mint a fresh token after a full reload.
    // On open, try a no-consent prompt. If Google requires interaction,
    // leave a clear message and let the manual button renew it.
    setStatus("Intentando sincronizar Gmail automáticamente…");
    try{
      tokenClient?.requestAccessToken({prompt:""});
    }catch(e){
      setStatus("Abrí Gmail una vez con el botón para renovar el acceso.");
    }
    return;
  }

  tokenClient?.requestAccessToken({prompt:""});
}

$("refreshBtn").onclick=()=>startSync({automatic:false});

window.addEventListener("load",()=>{
  render();

  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  }

  // Google Identity Services is loaded asynchronously, so wait briefly for it.
  let attempts=0;
  const boot=setInterval(()=>{
    attempts++;
    if(window.google?.accounts?.oauth2){
      clearInterval(boot);
      initGoogle();
      if(state.autoSync && state.clientId && state.trackingStart){
        setTimeout(()=>startSync({automatic:true}),250);
      }
    }else if(attempts>=20){
      clearInterval(boot);
      setStatus("No se pudo cargar Google. Probá recargando la app.");
    }
  },250);
});
