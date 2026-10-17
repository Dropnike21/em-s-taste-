import {db,$,esc,peso,msg} from "./shared.js";
import {collection,doc,getDocs,setDoc,updateDoc,query,where,limit} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import {FILIPINO_DISHES} from "./filipino-dishes.js";

let dishes=[];
const byPreset=new Map(FILIPINO_DISHES.map(d=>[d.id,d]));
export function menuItems(){return dishes.filter(d=>d.archived!==true);}
const archived=d=>d.archived===true;
const presetMatch=p=>dishes.find(d=>d.presetId===p.id)||
  dishes.find(d=>d.name?.trim().toLowerCase()===p.name.toLowerCase());

function templates(){
 const select=$("#dish-template"),selected=select.value;
 const groups=[...new Set(FILIPINO_DISHES.map(d=>d.group))];
 select.innerHTML='<option value="">Choose one of 30 Filipino meals…</option>'+
  groups.map(group=>'<optgroup label="'+esc(group)+'">'+
    FILIPINO_DISHES.filter(d=>d.group===group).map(d=>
      '<option value="'+esc(d.id)+'">'+esc(d.name)+(presetMatch(d)?' · already saved':'')+'</option>'
    ).join("")+'</optgroup>').join("");
 if(byPreset.has(selected))select.value=selected;
}
function render(){
 const filter=$("#dish-list-filter").value;
 const list=dishes.filter(d=>filter==="all"||(filter==="archived"?archived(d):!archived(d)));
 $("#stat-items").textContent=menuItems().length;
 $("#admin-dishes").innerHTML=list.map(d=>
   '<div class="admin-dish"><span><strong>'+esc(d.name)+'</strong><small>'+peso(d.price)+
   ' · '+(d.category==="sides"?"Rice & extras":"Ulam")+'</small>'+
   '<small class="availability '+(!d.available||archived(d)?"unavailable":"")+'">'+
   (archived(d)?"Archived — hidden from customers":d.available?"● Available":"○ Unavailable")+
   '</small></span><div class="dish-actions"><button type="button" data-edit="'+esc(d.id)+'">Edit</button>'+
   (archived(d)?"":'<button type="button" data-availability="'+esc(d.id)+'">'+(d.available?"Pause":"Make available")+'</button>')+
   '<button type="button" data-archive="'+esc(d.id)+'">'+(archived(d)?"Restore":"Archive")+'</button></div></div>'
 ).join("")||'<p class="muted">No meals in this view. Choose a Filipino dish or create a custom meal.</p>';
}
export async function refreshMenu(){
 const snap=await getDocs(collection(db,"menu"));
 dishes=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 render();templates();
}
function reset(){
 $("#dish-form").reset();
 $("#dish-id").value="";
 $("#dish-template").value="";
 $("#dish-available").checked=false;
 $("#dish-editor").hidden=true;
 $("#dish-editor").querySelectorAll("input,select,textarea,button").forEach(field=>{
  field.disabled=true;
 });
 $("#dish-form-title").textContent="Add a menu item";
 $("#save-dish").textContent="Save dish";
}
function fill(d){
 $("#dish-editor").hidden=false;
 $("#dish-editor").querySelectorAll("input,select,textarea,button").forEach(field=>{
  field.disabled=false;
 });
 $("#dish-id").value=d.id||"";
 $("#dish-name").value=d.name||"";
 $("#dish-description").value=d.description||"";
 $("#dish-price").value=d.price||"";
 $("#dish-category").value=d.category==="sides"?"sides":"ulam";
 $("#dish-tag").value=d.tag||"";
 $("#dish-image").value=d.image||"";
 $("#dish-available").checked=d.available===true&&!archived(d);
 $("#dish-template").value=byPreset.has(d.presetId)?d.presetId:"";
 $("#dish-form-title").textContent=d.id?"Edit "+d.name:"Add "+d.name;
 $("#save-dish").textContent=d.id?"Save changes":"Add to saved menu";
}
function choose(id){
 const preset=byPreset.get(id);
 if(!preset){reset();return;}
 const existing=presetMatch(preset);
 if(existing){
  fill(existing);
  $("#dish-template").value=id;
  msg(preset.name+" is already saved. You are editing the existing meal.",true);
 }else{
  reset();fill({...preset,id:"",presetId:preset.id,price:"",available:false});
  $("#dish-template").value=id;
 }
 $("#dish-price").focus();
}
export function initMenu(){
 templates();reset();
 $("#dish-list-filter").addEventListener("change",render);
 $("#dish-template").addEventListener("change",e=>choose(e.target.value));
 $("#custom-dish").addEventListener("click",()=>{
   reset();$("#dish-editor").hidden=false;
   $("#dish-editor").querySelectorAll("input,select,textarea,button").forEach(field=>{field.disabled=false});
   $("#dish-form-title").textContent="Create a custom meal";
   $("#dish-name").focus();
 });
 $("#cancel-edit").addEventListener("click",reset);
 $("#admin-dishes").addEventListener("click",async e=>{
  const a=e.target.closest("[data-archive]");
  const t=e.target.closest("[data-availability]");
  const ed=e.target.closest("[data-edit]");
  const btn=a||t;
  if(btn){
   const dish=dishes.find(d=>d.id===(a?.dataset.archive||t?.dataset.availability));
   if(!dish)return;
   if(a&&!archived(dish)&&!confirm('Archive "'+dish.name+'"? It will be removed from the customer menu but previous orders will remain.'))return;
   if(t&&dish.available&&!confirm('Pause "'+dish.name+'" for new orders?'))return;
   const changes=a?{archived:!archived(dish),available:false}:{available:!dish.available};
   btn.disabled=true;
   try{
    await updateDoc(doc(db,"menu",dish.id),changes);
    await refreshMenu();
    window.dispatchEvent(new Event("ems-workspace-menu-updated"));
    msg(dish.name+(a?(changes.archived?" archived.":" restored as unavailable."):(changes.available?" is available.":" paused.")),true);
   }catch(error){console.error(error);msg("Cannot update this meal. Check staff permissions.");btn.disabled=false;}
   return;
  }
  if(ed){
   const dish=dishes.find(d=>d.id===ed.dataset.edit);
   if(dish){fill(dish);$("#dish-form").scrollIntoView({behavior:"smooth",block:"start"});}
  }
 });
 $("#dish-form").addEventListener("submit",async e=>{
  e.preventDefault();
  if($("#dish-editor").hidden)return;
  const name=$("#dish-name").value.trim(),price=Number($("#dish-price").value);
  if(!name||name.length>100||!Number.isInteger(price)||price<1||price>5000){
   msg("Enter a meal name and a whole-peso price between ₱1 and ₱5,000.");return;
  }
  const currentId=$("#dish-id").value;
  if(dishes.some(d=>d.id!==currentId&&d.name.trim().toLowerCase()===name.toLowerCase())){
   msg("That meal is already saved. Choose Edit instead of creating a duplicate.");return;
  }
  const image=$("#dish-image").value.trim();
  if(image){
   try{if(new URL(image).protocol!=="https:")throw Error("HTTPS required");}
   catch{msg("Use an HTTPS meal photo URL, or leave it blank.");return;}
  }
  const preset=byPreset.get($("#dish-template").value);
  const previous=dishes.find(d=>d.id===currentId);
  const slug=name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,35)||"meal";
  const id=currentId||(preset?"dish-"+preset.id:slug+"-"+crypto.randomUUID().slice(0,8));
  if (!currentId && dishes.some(d => d.id === id)) {
   msg("This saved product ID already exists. Edit that meal instead of overwriting it.");
   return;
  }
  const data={
   name,price,category:$("#dish-category").value,description:$("#dish-description").value.trim(),
   tag:$("#dish-tag").value.trim(),available:$("#dish-available").checked&&!archived(previous||{}),
   archived:archived(previous||{}),palette:"coral"
  };
  if(preset?.id||previous?.presetId)data.presetId=preset?.id||previous.presetId;
  if(image)data.image=image;
  const btn=$("#save-dish");btn.disabled=true;
  try{
   await setDoc(doc(db,"menu",id),data);
   reset();await refreshMenu();
   window.dispatchEvent(new Event("ems-workspace-menu-updated"));
   msg(name+" saved. "+(data.archived?"Restore from Archived before making it available.":data.available?"Available for new orders.":"Set availability when ready."),true);
  }catch(error){console.error(error);msg("Could not save this meal. Verify staff permissions.");}
  finally{btn.disabled=false;}
 });
}
export async function refreshSuggestions(){
 const el=$("#staff-menu-suggestions");if(!el)return;
 try{
  const snap=await getDocs(query(collection(db,"feedback"),where("type","==","menu_request"),limit(30)));
  el.innerHTML=snap.docs.length?snap.docs.map(d=>'<div class="insight-row"><span>'+esc(d.data().message)+'</span></div>').join(""):
   '<p class="muted">No menu suggestions yet.</p>';
 }catch(error){console.error(error);el.innerHTML='<p class="muted">Suggestions unavailable; check published rules.</p>';}
}