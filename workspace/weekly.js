import {db,$,esc,peso,msg} from "./shared.js";
import {eligibleProducts,allProducts} from "./menu.js";
import {doc,getDoc,writeBatch,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const days=["Monday","Tuesday","Wednesday","Thursday","Friday"];
let weekKey="";
let dayIndex=0;
let daysSelected=Array.from({length:5},()=>new Set());
let isPublished=false;
let isLoading=false;
let isDirty=false;
let requestVersion=0;

function toDate(key){return new Date(key+"T00:00:00.000Z");}
function dateKey(date){return date.toISOString().slice(0,10);}
function plusDays(key,delta){
 const d=toDate(key);d.setUTCDate(d.getUTCDate()+delta);return dateKey(d);
}
function mondayOf(key){
 const d=toDate(key);
 if(!Number.isFinite(d.getTime()))return "";
 const offset=(d.getUTCDay()+6)%7;
 return plusDays(key,-offset);
}
function currentMonday(){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{
  timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return mondayOf(p.year+"-"+p.month+"-"+p.day);
}
function dayKey(index){return plusDays(weekKey,index);}
function prettyDate(key){
 return new Intl.DateTimeFormat("en-PH",{timeZone:"UTC",month:"short",day:"numeric"})
  .format(toDate(key));
}
function setStatus(message,isError=false){
 const el=$("#weekly-status");
 el.textContent=message;
 el.classList.toggle("weekly-error",isError);
}
function renderDayTabs(){
 document.querySelectorAll("[data-week-day]").forEach(tab=>{
  const index=Number(tab.dataset.weekDay);
  const selected=index===dayIndex;
  tab.classList.toggle("active",selected);
  tab.setAttribute("aria-selected",String(selected));
  const small=tab.querySelector("small");
  small.textContent=prettyDate(dayKey(index))+" · "+daysSelected[index].size;
 });
 $("#weekly-day-heading").textContent=days[dayIndex]+"'s menu";
 $("#weekly-selected-count").textContent=daysSelected[dayIndex].size+
  " product"+(daysSelected[dayIndex].size===1?"":"s")+" selected";
}
function renderProducts(){
 if(!weekKey)return;
 renderDayTabs();
 const selected=daysSelected[dayIndex];
 const query=$("#weekly-search").value.trim().toLowerCase();
 const all=allProducts().filter(d=>String(d.name).toLowerCase().includes(query));
 // Keep retired selections visible so staff can uncheck and remove them.
 for(const id of selected){
  if(!all.some(d=>d.id===id)&&!allProducts().some(d=>d.id===id)){
   all.push({id,name:"Retired product: "+id,price:0});
  }
 }
 const eligibleIds=new Set(eligibleProducts().map(d=>d.id));
 $("#weekly-products").innerHTML=all.map(d=>{
  const eligible=eligibleIds.has(d.id);
  const checked=selected.has(d.id);
  const url=typeof d.image==="string"&&/^https:\/\//.test(d.image)?d.image:"";
  const photo=url?'<img loading="lazy" src="'+esc(url)+'" alt="" referrerpolicy="no-referrer">':
   '<span class="weekly-dish-placeholder" aria-hidden="true">🍲</span>';
  return '<button type="button" data-week-product="'+esc(d.id)+'" '+
   (!eligible&&!checked?'disabled ':'')+
   'aria-pressed="'+checked+'" class="weekly-dish-button'+(checked?" is-added":"")+
   (!eligible?" is-disabled":"")+'">'+
   photo+'<span class="weekly-dish-text"><strong>'+esc(d.name)+'</strong><small>'+
   (eligible?peso(d.price):checked?"Not ready — tap to remove":"Set price first")+
   '</small></span><span class="weekly-dish-action">'+
   (checked?"✓ Added":"＋ Add")+'</span></button>';
 }).join("") || '<p class="muted">No dishes found. Set a price under My dishes first.</p>';
 $("#weekly-copy-day").disabled=false;
 $("#weekly-copy-day").textContent=dayIndex===0 ?
   "Copy Monday to Tue–Fri" : "Use Monday's choices";
}
export function initWeeklyMenu(){
 $("#weekly-monday").value=currentMonday();
 $("#weekly-days").addEventListener("click",event=>{
  const tab=event.target.closest("[data-week-day]");
  if(!tab)return;
  dayIndex=Number(tab.dataset.weekDay);
  renderProducts();
 });
 $("#weekly-products").addEventListener("click",event=>{
  const tile=event.target.closest("[data-week-product]");
  if(!tile||tile.disabled)return;
  const id=tile.dataset.weekProduct;
  if(daysSelected[dayIndex].has(id))daysSelected[dayIndex].delete(id);
  else daysSelected[dayIndex].add(id);
  isDirty=true;
  renderProducts();
  setStatus("Not saved yet.");
 });
 $("#weekly-search").addEventListener("input",renderProducts);
 const checkUnsaved=()=>{
  if(!isDirty)return true;
  return confirm("Discard your unsaved weekly menu edits and change weeks?");
 };
 $("#weekly-prev").addEventListener("click",()=>{
  if(!checkUnsaved())return;
  $("#weekly-monday").value=plusDays(weekKey||currentMonday(),-7);
  isDirty=false;
  refreshWeeklyMenu().catch(error=>console.error(error));
 });
 $("#weekly-next").addEventListener("click",()=>{
  if(!checkUnsaved())return;
  $("#weekly-monday").value=plusDays(weekKey||currentMonday(),7);
  isDirty=false;
  refreshWeeklyMenu().catch(error=>console.error(error));
 });
 $("#weekly-monday").addEventListener("change",()=>{
  if(!checkUnsaved()){$("#weekly-monday").value=weekKey;return;}
  isDirty=false;
  refreshWeeklyMenu().catch(error=>console.error(error));
 });
 $("#weekly-copy-day").addEventListener("click",()=>{
  if(dayIndex===0){
   if(!confirm("Replace Tuesday–Friday with Monday's product selections?"))return;
   for(let day=1;day<5;day++)daysSelected[day]=new Set(daysSelected[0]);
  }else{
   if(!confirm("Replace "+days[dayIndex]+"'s products with Monday's menu?"))return;
   daysSelected[dayIndex]=new Set(daysSelected[0]);
  }
  renderProducts();
  isDirty=true;
  setStatus("Unsaved changes.");
 });
 $("#weekly-save").addEventListener("click",()=>saveWeeklyMenu(true));
 $("#weekly-save-draft").addEventListener("click",()=>saveWeeklyMenu(false));
}

// Loads the chosen week only; products are reused by ID, never duplicated.
export async function refreshWeeklyMenu(){
 if(isDirty){setStatus("Unsaved weekly changes. Save the plan before refreshing.");return;}
 const input=$("#weekly-monday");
 const normalized=mondayOf(input.value||currentMonday());
 if(!normalized){setStatus("Choose a valid date.",true);return;}
 input.value=normalized;
 const current=++requestVersion;
 const save=$("#weekly-save");
 isLoading=true;save.disabled=true;
 setStatus("Loading weekly menu…");
 try{
  const snapshots=await Promise.all(Array.from({length:5},(_,i)=>getDoc(doc(db,"menuDays",plusDays(normalized,i)))));
  if(current!==requestVersion)return;
  weekKey=normalized;
  isDirty=false;
  daysSelected=snapshots.map(snapshot=>new Set(
   Array.isArray(snapshot.data()?.itemIds)?snapshot.data().itemIds.filter(id=>typeof id==="string"):[]
  ));
  isPublished=snapshots.length>0 && snapshots.every(snapshot=>snapshot.exists()&&snapshot.data().published===true);
  $("#weekly-published").checked=isPublished;
  dayIndex=0;
  $("#weekly-search").value="";
  renderProducts();
  setStatus(snapshots.some(snapshot=>snapshot.exists())?
    "Loaded saved weekly menu." : "New week — choose dishes and save your plan.");
 }catch(error){
  console.error("Unable to load weekly menu:",error);
  setStatus("Cannot load the weekly menu. Check your connection and Firestore rules.",true);
 }finally{
  if(current===requestVersion){isLoading=false;save.disabled=false;}
 }
}
async function saveWeeklyMenu(publish){
 if(isLoading||!weekKey)return;
 const eligible=new Set(eligibleProducts().map(d=>d.id));
 for(let i=0;i<5;i++){
  for(const id of daysSelected[i]){
   if(!eligible.has(id)){
    dayIndex=i;
    renderProducts();
    setStatus(days[i]+" includes an inactive or unpriced product. Remove it or activate it in the product catalog.",true);
    return;
   }
  }
 }
 if(publish && daysSelected.every(set=>set.size===0)){
  setStatus("Select at least one product before publishing an empty week.",true);return;
 }
 if(publish && !confirm("Show this weekly menu to customers? Ordering remains controlled by the administrator."))return;
 if(!publish && isPublished && !confirm("Hide this week's menu from customers and save it for later?"))return;
 const button=publish?$("#weekly-save"):$("#weekly-save-draft");
 $("#weekly-save").disabled=true;
 $("#weekly-save-draft").disabled=true;
 button.textContent="Saving…";
 try{
  const batch=writeBatch(db);
  for(let i=0;i<5;i++){
   batch.set(doc(db,"menuDays",dayKey(i)),{
    weekStart:weekKey,itemIds:[...daysSelected[i]],
    published:publish,updatedAt:serverTimestamp()
   });
  }
  await batch.commit();
  isDirty=false;
  isPublished=publish;
  $("#weekly-published").checked=publish;
  setStatus(publish?"Your weekly menu is now visible to customers.":"Saved for later. Customers cannot see this menu yet.");
  msg("Weekly menu saved.",true);
  window.dispatchEvent(new Event("ems-workspace-menu-updated"));
 }catch(error){
  console.error("Could not save weekly menu:",error);
  setStatus("Could not save this plan. Verify the new Firestore rules are published.",true);
 }finally{
  $("#weekly-save").disabled=false;
  $("#weekly-save-draft").disabled=false;
  $("#weekly-save").textContent="Publish this week's menu";
  $("#weekly-save-draft").textContent="Save for later";
 }
}
