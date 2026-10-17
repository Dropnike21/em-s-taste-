import {db,$,esc,peso,stamp,msg} from "./shared.js";
import {collection,doc,getDocs,updateDoc,serverTimestamp,query,orderBy,limit} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
let orders=[];
export const getOrders=()=>orders;
export async function refreshOrders(){
 const snap=await getDocs(query(collection(db,"orders"),orderBy("createdAt","desc"),limit(150)));
 orders=snap.docs.map(r=>({id:r.id,...r.data()}));
 $("#stat-pending").textContent=orders.filter(o=>o.status==="pending").length;
 $("#stat-total").textContent=peso(orders.filter(o=>o.status!=="cancelled").reduce((sum,o)=>sum+(Number(o.total)||0),0));
 $("#orders-list").innerHTML=orders.length?orders.map(o=>{
  const statuses=["pending","confirmed","completed","cancelled"].map(s=>'<option value="'+s+'"'+(s===o.status?" selected":"")+'>'+s+'</option>').join("");
  const payments=["unpaid","paid","refunded"].map(s=>'<option value="'+s+'"'+(s===(o.paymentStatus||"unpaid")?" selected":"")+'>'+s+'</option>').join("");
  const lines=(o.items||[]).map(i=>'<div>'+esc(i.quantity)+' × '+esc(i.name)+' — '+peso((Number(i.unitPrice)||0)*(Number(i.quantity)||0))+'</div>').join("");
  return '<article class="order-card"><div class="order-header"><div><h3>'+esc(o.customerName)+'</h3><span class="order-id">#'+esc(o.id.slice(-20))+'</span></div><span class="order-status '+esc(o.status)+'">'+esc(o.status)+'</span></div>'+
    '<div class="order-body"><p><strong>Workplace:</strong> '+esc(o.workplace)+'</p><p><strong>Meal date:</strong> '+esc(o.serviceDay||stamp(o.serviceDate))+'</p><p><strong>Note:</strong> '+esc(o.note||"—")+'</p><p><strong>Payment:</strong> '+esc(o.paymentStatus||"unpaid")+'</p></div>'+
    '<div class="order-lines">'+lines+'</div><p class="order-total">'+peso(o.total)+'</p>'+
    '<div class="order-actions"><label>Status <select data-status="'+esc(o.id)+'">'+statuses+'</select></label><label>Payment <select data-payment="'+esc(o.id)+'">'+payments+'</select></label>'+
    '<button type="button" data-save-order="'+esc(o.id)+'">Save transaction</button></div></article>';
 }).join(""):'<p class="muted">No orders yet.</p>';
}
function safeCsv(text){
 let s=String(text??"");if(/^[=+\-@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
export function initOrders(){
 $("#orders-list").addEventListener("click",async e=>{
  const b=e.target.closest("[data-save-order]");if(!b)return;
  const id=b.dataset.saveOrder;
  const status=document.querySelector('[data-status="'+CSS.escape(id)+'"]')?.value;
  const paymentStatus=document.querySelector('[data-payment="'+CSS.escape(id)+'"]')?.value;
  if(!["pending","confirmed","completed","cancelled"].includes(status)||!["unpaid","paid","refunded"].includes(paymentStatus))return;
  b.disabled=true;
  try{await updateDoc(doc(db,"orders",id),{status,paymentStatus,reviewedAt:serverTimestamp()});await refreshOrders();msg("Transaction status saved. Notify the customer separately.",true);}
  catch(error){console.error(error);msg("Unable to save transaction status.");}
  finally{b.disabled=false;}
 });
 $("#export-csv").addEventListener("click",()=>{
  const rows=[["ID","Customer","Workplace","Date","Status","Payment","Items","Total"]]
   .concat(orders.map(o=>[o.id,o.customerName,o.workplace,o.serviceDay,o.status,o.paymentStatus||"unpaid",(o.items||[]).map(i=>i.quantity+"x "+i.name).join("; "),o.total]));
  const blob=new Blob(["\uFEFF"+rows.map(row=>row.map(safeCsv).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ems-taste-transactions.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  msg("Exported recent transactions. Protect customer details in this file.",true);
 });
}
