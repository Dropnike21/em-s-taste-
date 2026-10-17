import {db,$,esc,msg} from "./shared.js";
import {collection,doc,getDocs,getCountFromServer,query,limit,setDoc,updateDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
let customers=[],team=[];
export async function refreshPeople(){
 const [list,count,members]=await Promise.all([
  getDocs(query(collection(db,"customers"),limit(100))),
  getCountFromServer(collection(db,"customers")),
  getDocs(collection(db,"team"))
 ]);
 customers=list.docs.map(x=>({uid:x.id,...x.data()}));
 team=members.docs.map(x=>({uid:x.id,...x.data()}));
 $("#stat-customers").textContent=count.data().count;
 $("#customer-directory").innerHTML=customers.map(p=>'<div class="customer-directory-item"><div><strong>'+esc(p.displayName)+'</strong><small>'+esc(p.email)+'</small><small>'+(p.blocked?"Blocked":"Active")+'</small></div><button class="button button-outline" data-block="'+esc(p.uid)+'">'+(p.blocked?"Unblock":"Block")+'</button></div>').join("")||
 '<p class="muted">No customers yet.</p>';
 $("#team-directory").innerHTML=team.map(p=>'<div class="customer-directory-item"><div><strong>'+esc(p.label||p.uid)+'</strong><small>'+esc(p.uid)+'</small><small>'+esc(p.role)+' · '+(p.active?"Active":"Disabled")+'</small></div><button type="button" data-edit-team="'+esc(p.uid)+'">Edit</button></div>').join("")||
 '<p class="muted">No additional team members yet. The original owner admin still has full access.</p>';
}
export function initPeople(){
 $("#customer-directory").addEventListener("click",async event=>{
  const b=event.target.closest("[data-block]");if(!b)return;
  const p=customers.find(x=>x.uid===b.dataset.block);if(!p)return;
  if(!confirm((p.blocked?"Unblock":"Block")+" this customer?"))return;
  b.disabled=true;
  try{await updateDoc(doc(db,"customers",p.uid),{blocked:!p.blocked});await refreshPeople();msg("Customer access updated.",true);}
  catch(e){console.error(e);msg("Customer moderation failed.");}
  finally{b.disabled=false;}
 });
 $("#team-directory").addEventListener("click",event=>{
  const b=event.target.closest("[data-edit-team]");if(!b)return;
  const p=team.find(x=>x.uid===b.dataset.editTeam);if(!p)return;
  $("#member-uid").value=p.uid;$("#member-label").value=p.label||"";
  $("#member-role").value=p.role;$("#member-active").checked=p.active===true;
  $("#team-panel").scrollIntoView({behavior:"smooth"});
 });
 $("#team-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const uid=$("#member-uid").value.trim(),role=$("#member-role").value,label=$("#member-label").value.trim();
  if(!/^[a-zA-Z0-9]{10,128}$/.test(uid)||!["staff","admin"].includes(role)){msg("Enter a valid Firebase Authentication UID and role.");return;}
  try{
   await setDoc(doc(db,"team",uid),{role,active:$("#member-active").checked,label,updatedAt:serverTimestamp()});
   $("#team-form").reset();await refreshPeople();
   msg("Team permissions saved. The member can now access their assigned workspace.",true);
  }catch(error){console.error(error);msg("Unable to save team permissions.");}
 });
}
