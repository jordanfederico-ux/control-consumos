const APP_VERSION="4.2.1";
const LEGACY_KEY="cc_v1";
const GLOBAL_KEY="cc_v4_global";
const FIXED_CLIENT_ID="1008229627670-snds8nh12cesb8htda7s38oi73uck9qj.apps.googleusercontent.com";
const SESSION_KEY="cc_v41_session";

const defaults={
  initial:50000,sender:"",subject:"",clientId:"",
  movements:[],processedIds:[],trackingStart:null,
  alertThreshold:10000,lastAlertMovementId:null,lastSyncAt:null,
  autoSync:true,faceIdEnabled:false,faceCredentialId:null,schemaVersion:4.21
};

let currentEmail=null,accessToken=null,accessTokenExpiresAt=0,tokenClient=null,syncing=false;
let state={...defaults};

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("es-UY",{style:"currency",currency:"UYU",minimumFractionDigits:2}).format(Number(n)||0);

function globalConfig(){return {clientId:FIXED_CLIENT_ID}}
function saveGlobalClientId(clientId){}
function userKey(email){return `cc_v4_user_${String(email).toLowerCase()}`}
function loadUserState(email){
  const key=userKey(email),existing=localStorage.getItem(key);
  if(existing){
    state={...defaults,...JSON.parse(existing)};
  }else{
    let migrated={};
    try{migrated=JSON.parse(localStorage.getItem(LEGACY_KEY)||"{}")}catch(e){}
    state={...defaults,...migrated,schemaVersion:4.21};
    const g=globalConfig();
    state.clientId=FIXED_CLIENT_ID;
    localStorage.setItem(key,JSON.stringify(state));
  }
  if(!Array.isArray(state.movements)) state.movements=[];
  if(!Array.isArray(state.processedIds)) state.processedIds=[];
  if(typeof state.autoSync!=="boolean") state.autoSync=true;
  if(typeof state.faceIdEnabled!=="boolean") state.faceIdEnabled=false;
  if(!("faceCredentialId" in state)) state.faceCredentialId=null;
  state.schemaVersion=4.21;
}

function saveSession(email){
  localStorage.setItem(SESSION_KEY,JSON.stringify({email:String(email).toLowerCase()}));
}
function loadSession(){
  try{
    const s=JSON.parse(localStorage.getItem(SESSION_KEY)||"{}");
    return s.email?String(s.email).toLowerCase():null;
  }catch(e){return null}
}
function clearSession(){
  localStorage.removeItem(SESSION_KEY);
}

function save(){
  if(!currentEmail)return;
  localStorage.setItem(userKey(currentEmail),JSON.stringify(state));
  if(state.clientId)saveGlobalClientId(state.clientId);
}

function b64urlToBytes(s){
  const pad="=".repeat((4-s.length%4)%4);
  const b64=(s+pad).replace(/-/g,"+").replace(/_/g,"/");
  const bin=atob(b64);
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
function bytesToB64url(bytes){
  let bin="";
  for(const b of bytes) bin+=String.fromCharCode(b);
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function randomBytes(n=32){
  const a=new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}
async function canUseDeviceAuth(){
  return !!(window.PublicKeyCredential &&
    navigator.credentials &&
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.());
}
async function enrollDeviceAuth(){
  if(!currentEmail) throw new Error("Primero iniciá sesión con Google.");
  if(!(await canUseDeviceAuth())) throw new Error("Face ID / autenticación del dispositivo no está disponible.");

  const challenge=randomBytes();
  const userId=new TextEncoder().encode(currentEmail);

  const cred=await navigator.credentials.create({
    publicKey:{
      challenge,
      rp:{name:"Control de Consumos",id:location.hostname},
      user:{id:userId,name:currentEmail,displayName:currentEmail},
      pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
      authenticatorSelection:{
        authenticatorAttachment:"platform",
        userVerification:"required",
        residentKey:"preferred"
      },
      timeout:60000,
      attestation:"none"
    }
  });

  if(!cred) throw new Error("No se pudo crear la credencial.");
  state.faceCredentialId=bytesToB64url(new Uint8Array(cred.rawId));
  state.faceIdEnabled=true;
  save();
  return true;
}
async function unlockWithDeviceAuth(){
  if(!state.faceIdEnabled || !state.faceCredentialId) return true;
  if(!(await canUseDeviceAuth())) throw new Error("La autenticación del dispositivo no está disponible.");

  const assertion=await navigator.credentials.get({
    publicKey:{
      challenge:randomBytes(),
      rpId:location.hostname,
      allowCredentials:[{
        id:b64urlToBytes(state.faceCredentialId),
        type:"public-key",
        transports:["internal"]
      }],
      userVerification:"required",
      timeout:60000
    }
  });

  return !!assertion;
}
function showDeviceLock(){
  $("privateGate").style.display="none";
  $("mainApp").classList.add("hidden-app");
  $("deviceLock").style.display="grid";
}
function hideDeviceLock(){
  $("deviceLock").style.display="none";
}

function spent(){return state.movements.reduce((s,m)=>s+Number(m.amount),0)}
function balance(){return Number(state.initial||0)-spent()}

function render(){
  if(!currentEmail)return;
  const totalSpent=spent(),available=balance();
  $("signedInAs").textContent=currentEmail;
  $("balance").textContent=money(available);
  $("initial").textContent=money(state.initial);
  $("spent").textContent=money(totalSpent);
  $("count").textContent=state.movements.length;
  $("empty").style.display=state.movements.length?"none":"block";

  const warning=$("warning");
  if(Number(state.alertThreshold)>0&&available<=Number(state.alertThreshold)){
    warning.textContent=`⚠️ Ojo: te quedan ${money(available)}. Tu alerta está configurada en ${money(state.alertThreshold)}.`;
    warning.classList.remove("hidden");
  }else warning.classList.add("hidden");

  $("lastUpdate").textContent=state.lastSyncAt
    ? `Última actualización: ${new Date(state.lastSyncAt).toLocaleString("es-UY",{dateStyle:"short",timeStyle:"short"})}`
    : "Última actualización: nunca";

  $("trackingInfo").textContent=state.trackingStart
    ? `Seguimiento desde ${new Date(state.trackingStart).toLocaleString("es-UY",{dateStyle:"short",timeStyle:"short"})}`
    : "Seguimiento sin fecha de inicio configurada";

  $("movements").innerHTML=[...state.movements].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(m=>`
    <div class="movement"><div><div class="merchant">${escapeHtml(m.merchant||"Consumo")}</div>
    <div class="meta">${new Date(m.date).toLocaleString("es-UY",{dateStyle:"short",timeStyle:"short"})}</div></div>
    <div class="amount">− ${money(m.amount)}</div></div>`).join("");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function setStatus(t){$("status").textContent=t}
function setGateStatus(t){$("gateStatus").textContent=t}
function showGate(message="Ingresá con una cuenta de Google autorizada para usar esta app."){
  $("gateText").textContent=message;
  $("deviceLock").style.display="none";
  $("privateGate").style.display="grid";
  $("mainApp").classList.add("hidden-app");
}
function showApp(){
  $("deviceLock").style.display="none";
  $("privateGate").style.display="none";
  $("mainApp").classList.remove("hidden-app");
}

function openSettings(){
  $("initialInput").value=state.initial;
  $("senderInput").value=state.sender;
  $("subjectInput").value=state.subject;
    $("alertInput").value=state.alertThreshold;
  $("autoSyncInput").checked=state.autoSync;
  $("faceIdInput").checked=state.faceIdEnabled;
  $("settings").showModal();
}
$("settingsBtn").onclick=openSettings;

$("settingsForm").addEventListener("submit",async e=>{
  e.preventDefault();
  state.initial=Number($("initialInput").value)||0;
  state.sender=$("senderInput").value.trim();
  state.subject=$("subjectInput").value.trim();
  state.clientId=FIXED_CLIENT_ID;
  state.alertThreshold=Number($("alertInput").value)||0;
  state.autoSync=$("autoSyncInput").checked;
  const wantsFaceId=$("faceIdInput").checked;
  state.schemaVersion=4.21;

  if(wantsFaceId && !state.faceIdEnabled){
    try{
      await enrollDeviceAuth();
    }catch(err){
      alert("No se pudo activar Face ID / autenticación del dispositivo: "+err.message);
      $("faceIdInput").checked=false;
      state.faceIdEnabled=false;
      state.faceCredentialId=null;
    }
  }else if(!wantsFaceId && state.faceIdEnabled){
    state.faceIdEnabled=false;
    state.faceCredentialId=null;
  }
  if(!state.trackingStart){
    state.movements=[];state.processedIds=[];
    state.lastAlertMovementId=null;state.lastSyncAt=null;
    state.trackingStart=Date.now();
  }
  save();render();initGoogle();$("settings").close();
  setStatus("Configuración guardada.");
});

$("resetTrackingBtn").onclick=e=>{
  e.preventDefault();
  state.movements=[];state.processedIds=[];
  state.trackingStart=Date.now();
  state.lastAlertMovementId=null;state.lastSyncAt=null;
  state.schemaVersion=4.21;
  save();render();
  setStatus("Historial borrado. El seguimiento empieza desde ahora.");
  $("settings").close();
};

$("notificationBtn").onclick=async()=>{
  try{
    if(!("Notification" in window)){alert("Este navegador no ofrece notificaciones web.");return}
    const permission=await Notification.requestPermission();
    alert(permission==="granted"
      ?"Alertas activadas. Te avisaremos al sincronizar cuando el saldo quede por debajo del límite."
      :"Las alertas no quedaron habilitadas.");
  }catch(e){alert("No se pudieron activar las alertas.");}
};

function extractAmount(text){
  const match=text.match(/(?:importe|monto|amount|importe\s+de\s+la\s+operaci[oó]n)\s*[:\-]?\s*([0-9][0-9.,\s]*)\s*UYU\b/i);
  if(!match)return null;
  let raw=match[1].replace(/\s/g,"").trim();
  if(!raw)return null;
  if(raw.includes(".")&&raw.includes(",")){
    raw=raw.replace(/\./g,"").replace(",",".");
  }else if(raw.includes(",")){
    const parts=raw.split(",");
    if(parts.length!==2)return null;
    raw=parts[0].replace(/\./g,"")+"."+parts[1];
  }else if(raw.includes(".")){
    const dots=(raw.match(/\./g)||[]).length;
    if(dots>1)raw=raw.replace(/\./g,"");
    else{
      const [left,right]=raw.split(".");
      if(/^\d{1,2}$/.test(right))raw=left+"."+right;
      else if(/^\d{3}$/.test(right))raw=left+right;
      else return null;
    }
  }
  const n=Number(raw);
  return Number.isFinite(n)&&n>0?n:null;
}
function extractMerchant(text){
  const m=text.match(/(?:Comercio|Merchant)\s*:\s*(.+)/i);
  return m?m[1].replace(/<[^>]+>/g,"").trim().split(/\n/)[0].slice(0,80):"Consumo";
}
function base64UrlDecode(data){
  const bin=atob(data.replace(/-/g,"+").replace(/_/g,"/"));
  return new TextDecoder("utf-8").decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));
}
function htmlToText(html){
  const doc=new DOMParser().parseFromString(html,"text/html");
  return doc.body?.innerText||html.replace(/<[^>]*>/g," ");
}
function collectParts(payload,out=[]){
  if(payload?.parts)payload.parts.forEach(p=>collectParts(p,out));
  if(payload?.body?.data)out.push({mime:payload.mimeType,data:payload.body.data});
  return out;
}
function messageText(msg){
  let text="";
  for(const p of collectParts(msg.payload,[])){
    if(p.mime==="text/plain")text+="\n"+base64UrlDecode(p.data);
    else if(p.mime==="text/html")text+="\n"+htmlToText(base64UrlDecode(p.data));
  }
  return text;
}

async function fetchCurrentGoogleUser(token){
  const r=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile",{headers:{Authorization:"Bearer "+token}});
  const data=await r.json();
  if(!r.ok||!data.emailAddress)throw new Error("No se pudo identificar la cuenta de Gmail.");
  return {email:data.emailAddress};
}

function getClientId(){return FIXED_CLIENT_ID}
function initGoogle(){
  const clientId=getClientId();
  if(!clientId||!window.google?.accounts?.oauth2)return;

  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:clientId,
    scope:"https://www.googleapis.com/auth/gmail.readonly",
    prompt:"",
    callback:async resp=>{
      if(resp.error){
        showGate("🔒 Esta cuenta no está autorizada para usar la aplicación.");
        setGateStatus(resp.error);
        return;
      }
      accessToken=resp.access_token;
      accessTokenExpiresAt=Date.now()+(Number(resp.expires_in||3000)*1000);
      try{
        const user=await fetchCurrentGoogleUser(accessToken);
        currentEmail=String(user.email).toLowerCase();
        saveSession(currentEmail);
        loadUserState(currentEmail);
        state.clientId=clientId;save();
        showApp();render();
        if(state.autoSync&&state.trackingStart)await syncGmail(accessToken);
        else if(!state.trackingStart)setStatus("Configurá el saldo inicial para empezar.");
      }catch(e){
        showGate("🔒 No se pudo verificar esta cuenta.");
        setGateStatus(e.message);
      }
    },
    error_callback:err=>{
      showGate("🔒 Acceso cancelado o cuenta no autorizada.");
      setGateStatus(err?.type||"");
    }
  });
}

async function authorize({selectAccount=false}={}){
  const clientId=getClientId();
  initGoogle();
  setGateStatus("Verificando cuenta…");
  tokenClient?.requestAccessToken({prompt:selectAccount?"select_account":""});
}

$("loginBtn").onclick=()=>authorize({selectAccount:true});
$("switchUserBtn").onclick=()=>{
  accessToken=null;accessTokenExpiresAt=0;currentEmail=null;state={...defaults};clearSession();
  showGate("Elegí otra cuenta de Google autorizada.");
  authorize({selectAccount:true});
};

async function getMessageIds(token,query){
  const ids=[];let pageToken=null,pages=0;
  do{
    let url="https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100";
    if(query)url+="&q="+encodeURIComponent(query);
    if(pageToken)url+="&pageToken="+encodeURIComponent(pageToken);
    const list=await fetch(url,{headers:{Authorization:"Bearer "+token}}).then(r=>r.json());
    if(list.error)throw new Error(list.error.message);
    ids.push(...(list.messages||[]));
    pageToken=list.nextPageToken||null;pages++;
  }while(pageToken&&pages<5);
  return ids;
}

async function syncGmail(token){
  if(syncing||!currentEmail)return;
  syncing=true;
  try{
    setStatus("Buscando nuevos consumos...");
    const q=[];
    if(state.sender)q.push(`from:${state.sender}`);
    if(state.subject)q.push(`subject:"${state.subject.replace(/"/g,"")}"`);
    if(state.trackingStart){
      const d=new Date(state.trackingStart-86400000);
      const yyyy=d.getFullYear(),mm=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0");
      q.push(`after:${yyyy}/${mm}/${dd}`);
    }

    const items=await getMessageIds(token,q.join(" "));
    const known=new Set(state.processedIds);
    let added=0,newestAddedId=null;
    const pending=[];

    for(const item of items){
      if(known.has(item.id))continue;
      const msg=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`,{
        headers:{Authorization:"Bearer "+token}
      }).then(r=>r.json());
      if(msg.error)throw new Error(msg.error.message);
      pending.push(msg);
    }

    pending.sort((a,b)=>Number(a.internalDate||0)-Number(b.internalDate||0));
    for(const msg of pending){
      const msgTime=Number(msg.internalDate||0);
      if(state.trackingStart&&msgTime<=Number(state.trackingStart))continue;
      const text=messageText(msg),amount=extractAmount(text);
      if(amount!==null){
        state.movements.push({
          gmailId:msg.id,amount,
          merchant:extractMerchant(text),
          date:new Date(msgTime||Date.now()).toISOString()
        });
        state.processedIds.push(msg.id);known.add(msg.id);
        newestAddedId=msg.id;added++;
      }
    }

    state.lastSyncAt=Date.now();save();render();
    if(added){
      setStatus(`Listo: ${added} consumo(s) nuevo(s).`);
      await maybeAlert(newestAddedId);
    }else setStatus("No hay consumos nuevos.");
  }catch(err){
    console.error(err);
    if(String(err.message||"").includes("401")){
      accessToken=null;accessTokenExpiresAt=0;
      setStatus("La sesión de Google venció. Tocá nuevamente para renovar el acceso.");
    }else setStatus("Error: "+err.message);
  }finally{syncing=false}
}

async function maybeAlert(newestId){
  const available=balance();
  if(!(Number(state.alertThreshold)>0&&available<=Number(state.alertThreshold)))return;
  if(!newestId||newestId===state.lastAlertMovementId)return;
  state.lastAlertMovementId=newestId;save();

  try{
    if("Notification" in window&&Notification.permission==="granted"){
      const body=`⚠️ Te quedan ${money(available)} de saldo.`;
      const reg=await navigator.serviceWorker?.ready;
      if(reg)await reg.showNotification("Control de Consumos",{body,tag:"saldo-bajo"});
      else new Notification("Control de Consumos",{body});
    }
  }catch(e){}
}

function startSync(){
  if(!currentEmail){showGate();return}
  if(!state.trackingStart){setStatus("Primero configurá el saldo inicial.");openSettings();return}
  if(accessToken&&Date.now()<accessTokenExpiresAt-60000){
    syncGmail(accessToken);return;
  }
  initGoogle();
  tokenClient?.requestAccessToken({prompt:""});
}
$("refreshBtn").onclick=startSync;


$("unlockBtn").onclick=async()=>{
  $("unlockStatus").textContent="Verificando…";
  try{
    if(await unlockWithDeviceAuth()){
      hideDeviceLock();
      showApp();
      render();
      $("unlockStatus").textContent="";
      // Gmail token is intentionally not stored long-term. User can refresh manually
      // if Google requires a new token.
      if(state.autoSync){
        setStatus("App desbloqueada. Si Gmail necesita renovar acceso, tocá Buscar nuevos consumos.");
      }
    }
  }catch(err){
    $("unlockStatus").textContent="No se pudo desbloquear.";
  }
};
$("logoutFromLockBtn").onclick=()=>{
  clearSession();
  currentEmail=null;
  state={...defaults};
  hideDeviceLock();
  showGate("Elegí una cuenta de Google autorizada.");
};


window.addEventListener("load",()=>{
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(console.warn);


  const savedEmail=loadSession();
  if(savedEmail){
    currentEmail=savedEmail;
    loadUserState(currentEmail);

    if(state.faceIdEnabled && state.faceCredentialId){
      showDeviceLock();
    }else{
      showApp();
      render();
      setStatus("Sesión local restaurada. Gmail se renovará solo cuando sea necesario.");
    }
  }else{
    showGate();
  }

  let attempts=0;
  const boot=setInterval(()=>{
    attempts++;
    if(window.google?.accounts?.oauth2){
      clearInterval(boot);
      initGoogle();
    }else if(attempts>=20){
      clearInterval(boot);
      if(!savedEmail)setGateStatus("No se pudo cargar Google. Probá recargando la app.");
    }
  },250);
});
