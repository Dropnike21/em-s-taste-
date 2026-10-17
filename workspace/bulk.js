import {db,$,esc,peso,msg,stamp} from "./shared.js";
import {collection,doc,getDocs,updateDoc,serverTimestamp,query,orderBy,limit}
  from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

let records=[];
const nextStatuses={
 pending_confirmation:["pending_confirmation","under_review","confirmed","declined"],
 under_review:["under_review","confirmed","declined"],
 confirmed:["confirmed","completed","declined"],
 declined:["declined"],
 completed:["completed"]
};
const paymentStates=["unpaid","paid","refunded"];

export async function refreshBulk(){
 const snapshot=await getDocs(query(collection(db,"bulkRequests"),orderBy("createdAt","desc"),limit(100)));
 records=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
 $("#stat-bulk").textContent=records.filter(r=>["pending_confirmation","under_review"].includes(r.status)).length;
 $("#bulk-list").innerHTML=records.length?records.map(r=>{
  const options=(nextStatuses[r.status]||[r.status]).map(status=>'<option value="'+esc(status)+'"'+
   (status===r.status?" selected":"")+'>'+status.replaceAll("_"," ")+'</option>').join("");
  const payments=paymentStates.map(status=>'<option value="'+status+'"'+
   (status===(r.paymentStatus||"unpaid")?" selected":"")+'>'+status+'</option>').join("");
  return '<article class="order-card" data-bulk-record="'+esc(r.id)+'">'+
   '<div class="order-header"><div><h3>'+esc(r.customerName)+'</h3><small>'+esc(r.workplace)+
   ' · '+esc(r.serviceDay||stamp(r.requestedDate))+'</small></div><span class="order-status">'+
   esc(r.status.replaceAll("_"," "))+'</span></div>'+
   '<p><strong>'+esc(r.servings)+' servings:</strong> '+esc(r.mealRequest)+'</p>'+
   (r.note?'<p class="muted">'+esc(r.note)+'</p>':"")+
   '<div class="order-actions"><label>Booking status<select data-bulk-status>'+options+'</select></label>'+
   '<label>Quoted amount (₱)<input data-bulk-quote type="number" min="0" max="500000" step="1" '+
   'value="'+(Number.isInteger(r.quotedTotal)?r.quotedTotal:"")+'" placeholder="Add quote"></label>'+
   '<label>Payment status<select data-bulk-payment>'+payments+'</select></label>'+
   '<button type="button" data-bulk-save="'+esc(r.id)+'">Save changes</button></div>'+
   '<p class="order-footnote">Confirmed bookings need a staff-verified quotation. Notify the customer separately.</p></article>';
 }).join(""):'<p class="muted">No bulk requests yet.</p>';
}
export function initBulk(){
 $("#bulk-list").addEventListener("click",async event=>{
  const button=event.target.closest("[data-bulk-save]");
  if(!button)return;
  const record=records.find(r=>r.id===button.dataset.bulkSave);
  const card=button.closest("[data-bulk-record]");
  if(!record||!card)return;
  const status=card.querySelector("[data-bulk-status]")?.value;
  const paymentStatus=card.querySelector("[data-bulk-payment]")?.value;
  const rawQuote=card.querySelector("[data-bulk-quote]")?.value.trim()||"";
  const quote=rawQuote===""?null:Number(rawQuote);
  if(!(nextStatuses[record.status]||[]).includes(status)||!paymentStates.includes(paymentStatus)||
     (quote!==null&&(!Number.isInteger(quote)||quote<0||quote>500000))){
   msg("Check the selected status, payment status, and quote.");return;
  }
  if(["confirmed","completed"].includes(status)&&!(quote>0)){
   msg("Enter a verified quotation greater than ₱0 before confirming the booking.");return;
  }
  if(status==="completed"&&record.status!=="confirmed"){
   msg("Confirm the booking before marking it completed.");return;
  }
  if(status===record.status&&paymentStatus===(record.paymentStatus||"unpaid")&&
     quote===(Number.isInteger(record.quotedTotal)?record.quotedTotal:null)){
   msg("No changes to save.");return;
  }
  if(["confirmed","completed","declined"].includes(status)&&status!==record.status&&
     !confirm("Change this bulk request to "+status.replaceAll("_"," ")+"? Confirm the decision with the customer separately."))return;
  if(paymentStatus==="paid"&&record.paymentStatus!=="paid"&&
     !confirm("Have you verified receipt of payment for this booking?"))return;
  const changes={status,paymentStatus,updatedAt:serverTimestamp()};
  if(quote!==null)changes.quotedTotal=quote;
  button.disabled=true;
  try{
   await updateDoc(doc(db,"bulkRequests",record.id),changes);
   await refreshBulk();
   msg("Bulk request updated.",true);
  }catch(error){
   console.error("Bulk booking update failed:",error);
   msg("Could not save the booking. Check staff permissions or connection.");
   button.disabled=false;
  }
 });
}
