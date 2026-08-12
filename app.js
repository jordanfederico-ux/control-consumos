const KEY="cc_v1";
const state=JSON.parse(localStorage.getItem(KEY)||'{"initial":50000,"sender":"","subject":"","clientId":"","movements":[]}');

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("es-UY",{style:"currency",currency:"UYU",minimumFractionDigits:2}).format(Number(n)||0);
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));

function render(){
  const spent=state.movements.reduce((s,m)=>s+Number(m.amount),0);
  $("balance").textContent=money(state.initial-spent);
  $("initial").textContent=money(state.initial);
  $("spent").textContent=money(spent);
  $("count").textContent=state.movements.length;
  $("empty").style.display=state.movements.length?"none":"block";
  $("movements").innerHTML=[...state.movements].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(m=>`
    <div class="movement">
      <div><div class="merchant">${escapeHtml(m.merchant||"Consumo")}</div>
      <div class="meta">${new Date(m.date).toLocaleString("es-UY",{dateStyle:"short",timeStyle:"short"})}</div></div>
      <div class="amount">− ${money(m.amount)}</div>
    </div>`).join("");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

function openSettings(){
  $("initialInput").value=state.initial;
  $("senderInput").value=state.sender;
  $("subjectInput").value=state.subject;
  $("clientIdInput").value=state.clientId;
  $("settings").showModal();
}
$("settingsBtn").onclick=openSettings;
$("settingsForm").addEventListener("submit",e=>{
  e.preventDefault();
  state.initial=Number($("initialInput").value)||0;
  state.sender=$("senderInput").value.trim();
  state.subject=$("subjectInput").value.trim();
  state.clientId=$("clientIdInput").value.trim();
  save(); render(); $("settings").close(); setStatus("Configuración guardada.");
});

function setStatus(t){$("status").textContent=t;}

function extractAmount(text){
  const patterns=[
    /(?:importe|monto|amount|importe\s+de\s+la\s+operaci[oó]n)\s*[:\-]?\s*(?:UYU\s*)?([\d.\s]+(?:,\d{1,2})?)\s*UYU/i,
    /(?:UYU\s*)?([\d.]+(?:,\d{1,2})?)\s*UYU/i,
    /(?:importe|monto|amount)\s*[:\-]?\s*\$?\s*([\d.\s]+(?:,\d{1,2})?)/i
  ];
  for(const re of patterns){
    const m=text.match(re);
    if(m){
      let raw=m[1].replace(/\s/g,"");
      // UY notation: 4.071.0 is uncommon but can occur; treat final .0 as decimal.
      if(raw.includes(",") && raw.includes(".")) raw=raw.replace(/\./g,"").replace(",",".");
      else if(raw.includes(",")) raw=raw.replace(",",".");
      else if((raw.match(/\./g)||[]).length>1) raw=raw.replace(/\./g,"");
      else if(/\.\d{1,2}$/.test(raw) && raw.split(".")[0].length<=2) {}
      else if(/\.\d$/.test(raw)) raw=raw.replace(/\./,"");
      const n=Number(raw);
      if(Number.isFinite(n) && n>0) return n;
    }
  }
  return null;
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
  if(payload.parts) payload.parts.forEach(p=>collectParts(p,out));
  if(payload.body?.data) out.push({mime:payload.mimeType,data:payload.body.data});
  return out;
}
function messageText(msg){
  const parts=collectParts(msg.payload,[]);
  let text="";
  for(const p of parts){
    if(p.mime==="text/plain") text+="\n"+base64UrlDecode(p.data);
    else if(p.mime==="text/html") text+="\n"+htmlToText(base64UrlDecode(p.data));
  }
  return text || "";
}

let tokenClient=null;
function initGoogle(){
  if(!state.clientId || !window.google?.accounts?.oauth2) return;
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:state.clientId,
    scope:"https://www.googleapis.com/auth/gmail.readonly",
    callback: async (resp)=>{
      if(resp.error){setStatus("No se pudo autorizar Gmail."); return;}
      await syncGmail(resp.access_token);
    }
  });
}
async function syncGmail(token){
  try{
    setStatus("Buscando nuevos mails...");
    const q=[];
    if(state.sender) q.push(`from:${state.sender}`);
    if(state.subject) q.push(`subject:"${state.subject.replace(/"/g,"")}"`);
    const query=q.join(" ");
    const url="https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50"+(query?"&q="+encodeURIComponent(query):"");
    const list=await fetch(url,{headers:{Authorization:"Bearer "+token}}).then(r=>r.json());
    if(list.error) throw new Error(list.error.message);
    const known=new Set(state.movements.map(m=>m.gmailId));
    let added=0;
    for(const item of (list.messages||[])){
      if(known.has(item.id)) continue;
      const msg=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`,{headers:{Authorization:"Bearer "+token}}).then(r=>r.json());
      const text=messageText(msg);
      const amount=extractAmount(text);
      if(amount){
        state.movements.push({
          gmailId:item.id,
          amount,
          merchant:extractMerchant(text),
          date:new Date(Number(msg.internalDate||Date.now())).toISOString()
        });
        added++;
      }
    }
    save(); render();
    setStatus(added?`Listo: ${added} consumo(s) nuevo(s).`:"No hay consumos nuevos.");
  }catch(err){console.error(err);setStatus("Error: "+err.message);}
}
$("refreshBtn").onclick=()=>{
  if(!state.clientId){openSettings();setStatus("Primero configurá el Google OAuth Client ID.");return;}
  initGoogle();
  tokenClient?.requestAccessToken({prompt:"consent"});
};
$("demoBtn").onclick=()=>{
  const samples=[
    {gmailId:"demo-"+Date.now()+"-1",amount:4071,merchant:"AUTOSERVICIO DEMO",date:new Date().toISOString()},
    {gmailId:"demo-"+Date.now()+"-2",amount:2350.5,merchant:"RESTAURANTE DEMO",date:new Date(Date.now()-86400000).toISOString()}
  ];
  state.movements.push(...samples); save(); render(); setStatus("Agregados 2 consumos de prueba.");
};
window.addEventListener("load",()=>{render(); initGoogle();});
