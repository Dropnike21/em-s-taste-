import {db,$,esc,msg} from "./shared.js";
import {collection,doc,getDocs,updateDoc,serverTimestamp,query,limit} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
let reports=[];
export async function refreshReports(){
 const snap=await getDocs(query(collection(db,"feedback"),limit(150)));
 reports=snap.docs.map(x=>({id:x.id,...x.data()}));
 $("#reports-list").innerHTML=reports.length?reports.map(report=>{
  const opts=["new","reviewing","resolved","closed"].map(x=>'<option value="'+x+'"'+(x===report.status?" selected":"")+'>'+x+'</option>').join("");
  return '<article class="order-card"><div class="order-header"><h3>'+esc(report.type.replaceAll("_"," "))+'</h3><span class="order-status">'+esc(report.status)+'</span></div>'+
   '<p>'+esc(report.message)+'</p><p class="muted">Rating: '+(report.rating===0?"Not provided":esc(report.rating)+"/5")+' · User: '+esc(report.customerUid.slice(0,10))+'…</p>'+
   '<div class="order-actions"><select data-report-status="'+esc(report.id)+'">'+opts+'</select><button data-report-save="'+esc(report.id)+'">Update report</button></div></article>';
 }).join(""):'<p class="muted">No customer reports or requests yet.</p>';
}
export function initReports(){
 $("#reports-list").addEventListener("click",async event=>{
  const b=event.target.closest("[data-report-save]");if(!b)return;
  const id=b.dataset.reportSave;
  const status=document.querySelector('[data-report-status="'+CSS.escape(id)+'"]')?.value;
  if(!["new","reviewing","resolved","closed"].includes(status))return;
  b.disabled=true;
  try{await updateDoc(doc(db,"feedback",id),{status,reviewedAt:serverTimestamp()});await refreshReports();msg("Customer report status updated.",true);}
  catch(error){console.error(error);msg("Unable to update report.");}
  finally{b.disabled=false;}
 });
}
