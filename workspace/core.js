import {auth,db,$,msg} from "./shared.js";
import {GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,getIdTokenResult} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {doc,getDoc} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import {initMenu,refreshMenu,refreshSuggestions} from "./menu.js";
import {initOrders,refreshOrders} from "./orders.js";
import {initBulk,refreshBulk} from "./bulk.js";
import {initSettings,refreshSettings} from "./settings.js";
import {initInsights,refreshInsights} from "./insights.js";
import {initPeople,refreshPeople} from "./people.js";
import {initReports,refreshReports} from "./reports.js";

let role=null;
const staffPanels=["menu-panel","orders-panel","bulk-panel"];
const adminPanels=["settings-panel","insights-panel","team-panel","reports-panel"];
function showLogin(){
 role=null;
 $("#login-view").hidden=false;
 $("#dashboard-view").hidden=true;
 $("#sign-out").hidden=true;
}
function showDashboard(access){
 role=access;
 $("#login-view").hidden=true;
 $("#dashboard-view").hidden=false;
 $("#sign-out").hidden=false;
 $("#workspace-role").textContent=role==="admin"?"Administrator workspace":"Staff workspace";
 document.querySelectorAll("[data-panel]").forEach(tab=>{
  const authorized=staffPanels.includes(tab.dataset.panel)||(role==="admin"&&adminPanels.includes(tab.dataset.panel));
  tab.hidden=!authorized;
 });
 [...adminPanels,...staffPanels].forEach(id=>{
  const panel=$("#"+id); if(panel)panel.hidden=true;
 });
 document.querySelectorAll("[data-panel]").forEach(tab=>{
  tab.classList.remove("active");tab.setAttribute("aria-selected","false");
 });
 activateTab("menu-panel");
}
function activateTab(id){
 if(!role || (role!=="admin"&&adminPanels.includes(id)))return;
 document.querySelectorAll("[data-panel]").forEach(tab=>{
  const active=tab.dataset.panel===id;
  tab.classList.toggle("active",active);
  tab.setAttribute("aria-selected",String(active));
  const panel=$("#"+tab.dataset.panel);
  if(panel)panel.hidden=!active;
 });
}
async function getRole(user){
 const token=await getIdTokenResult(user);
 if(token.claims?.firebase?.sign_in_provider!=="google.com")return null;
 // Legacy owner record is preserved: no migration required.
 const [owner,member]=await Promise.all([
  getDoc(doc(db,"admins",user.uid)),
  getDoc(doc(db,"team",user.uid))
 ]);
 if(owner.exists()&&owner.data().active===true)return "admin";
 if(member.exists()&&member.data().active===true&&["admin","staff"].includes(member.data().role)){
  return member.data().role;
 }
 return null;
}
async function loadAll(){
 if(!role)return;
 msg("Loading kitchen workspace…");
 const essentials=[refreshMenu(),refreshOrders(),refreshBulk()];
 if(role==="admin")essentials.push(refreshSettings(),refreshInsights(),refreshPeople(),refreshReports());
 else essentials.push(refreshSuggestions());
 const outcomes=await Promise.allSettled(essentials);
 const fails=outcomes.filter(x=>x.status==="rejected");
 if(fails.length){fails.forEach(x=>console.error(x.reason));msg(fails.length+" workspace section(s) could not load. Check permissions and database setup.");}
 else msg("Workspace refreshed.",true);
}
onAuthStateChanged(auth,async user=>{
 if(!user){showLogin();return;}
 try{
  const access=await getRole(user);
  if(!access){
   showLogin();
   msg("Google sign-in succeeded, but this account is not approved for staff access. Firebase UID: "+user.uid+". The owner must create an authorized team record in Firestore.");
   return;
  }
  showDashboard(access);
  await loadAll();
 }catch(error){console.error(error);showLogin();msg("Cannot verify role. Check published Firestore rules and team permissions.");}
});
$("#google-login").addEventListener("click",async()=>{
 const button=$("#google-login");button.disabled=true;
 try{
  const provider=new GoogleAuthProvider();
  provider.setCustomParameters({prompt:"select_account"});
  await signInWithPopup(auth,provider);
 }catch(error){
  console.error(error);
  msg(error.code==="auth/popup-blocked"?"Allow Google sign-in popups in your browser.":"Could not sign in. Check Google Authentication and authorized domains.");
 }finally{button.disabled=false;}
});
$("#sign-out").addEventListener("click",()=>signOut(auth));
$("#refresh-dashboard").addEventListener("click",loadAll);
document.querySelectorAll("[data-panel]").forEach(tab=>tab.addEventListener("click",()=>activateTab(tab.dataset.panel)));
initMenu();initOrders();initBulk();initSettings();initPeople();initReports();
$("#year").textContent=new Date().getFullYear();
