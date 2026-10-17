import {db,$,esc,peso,msg} from "./shared.js";
import {collection,doc,getDocs,setDoc,updateDoc,runTransaction,query,where,limit}
 from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import {FILIPINO_DISHES} from "./filipino-dishes.js";
import {findFoodPhotos} from "./photos.js";

let dishes=[];
let photoOptions=[];
let photoRequest=0;
const byPreset=new Map(FILIPINO_DISHES.map(d=>[d.id,d]));
export const allProducts=()=>dishes.slice();
export const menuItems=()=>dishes.filter(d=>d.archived!==true);
export const eligibleProducts=()=>menuItems().filter(d=>d.available===true&&
 Number.isInteger(d.price)&&d.price>0&&d.configured!==false);
const archived=d=>d.archived===true;
const ready=d=>eligibleProducts().some(item=>item.id===d.id);
const presetMatch=p=>dishes.find(d=>d.presetId===p.id)||
 dishes.find(d=>d.name?.trim().toLowerCase()===p.name.toLowerCase());
function templates(){
 const select=$("#dish-template"),value=select.value;
 const groups=[...new Set(FILIPINO_DISHES.map(d=>d.group))];
 select.innerHTML='<option value="">Choose a familiar dish…</option>'+
  groups.map(g=>'<optgroup label="'+esc(g)+'">'+FILIPINO_DISHES.filter(d=>d.group===g)
   .map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+
    (presetMatch(d)?" · saved":"")+'</option>').join("")+'</optgroup>').join("");
 if(byPreset.has(value))select.value=value;
}
function photoUrl(d){
 const url=d.image||"";
 return typeof url==="string"&&/^https:\/\//.test(url)?url:"";
}
function card(d){
 const live=ready(d),hasPrice=Number.isInteger(d.price)&&d.price>0;
 const photo=photoUrl(d);
 const price=hasPrice?peso(d.price):"Price not set";
 const status=archived(d)?"Archived":live?"Ready":hasPrice?"Paused":"Needs price";
 return '<article class="simple-dish-card" data-product-card="'+esc(d.id)+'">'+
  '<div class="simple-dish-photo">'+(photo?
   '<img src="'+esc(photo)+'" alt="'+esc(d.name)+'" loading="lazy" referrerpolicy="no-referrer">':
   '<div class="simple-photo-empty" aria-label="No photo yet">🍲</div>')+'</div>'+
  '<div class="simple-dish-info"><strong>'+esc(d.name)+'</strong>'+
  '<span class="simple-dish-price">'+esc(price)+'</span>'+
  '<span class="simple-dish-status '+(live?"is-ready":"")+'">'+status+'</span></div>'+
  '<div class="simple-dish-buttons">'+
    '<button type="button" class="button button-primary" data-quick-price="'+esc(d.id)+'">'+
    (hasPrice?"Change price":"Set price")+'</button>'+
    (archived(d)?'<button type="button" data-archive="'+esc(d.id)+'">Restore</button>':
      '<button type="button" data-quick-toggle="'+esc(d.id)+'">'+(live?"Pause":"Ready to sell")+'</button>')+
    '<button type="button" data-photo="'+esc(d.id)+'">Picture</button>'+
  '</div><form class="simple-price-form" data-price-form="'+esc(d.id)+'" hidden>'+
  '<label>Price in pesos <input type="number" min="1" max="5000" step="1" required value="'+
   (hasPrice?esc(d.price):"")+'" placeholder="e.g. 120"></label>'+
  '<button type="submit" class="button button-primary">Save price</button>'+
  '<button type="button" data-cancel-price>Cancel</button></form>'+
  '<details class="simple-dish-more"><summary>More</summary>'+
  '<button type="button" data-edit="'+esc(d.id)+'">Edit details</button>'+
  (!archived(d)?'<button type="button" data-archive="'+esc(d.id)+'">Archive dish</button>':"")+
  '</details></article>';
}
function render(){
 const value=$("#dish-list-filter").value;
 const list=dishes.filter(d=>value==="all"||(value==="archived"?archived(d):!archived(d)));
 $("#stat-items").textContent=menuItems().length;
 const remaining=FILIPINO_DISHES.filter(p=>!presetMatch(p)).length;
 $("#seed-catalog").hidden=remaining===0;
 $("#seed-catalog").disabled=remaining===0;
 $("#seed-catalog").textContent=remaining===30?"Set up 30 Filipino dishes":
  "Add "+remaining+" more Filipino dishes";
 const drafts=menuItems().filter(d=>!ready(d)).length;
 $("#catalog-seed-status").textContent=dishes.length ?
  eligibleProducts().length+" dishes ready for the weekly menu"+
   (drafts?" · "+drafts+" still need pricing or activation":""):
  "Tap Set up 30 Filipino dishes to begin.";
 $("#admin-dishes").innerHTML=list.length?list.map(card).join(""):
  '<p class="muted">No dishes here yet. Tap the starter dishes button above.</p>';
}
export async function refreshMenu(){
 const snap=await getDocs(collection(db,"menu"));
 dishes=snap.docs.map(r=>({id:r.id,...r.data()}))
  .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 render();templates();
}
function reset(){
 $("#dish-form").reset();
 $("#dish-id").value="";
 $("#dish-template").value="";
 $("#dish-editor").hidden=true;
 $("#dish-available").checked=true;
 $("#dish-image-credit").value="";
 $("#dish-image-license").value="";
 $("#dish-image-license-url").value="";
 $("#dish-image-source").value="";
 $("#photo-chooser").hidden=true;
 $("#dish-photo-preview").hidden=true;
 $("#dish-form-title").textContent="Dish details";
 $("#save-dish").textContent="Save dish";
 $("#dish-editor").querySelectorAll("input,select,textarea,button").forEach(f=>f.disabled=true);
}
function openEditor(){
 $("#catalog-extra").open=true;
 $("#dish-editor").hidden=false;
 $("#dish-editor").querySelectorAll("input,select,textarea,button").forEach(f=>f.disabled=false);
}
function preview(){
 const url=$("#dish-image").value.trim();
 const el=$("#dish-photo-preview");
 if(!/^https:\/\//.test(url)){el.hidden=true;el.textContent="";return;}
 const credit=$("#dish-image-credit").value.trim();
 const license=$("#dish-image-license").value.trim();
 const source=$("#dish-image-source").value.trim();
 el.hidden=false;
 el.innerHTML='<img src="'+esc(url)+'" alt="Dish photo preview">'+
 (source?'<p>Photo: <a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">'+
  esc(credit||"Wikimedia Commons")+'</a> · '+esc(license)+'</p>':"");
}
function fill(d){
 openEditor();
 $("#dish-id").value=d.id||"";
 $("#dish-name").value=d.name||"";
 $("#dish-description").value=d.description||"";
 $("#dish-price").value=d.price||"";
 $("#dish-category").value=d.category==="sides"?"sides":"ulam";
 $("#dish-tag").value=d.tag||"";
 $("#dish-image").value=d.image||"";
 $("#dish-image-credit").value=d.imageCredit||"";
 $("#dish-image-license").value=d.imageLicense||"";
 $("#dish-image-license-url").value=d.imageLicenseUrl||"";
 $("#dish-image-source").value=d.imageSource||"";
 $("#dish-available").checked=d.available===true||!d.id;
 $("#dish-template").value=byPreset.has(d.presetId)?d.presetId:"";
 $("#dish-form-title").textContent=d.id?"Edit "+d.name:"Add "+d.name;
 $("#save-dish").textContent=d.id?"Save changes":"Add dish";
 $("#photo-chooser").hidden=true;
 preview();
}
function choose(id){
 const p=byPreset.get(id);if(!p){reset();return;}
 const existing=presetMatch(p);
 fill(existing||{...p,id:"",presetId:p.id,price:"",available:true});
 $("#dish-template").value=id;
 $("#dish-price").focus();
}
async function showPhotoChoices(){
 const name=$("#dish-name").value.trim();
 if(!name){msg("Choose a dish before selecting a photo.");return;}
 const place=$("#photo-chooser"),button=$("#find-food-photo");
 place.hidden=false;place.textContent="Finding reusable photos…";
 button.disabled=true;
 const request=++photoRequest;
 try{
  const options=await findFoodPhotos(name);
  if(request!==photoRequest)return;
  photoOptions=options;
  place.innerHTML=options.length?'<p class="muted">Tap a picture you like. Photos are examples and may not exactly match your recipe.</p>'+
   '<div class="photo-choice-grid">'+options.map((pic,i)=>
    '<button type="button" data-photo-choice="'+i+'" class="photo-choice">'+
    '<img src="'+esc(pic.image)+'" loading="lazy" alt="'+esc(pic.title)+'">'+
    '<small>Use this photo</small></button>').join("")+'</div>'+
    '<p class="form-hint">Photos from Wikimedia Commons; source and license credit are saved.</p>':
    '<p class="muted">No suitable licensed photos found. You can paste your own photo link below.</p>';
 }catch(error){
  console.warn("Photo lookup failed",error);
  place.innerHTML='<p class="muted">Free photo search is temporarily unavailable. You can still add a photo later.</p>';
 }finally{button.disabled=false;}
}
export function initMenu(){
 templates();reset();
 $("#seed-catalog").addEventListener("click",seedCatalog);
 $("#dish-list-filter").addEventListener("change",render);
 $("#dish-template").addEventListener("change",event=>choose(event.target.value));
 $("#custom-dish").addEventListener("click",()=>{
  reset();openEditor();$("#dish-form-title").textContent="Add a new dish";
  $("#dish-name").focus();
 });
 $("#cancel-edit").addEventListener("click",()=>{reset();$("#catalog-extra").open=false;});
 $("#find-food-photo").addEventListener("click",showPhotoChoices);
 $("#clear-food-photo").addEventListener("click",()=>{
  for(const id of ["dish-image","dish-image-credit","dish-image-license","dish-image-license-url","dish-image-source"])$("#"+id).value="";
  $("#photo-chooser").hidden=true;preview();
 });
 $("#dish-image").addEventListener("input",()=>{
  for(const id of ["dish-image-credit","dish-image-license","dish-image-license-url","dish-image-source"])$("#"+id).value="";
  preview();
 });
 $("#photo-chooser").addEventListener("click",async event=>{
  const button=event.target.closest("[data-photo-choice]");if(!button)return;
  const pic=photoOptions[Number(button.dataset.photoChoice)];if(!pic)return;
  const existingId=$("#dish-id").value;
  button.disabled=true;
  if(existingId){
   try{
    // Save the chosen photo immediately, independently from other editable fields.
    await updateDoc(doc(db,"menu",existingId),{
     image:pic.image,imageCredit:pic.credit,imageLicense:pic.license,
     imageLicenseUrl:pic.licenseUrl||"",imageSource:pic.source
    });
    await refreshMenu();
    window.dispatchEvent(new Event("ems-workspace-menu-updated"));
    msg("Dish photo saved.",true);
   }catch(error){
    console.error(error);
    msg("Could not save the photo. Please try again.");
    button.disabled=false;return;
   }
  }
  $("#dish-image").value=pic.image;
  $("#dish-image-credit").value=pic.credit;
  $("#dish-image-license").value=pic.license;
  $("#dish-image-license-url").value=pic.licenseUrl||"";
  $("#dish-image-source").value=pic.source;
  $("#photo-chooser").hidden=true;preview();
  if(!existingId)msg("Picture chosen. Save the new dish when ready.",true);
 });
 $("#admin-dishes").addEventListener("click",async event=>{
  const button=event.target.closest("button");if(!button)return;
  const card=button.closest("[data-product-card]");
  const d=dishes.find(item=>item.id===card?.dataset.productCard);
  if(!d)return;
  if(button.hasAttribute("data-quick-price")){
   const form=card.querySelector("[data-price-form]");form.hidden=false;
   form.querySelector("input").focus();return;
  }
  if(button.hasAttribute("data-cancel-price")){
   card.querySelector("[data-price-form]").hidden=true;return;
  }
  if(button.hasAttribute("data-photo")||button.hasAttribute("data-edit")){
   fill(d);
   $("#catalog-extra").scrollIntoView({behavior:"smooth",block:"start"});
   if(button.hasAttribute("data-photo"))showPhotoChoices();
   return;
  }
  if(button.hasAttribute("data-archive")){
   if(!archived(d)&&!confirm('Archive "'+d.name+'"? It will no longer appear in meal selections.'))return;
   button.disabled=true;
   try{
    await updateDoc(doc(db,"menu",d.id),{archived:!archived(d),available:false});
    await refreshMenu();window.dispatchEvent(new Event("ems-workspace-menu-updated"));
    msg(d.name+(archived(d)?" restored.":" archived."),true);
   }catch(error){console.error(error);msg("Could not update this dish.");button.disabled=false;}
   return;
  }
  if(button.hasAttribute("data-quick-toggle")){
   if(!ready(d)&&!(d.price>0)){
    card.querySelector("[data-price-form]").hidden=false;
    card.querySelector("[data-price-form] input").focus();
    return;
   }
   button.disabled=true;
   try{
    await updateDoc(doc(db,"menu",d.id),{available:!d.available,configured:true});
    await refreshMenu();window.dispatchEvent(new Event("ems-workspace-menu-updated"));
    msg(d.name+(d.available?" paused.":" ready for weekly menus."),true);
   }catch(error){console.error(error);msg("Could not change dish availability.");button.disabled=false;}
  }
 });
 $("#admin-dishes").addEventListener("submit",async event=>{
  const form=event.target.closest("[data-price-form]");if(!form)return;
  event.preventDefault();
  const d=dishes.find(item=>item.id===form.dataset.priceForm);
  const price=Number(form.querySelector("input").value);
  if(!d||!Number.isInteger(price)||price<1||price>5000){
   msg("Enter a whole-peso price between ₱1 and ₱5,000.");return;
  }
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{
   await updateDoc(doc(db,"menu",d.id),{price,configured:true,available:!archived(d)});
   await refreshMenu();window.dispatchEvent(new Event("ems-workspace-menu-updated"));
   msg(d.name+" saved at "+peso(price)+". Ready for weekly menus.",true);
  }catch(error){console.error(error);msg("Could not save the price.");button.disabled=false;}
 });
 $("#dish-form").addEventListener("submit",async event=>{
  event.preventDefault();if($("#dish-editor").hidden)return;
  const name=$("#dish-name").value.trim(),price=Number($("#dish-price").value);
  if(!name||name.length>100||!Number.isInteger(price)||price<1||price>5000){
   msg("Enter a dish name and a whole-peso price from ₱1 to ₱5,000.");return;
  }
  const idOld=$("#dish-id").value;
  if(dishes.some(d=>d.id!==idOld&&d.name?.trim().toLowerCase()===name.toLowerCase())){
   msg("That dish already exists. Use its card to edit it.");return;
  }
  const image=$("#dish-image").value.trim();
  if(image){
   try{if(new URL(image).protocol!=="https:")throw Error("HTTPS only");}
   catch{msg("Choose a photo or use an HTTPS photo address.");return;}
  }
  const preset=byPreset.get($("#dish-template").value);
  const previous=dishes.find(d=>d.id===idOld);
  const slug=name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-")
   .replace(/^-|-$/g,"").slice(0,35)||"meal";
  const id=idOld||(preset?"dish-"+preset.id:slug+"-"+crypto.randomUUID().slice(0,8));
  if(!idOld&&dishes.some(d=>d.id===id)){msg("That dish exists. Edit it instead.");return;}
  const data={name,price,category:$("#dish-category").value,
   description:$("#dish-description").value.trim(),tag:$("#dish-tag").value.trim(),
   available:$("#dish-available").checked&&!archived(previous||{}),
   archived:archived(previous||{}),configured:true,palette:previous?.palette||"coral"};
  if(preset||previous?.presetId)data.presetId=preset?.id||previous.presetId;
  if(image){
   data.image=image;
   if($("#dish-image-source").value){
    data.imageSource=$("#dish-image-source").value;
    data.imageCredit=$("#dish-image-credit").value;
    data.imageLicense=$("#dish-image-license").value;
    data.imageLicenseUrl=$("#dish-image-license-url").value;
   }
  }
  const button=$("#save-dish");button.disabled=true;
  try{
   await setDoc(doc(db,"menu",id),data);
   reset();$("#catalog-extra").open=false;
   await refreshMenu();window.dispatchEvent(new Event("ems-workspace-menu-updated"));
   msg(name+" saved.",true);
  }catch(error){console.error(error);msg("Couldn't save dish details.");}
  finally{button.disabled=false;}
 });
}
export async function seedCatalog(){
 const button=$("#seed-catalog");button.disabled=true;
 try{
  await refreshMenu();
  const missing=FILIPINO_DISHES.filter(p=>!presetMatch(p));
  if(!missing.length){msg("All 30 dishes are already in your list.",true);return;}
  if(!confirm("Add "+missing.length+" Filipino dishes now? You can set the price of each dish later."))return;
  const created=await runTransaction(db,async transaction=>{
   const entries=missing.map(p=>({p,ref:doc(db,"menu","dish-"+p.id)}));
   const snaps=await Promise.all(entries.map(x=>transaction.get(x.ref)));
   let n=0;
   for(let i=0;i<entries.length;i++){
    if(snaps[i].exists())continue;
    const {p,ref}=entries[i];
    transaction.set(ref,{
     name:p.name,description:p.description,category:p.category,tag:p.tag,
     price:0,available:false,configured:false,archived:false,
     presetId:p.id,palette:"coral"
    });n++;
   }
   return n;
  });
  await refreshMenu();window.dispatchEvent(new Event("ems-workspace-menu-updated"));
  msg(created+" dishes added. Tap Set price to make each dish ready.",true);
 }catch(error){console.error(error);msg("Could not set up the dishes. Check your connection.");}
 finally{button.disabled=FILIPINO_DISHES.every(p=>presetMatch(p));}
}
export async function refreshSuggestions(){
 const el=$("#staff-menu-suggestions");if(!el)return;
 try{
  const snap=await getDocs(query(collection(db,"feedback"),where("type","==","menu_request"),limit(30)));
  el.innerHTML=snap.docs.length?snap.docs.map(d=>'<div class="insight-row"><span>'+esc(d.data().message)+'</span></div>').join(""):
   '<p class="muted">No meal requests yet.</p>';
 }catch(error){console.error(error);el.innerHTML='<p class="muted">Meal requests unavailable.</p>';}
}
