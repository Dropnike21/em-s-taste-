import {db,$,esc,peso,msg} from "./shared.js";
import {eligibleProducts,menuItems} from "./menu.js";
import {doc,getDoc,writeBatch,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const days=["Monday","Tuesday","Wednesday","Thursday","Friday"];
let weekKey="";
let dayIndex=0;
let daysSelected=Array.from({length:5},()=>new Set());
let isPublished=false;
let isLoading=false;
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
 const all=menuItems().filter(d=>String(d.name).toLowerCase().includes(query));
 const eligibleIds=new Set(eligibleProducts().map(d=>d.id));
 $("#weekly-products").innerHTML=all.map(d=>{
  const eligible=eligibleIds.has(d.id);
  const checked=selected.has(d.id);
  return '<label class="weekly-product'+(!eligible?" weekly-product-disabled":"")+'">'+
    '<input type="checkbox" data-week-product="'+esc(d.id)+'"'+(checked?" checked":"")+
    (!eligible?" disabled":"")+'><span><strong>'+esc(d.name)+'</strong><small>'+
    (eligible?peso(d.price):"Set a price and activate in Products")+
    '</small></span></label>';
 }).join("") || '<p class="muted">No products match. Set up your catalog in Menu & products first.</p>';
 $("#weekly-copy-day").disabled=dayIndex===0;
}
export function initWeeklyMenu(){
 $("#weekly-monday").value=currentMonday();
 $("#weekly-days").addEventListener("click",event=>{
  const tab=event.target.closest("[data-week-day]");
  if(!tab)return;
  dayIndex=Number(tab.dataset.weekDay);
  renderProducts();
 });
 $("#weekly-products").addEventListener("change",event=>{
  const box=event.target.closest("[data-week-product]");
  if(!box)return;
  if(box.checked)daysSelected[dayIndex].add(box.dataset.weekProduct);
  else daysSelected[dayIndex].delete(box.dataset.weekProduct);
  renderProducts();
  setStatus("");
 });
 $("#weekly-search").addEventListener("input",renderProducts);
 $("#weekly-prev").addEventListener("click",()=>{
  $("#weekly-monday").value=plusDays($("#weekly-monday").value,-7);
  refreshWeeklyMenu().catch(error=>console.error(error));
 });
 $("#weekly-next").addEventListener("click",()=>{
  $("#weekly-monday").value=plusDays($("#weekly-monday").value,7);
  refreshWeeklyMenu().catch(error=>console.error(error));
 });
 $("#weekly-monday").addEventListener("change",()=>{
  refreshWeeklyMenu().catch(error=>console.error(error));
 });
 $("#weekly-copy-day").addEventListener("click",()=>{
  if(dayIndex===0)return;
  if(!confirm("Replace "+days[dayIndex]+"'s selections with Monday's menu?"))return;
  daysSelected[dayIndex]=new Set(daysSelected[0]);
  renderProducts();
  setStatus("");
 });
 $("#weekly-published").addEventListener("change",event=>{
  isPublished=event.target.checked;
  setStatus("");
 });
 $("#weekly-save").addEventListener("click",saveWeeklyMenu);
}

// Loads the chosen week only; products are reused by ID, never duplicated.
export async function refreshWeeklyMenu(){
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
async function saveWeeklyMenu(){
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
 if(isPublished && daysSelected.every(set=>set.size===0)){
  setStatus("Select at least one product before publishing an empty week.",true);return;
 }
 if(isPublished && !confirm("Publish "+weekKey+"'s weekly menu to the customer website? Online ordering still requires administrator approval."))return;
 const button=$("#weekly-save");
 button.disabled=true;button.textContent="Saving…";
 try{
  const batch=writeBatch(db);
  for(let i=0;i<5;i++){
   batch.set(doc(db,"menuDays",dayKey(i)),{
    weekStart:weekKey,itemIds:[...daysSelected[i]],
    published:isPublished,updatedAt:serverTimestamp()
   });
  }
  await batch.commit();
  setStatus(isPublished?"Weekly menu published. Customers see dishes scheduled for their workday.":
   "Weekly plan saved as a draft. Customers cannot see it until published.");
  msg("Weekly menu saved.",true);
  window.dispatchEvent(new Event("ems-workspace-menu-updated"));
 }catch(error){
  console.error("Could not save weekly menu:",error);
  setStatus("Could not save this plan. Verify the new Firestore rules are published.",true);
 }finally{button.disabled=false;button.textContent="Save weekly menu";}
}
