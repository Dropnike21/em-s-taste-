import {db,$,esc,peso,msg} from "./shared.js";
import {collection,doc,getDocs,setDoc,query,where,limit} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
let dishes=[];
export function menuItems(){return dishes;}
export async function refreshMenu(){
  const snapshot=await getDocs(collection(db,"menu"));
  dishes=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  $("#stat-items").textContent=dishes.length;
  $("#admin-dishes").innerHTML=dishes.length?dishes.map(d=>'<div class="admin-dish"><span><strong>'+esc(d.name)+'</strong><small>'+peso(d.price)+' · '+esc(d.category==="sides"?"Rice & extras":"Ulam")+'</small><small class="availability '+(d.available?"":"unavailable")+'">'+(d.available?"● Available":"○ Unavailable")+'</small></span><button type="button" data-edit="'+esc(d.id)+'">Edit</button></div>').join(""):'<p class="muted">No saved dishes yet.</p>';
}
function resetDish(){
  $("#dish-form").reset();$("#dish-id").value="";
  $("#dish-available").checked=true;$("#dish-form-title").textContent="Add a menu item";
}
export function initMenu(){
  $("#cancel-edit").addEventListener("click",resetDish);
  $("#admin-dishes").addEventListener("click",event=>{
    const btn=event.target.closest("[data-edit]");if(!btn)return;
    const dish=dishes.find(x=>x.id===btn.dataset.edit);if(!dish)return;
    $("#dish-id").value=dish.id;
    $("#dish-name").value=dish.name||"";
    $("#dish-description").value=dish.description||"";
    $("#dish-price").value=dish.price||"";
    $("#dish-category").value=dish.category==="sides"?"sides":"ulam";
    $("#dish-tag").value=dish.tag||"";
    $("#dish-image").value=dish.image||"";
    $("#dish-available").checked=dish.available===true;
    $("#dish-form-title").textContent="Edit "+dish.name;
    $("#dish-form").scrollIntoView({behavior:"smooth"});
  });
  $("#dish-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const name=$("#dish-name").value.trim(),price=Number($("#dish-price").value);
    if(!name||!Number.isInteger(price)||price<1||price>5000){msg("Enter a dish name and a whole-peso price from ₱1 to ₱5,000.");return;}
    const id=$("#dish-id").value||((name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,35)||"dish")+"-"+crypto.randomUUID().slice(0,8));
    const data={name,price,category:$("#dish-category").value,description:$("#dish-description").value.trim(),tag:$("#dish-tag").value.trim(),available:$("#dish-available").checked,palette:"coral"};
    const image=$("#dish-image").value.trim();
    if(image)data.image=image;
    $("#save-dish").disabled=true;
    try{await setDoc(doc(db,"menu",id),data);await refreshMenu();resetDish();msg("Menu item saved.",true);}
    catch(e){console.error(e);msg("Menu change failed; verify your staff permissions.");}
    finally{$("#save-dish").disabled=false;}
  });
}
export async function refreshSuggestions(){
  const el=$("#staff-menu-suggestions");if(!el)return;
  try{
    const snap=await getDocs(query(collection(db,"feedback"),where("type","==","menu_request"),limit(30)));
    const tickets=snap.docs.map(x=>x.data());
    el.innerHTML=tickets.length?tickets.map(x=>'<div class="insight-row"><span>'+esc(x.message)+'</span></div>').join(""):'<p class="muted">No menu suggestions yet.</p>';
  }catch(e){console.error(e);el.innerHTML='<p class="muted">Suggestions unavailable; verify rules.</p>';}
}
