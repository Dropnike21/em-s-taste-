import {db,$,esc,peso,msg,stamp} from "./shared.js";
import {collection,doc,getDocs,updateDoc,serverTimestamp,query,orderBy,limit} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
let records=[];
export async function refreshBulk(){
 const snap=await getDocs(query(collection(db,"bulkRequests"),orderBy("createdAt","desc"),limit(100)));
 records=snap.docs.map(x=>({id:x.id,...x.data()}));
 $("#stat-bulk").textContent=records.filter(x=>x.status==="pending_confirmation"||x.status==="under_review").length;
 $("#bulk-list").innerHTML=records.length?records.map(r=>{
  const statusOptions=["pending_confirmation","under_review","confirmed","declined","completed"].map(x=>'<option value="'+x+'"'+(r.status===x?" selected":"")+'>'+x.replaceAll("_"," ")+'</option>').join("");
  const payOptions=["unpaid","paid","refunded"].map(x=>'<option value="'+x+'"'+((r.paymentStatus||"unpaid")===x?" selected":"")+'>'+x+'</option>').join("");
  return '<article class="order-card"><div class="order-header"><div><h3>'+esc(r.customerName)+'</h3><small>'+esc(r.workplace)+' · '+esc(r.serviceDay||stamp(r.requestedDate))+'</small></div><span class="order-status">'+esc(r.status)+'</span></div>'+
   '<p><strong>'+esc(r.servings)+' servings:</strong> '+esc(r.mealRequest)+'</p><p class="muted">'+esc(r.note||"No additional notes")+'</p>'+
   '<div class="order-actions"><label>Staff approval <select data-bulk-status="'+esc(r.id)+'">'+statusOptions+'</select></label>'+
   '<label>Quoted total (₱) <input data-bulk-quote="'+esc(r.id)+'" type="number" min="0" max="500000" step="1" value="'+(Number(r.quotedTotal)||0)+'"></label>'+
   '<label>Payment <select data-bulk-payment="'+esc(r.id)+'">'+payOptions+'</select></label>'+
   '<button type="button" data-bulk-save="'+esc(r.id)+'">Save review</button></div>'+
   '<p class="muted">Quotation and confirmation are handled by staff. This request does not reserve food automatically.</p></article>';
 }).join(""):'<p class="muted">No bulk inquiries yet.</p>';
}
export function initBulk(){
 $("#bulk-list").addEventListener("click",async e=>{
  const button=e.target.closest("[data-bulk-save]");if(!button)return;
  const id=button.dataset.bulkSave;
  const status=document.querySelector('[data-bulk-status="'+CSS.escape(id)+'"]')?.value;
  const paymentStatus=document.querySelector('[data-bulk-payment="'+CSS.escape(id)+'"]')?.value;
  const quotedTotal=Number(document.querySelector('[data-bulk-quote="'+CSS.escape(id)+'"]')?.value);
  if(!["pending_confirmation","under_review","confirmed","declined","completed"].includes(status)||!["unpaid","paid","refunded"].includes(paymentStatus)||!Number.isInteger(quotedTotal)||quotedTotal<0||quotedTotal>500000){
   msg("Enter a valid status, payment status, and whole-peso quote.");return;
  }
  button.disabled=true;
  try{
   await updateDoc(doc(db,"bulkRequests",id),{status,paymentStatus,quotedTotal,updatedAt:serverTimestamp()});
   await refreshBulk();msg("Bulk request updated. Staff must communicate confirmation to the customer.",true);
  }catch(error){console.error(error);msg("Cannot save the bulk request. Check staff access.");}
  finally{button.disabled=false;}
 });
}
