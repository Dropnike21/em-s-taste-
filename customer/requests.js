import {auth,db} from "../firebase-config.js";
import {collection,doc,getDocs,setDoc,query,where,limit,serverTimestamp,Timestamp} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const $=selector=>document.querySelector(selector);
const clean=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let loadedUid=null,loading=false;
function manilaKey(){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"numeric",day:"numeric"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return p.year+"-"+Number(p.month)+"-"+Number(p.day);
}
function showStatus(id,text,success=false){
 const el=$(id);el.textContent=text;el.classList.toggle("good",success);
}
function customer(){
 const s=window.EMS_LIVE_STATE;
 return s?.customer?.uid&&!s.customer.blocked?s.customer:null;
}
function updateVisibility(){
 const current=customer();
 $("#customer-service-forms").hidden=!current;
 $("#customer-request-history").hidden=!current;
 $("#services-auth").hidden=!!current;
 $("#services-auth").textContent=window.EMS_LIVE_STATE?.customer?.blocked
  ?"This account cannot submit requests. Contact Em's Taste for assistance."
  :"Please sign in with Google above to send requests and feedback.";
 if(current && loadedUid!==current.uid && !loading){
  loadHistory();
 }
 if(!current){
  loadedUid=null;
  $("#customer-service-history").innerHTML='<p class="muted">Sign in to see your own requests.</p>';
 }
}
async function loadHistory(){
 const profile=customer();
 if(!profile||loading)return;
 loading=true;
 try{
  const [bulk,feedback]=await Promise.all([
   getDocs(query(collection(db,"bulkRequests"),where("customerUid","==",profile.uid),limit(50))),
   getDocs(query(collection(db,"feedback"),where("customerUid","==",profile.uid),limit(50)))
  ]);
  const entries=[
   ...bulk.docs.map(x=>({kind:"Large booking",id:x.id,...x.data(),summary:x.data().mealRequest})),
   ...feedback.docs.map(x=>({kind:"Report / feedback",id:x.id,...x.data(),summary:x.data().message}))
  ].sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
  $("#customer-service-history").innerHTML=entries.length?entries.map(x=>
   '<article class="request-history-item"><strong>'+clean(x.kind)+'</strong> <span>'+clean(x.status)+'</span>'+
   '<p>'+clean(x.summary)+'</p><small>'+clean(x.kind==="Large booking"?String(x.servings)+" meals · "+x.serviceDay:x.type)+'</small></article>'
  ).join(""):'<p class="muted">You have no past requests or reports.</p>';
  loadedUid=profile.uid;
 }catch(error){
  console.error(error);
  $("#customer-service-history").innerHTML='<p class="muted">Unable to read your requests. Check Firestore rules.</p>';
 }finally{loading=false;}
}
$("#feedback-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const profile=customer();
 if(!profile){showStatus("#feedback-status","Please sign in first.");return;}
 const button=event.currentTarget.querySelector('button[type="submit"]');
 const type=$("#feedback-type").value,rating=Number($("#feedback-rating").value),message=$("#feedback-message").value.trim();
 if(!["menu_request","food","website","service","bug","issue","other"].includes(type)||
    !Number.isInteger(rating)||rating<0||rating>5||message.length<5||message.length>800)return;
 const dayKey=manilaKey(),id=profile.uid+"_"+type+"_"+dayKey;
 button.disabled=true;
 try{
  await setDoc(doc(db,"feedback",id),{
   customerUid:profile.uid,type,dayKey,rating,message,createdAt:serverTimestamp(),status:"new"
  });
  $("#feedback-form").reset();
  showStatus("#feedback-status","Your request has been recorded. Thank you.",true);
  await loadHistory();
 }catch(error){
  console.error(error);
  showStatus("#feedback-status",error.code==="permission-denied"?
   "You may already have submitted this category today. You can submit again tomorrow.":
   "Could not save feedback. Please try again later.");
 }finally{button.disabled=false;}
});
$("#bulk-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const profile=customer();
 if(!profile){showStatus("#bulk-status","Please sign in first.");return;}
 const key=$("#bulk-date").value,date=new Date(key+"T00:00:00.000Z");
 const servings=Number($("#bulk-qty").value);
 const workplace=$("#bulk-workplace").value.trim();
 const mealRequest=$("#bulk-meals").value.trim();
 const note=$("#bulk-note").value.trim();
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==key||[0,6].includes(date.getUTCDay())||
   date<=new Date()||servings<51||servings>500||!Number.isInteger(servings)||workplace.length<2||mealRequest.length<3){
  showStatus("#bulk-status","Select a future workday, 51–500 servings, and provide workplace and meal details.");return;
 }
 const button=event.currentTarget.querySelector('button[type="submit"]');
 button.disabled=true;
 try{
  await setDoc(doc(db,"bulkRequests",profile.uid+"_"+key),{
   customerUid:profile.uid,customerName:profile.displayName||"Customer",
   workplace,mealRequest,servings,serviceDay:key,
   requestedDate:Timestamp.fromDate(date),note,createdAt:serverTimestamp(),
   status:"pending_confirmation"
  });
  $("#bulk-form").reset();
  showStatus("#bulk-status","Booking inquiry received. Staff will review capacity and pricing. This is not a confirmed order.",true);
  await loadHistory();
 }catch(error){
  console.error(error);
  showStatus("#bulk-status",error.code==="permission-denied"?
   "This request was not accepted. You may already have a booking inquiry for this date, or the date is outside the allowed range.":
   "Unable to save the booking request. Please try again.");
 }finally{button.disabled=false;}
});
window.addEventListener("ems-data",updateVisibility);
updateVisibility();
