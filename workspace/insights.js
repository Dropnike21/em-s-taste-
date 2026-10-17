import {db,$,esc} from "./shared.js";
import {collection,getDocs,query,limit} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import {getOrders} from "./orders.js";
export async function refreshInsights(){
 const snap=await getDocs(query(collection(db,"reviews"),limit(100)));
 const reviews=snap.docs.map(d=>({id:d.id,...d.data()}));
 const counts=new Map();
 for(const order of getOrders()){
  if(order.status==="cancelled")continue;
  for(const item of order.items||[]){
   const name=String(item.name||"Meal");
   counts.set(name,(counts.get(name)||0)+Number(item.quantity||0));
  }
 }
 $("#top-dishes").innerHTML=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10)
  .map(([name,qty])=>'<div class="insight-row"><strong>'+esc(name)+'</strong><span>'+qty+' servings</span></div>').join("")||
  '<p class="muted">Not enough order data yet.</p>';
 const avg=reviews.length?reviews.reduce((t,x)=>t+Number(x.rating||0),0)/reviews.length:0;
 $("#rating-average").textContent=reviews.length?avg.toFixed(1)+" / 5 · "+reviews.length+" verified review(s)":"No ratings yet";
 $("#customer-feedback").innerHTML=reviews.map(x=>'<div class="feedback-line"><strong>'+Number(x.rating)+'/5 ★</strong><p>'+esc(x.comment||"Rating only")+'</p></div>').join("")||
  '<p class="muted">No completed-meal reviews yet.</p>';
}
