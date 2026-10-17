import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, Timestamp, query, orderBy, limit, getCountFromServer } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $ = s => document.querySelector(s);
const money = v => new Intl.NumberFormat("en-PH", {style:"currency", currency:"PHP"}).format(Number(v)||0);
const escapeHtml = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let menu = [], orders = [], customers = [], reviews = [], authorized = false;
const message = (s, good=false) => { $("#page-message").textContent = s; $("#page-message").classList.toggle("good",good); };
const canEdit = () => authorized && !!auth.currentUser;
function phNextWorkday() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  const d = new Date(Date.UTC(+p.year,+p.month-1,+p.day+1));
  while ([0,6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
}
function showLogin() { authorized=false; $("#login-view").hidden=false; $("#dashboard-view").hidden=true; $("#sign-out").hidden=true; }
function showDashboard() { authorized=true; $("#login-view").hidden=true; $("#dashboard-view").hidden=false; $("#sign-out").hidden=false; }
onAuthStateChanged(auth, async user => {
  if (!user) { showLogin(); return; }
  try {
    // Require Google as the authentication method, not merely a linked provider.
    const token = await getIdTokenResult(user);
    if (token.claims?.firebase?.sign_in_provider !== "google.com") {
      showLogin();
      message("This dashboard requires Google sign-in. Please continue with Google.");
      await signOut(auth);
      return;
    }
    const access = await getDoc(doc(db, "admins", user.uid));
    if (!access.exists() || access.data().active !== true) {
      showLogin();
      // An admin must manually create this UID in the Firestore allowlist.
      // Show only the currently signed-in person's UID, not other accounts.
      message("Google sign-in succeeded, but access isn't approved yet. Your Firebase UID is: " + user.uid + ". Ask the business owner to approve it in Firestore.");
      await signOut(auth);
      return;
    }
    showDashboard();
    message("Signed in with Google as " + (user.displayName || "authorized administrator") + ".", true);
    await refresh();
  } catch (err) {
    showLogin();
    console.error(err);
    message("Could not verify access. Make sure the Google provider, Firestore, and the published rules are configured.");
  }
});
$("#google-login").addEventListener("click", async () => {
  const button = $("#google-login");
  button.disabled = true;
  message("Opening Google sign-in…");
  try {
    const provider = new GoogleAuthProvider();
    // Popup avoids cross-origin redirect storage issues on GitHub Pages.
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
      message("Google sign-in was cancelled.");
    } else if (err.code === "auth/popup-blocked") {
      message("Your browser blocked the Google window. Allow popups for this site, then try again.");
    } else if (err.code === "auth/operation-not-allowed") {
      message("Google sign-in isn't enabled yet in Firebase Authentication.");
    } else if (err.code === "auth/unauthorized-domain") {
      message("This site domain must be added under Firebase Authentication → Authorized domains.");
    } else if (err.code === "auth/account-exists-with-different-credential") {
      message("A Firebase account already uses this email with another sign-in method. The owner must link Google to that account or authorize the new Google UID.");
    } else {
      message("Google sign-in failed. Check Firebase's Google provider settings and your browser.");
    }
  } finally {
    button.disabled = false;
  }
});
$("#sign-out").addEventListener("click",async()=>{await signOut(auth);message("Signed out.",true);});
$("#refresh-dashboard").addEventListener("click",refresh);
async function refresh() {
  if(!canEdit())return;
  message("Refreshing dashboard…");
  try {
    await Promise.all([loadMenu(),loadOrders(),loadSettings(),loadCustomers(),loadReviews()]);
    $("#stat-items").textContent=menu.length;
    $("#stat-pending").textContent=orders.filter(x=>x.status==="pending").length;
    $("#stat-total").textContent=money(orders.filter(x=>x.status!=="cancelled").reduce((s,x)=>s+(Number(x.total)||0),0));
    updateInsights();
    message("Dashboard loaded. Displays up to 100 recent orders.",true);
  }catch(err){console.error(err);message("Could not read Firestore. Publish the security rules and authorize this administrator.");}
}
async function loadMenu() {
  const snap=await getDocs(collection(db,"menu"));
  menu=snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  $("#admin-dishes").innerHTML=menu.map(x=>'<div class="admin-dish"><span><strong>'+escapeHtml(x.name)+'</strong><small>'+money(x.price)+' · '+(x.category==="sides"?"Rice & extras":"Ulam")+'</small><small class="availability '+(x.available?"":"unavailable")+'">'+(x.available?"● Available":"○ Unavailable")+'</small></span><button type="button" data-edit="'+escapeHtml(x.id)+'">Edit</button></div>').join("") || '<p class="muted">No dishes yet. Add your first menu item.</p>';
}
function clearDish() {
  $("#dish-form").reset(); $("#dish-id").value="";
  $("#dish-form-title").textContent="Add a menu item";
  $("#dish-available").checked=true;
}
$("#cancel-edit").addEventListener("click",clearDish);
$("#admin-dishes").addEventListener("click",e=>{
  const btn=e.target.closest("[data-edit]"); if(!btn)return;
  const x=menu.find(m=>m.id===btn.dataset.edit); if(!x)return;
  $("#dish-id").value=x.id; $("#dish-name").value=x.name||"";
  $("#dish-description").value=x.description||""; $("#dish-price").value=x.price||"";
  $("#dish-category").value=x.category==="sides"?"sides":"ulam"; $("#dish-tag").value=x.tag||"";
  $("#dish-image").value=x.image||""; $("#dish-available").checked=x.available===true;
  $("#dish-form-title").textContent="Edit "+x.name;
  $("#dish-form").scrollIntoView({behavior:"smooth",block:"start"});
});
$("#dish-form").addEventListener("submit",async e=>{
  e.preventDefault(); if(!canEdit())return;
  const name=$("#dish-name").value.trim(),price=Number($("#dish-price").value);
  if(name.length<1||name.length>100||!Number.isInteger(price)||price<1||price>5000){
    message("Provide a name and a whole-peso price between ₱1 and ₱5,000.");return;
  }
  const id=$("#dish-id").value || ((name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,38)||"dish")+"-"+Math.random().toString(36).slice(2,10));
  const dish={name,price,category:$("#dish-category").value,description:$("#dish-description").value.trim(),
    tag:$("#dish-tag").value.trim(),available:$("#dish-available").checked,palette:"coral"};
  const image=$("#dish-image").value.trim(); if(image)dish.image=image;
  $("#save-dish").disabled=true;
  try {
    await setDoc(doc(db,"menu",id),dish);
    clearDish();await loadMenu();
    $("#stat-items").textContent=menu.length;
    message("Dish saved.",true);
  } catch(err) {console.error(err);message("Could not save dish. Check your admin permissions.");}
  finally {$("#save-dish").disabled=false;}
});
async function loadSettings() {
  const snap=await getDoc(doc(db,"settings","storefront")),s=snap.exists()?snap.data():{};
  $("#orders-open").checked=s.ordersOpen===true;
  $("#menu-service-date").value=s.menuDate?.toDate?s.menuDate.toDate().toISOString().slice(0,10):phNextWorkday();
}
$("#settings-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!canEdit())return;
  const dateString=$("#menu-service-date").value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateString)){message("Choose a workday.");return;}
  const date=new Date(dateString+"T00:00:00Z");
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==dateString||[0,6].includes(date.getUTCDay())){
    message("Please choose a valid Monday–Friday date.");return;
  }
  try {
    await setDoc(doc(db,"settings","storefront"),{menuDate:Timestamp.fromDate(date),menuDayKey:dateString,ordersOpen:$("#orders-open").checked,updatedAt:serverTimestamp()});
    message("Menu workday and order switch saved.",true);
  } catch(err){console.error(err);message("Cannot save settings.");}
});
async function loadOrders() {
  const snap=await getDocs(query(collection(db,"orders"),orderBy("createdAt","desc"),limit(100)));
  orders=snap.docs.map(x=>({id:x.id,...x.data()}));
  $("#orders-list").innerHTML=orders.map(o=>{
    const date=o.serviceDate?.toDate?.()?.toISOString().slice(0,10)||"—";
    const lines=Array.isArray(o.items)?o.items:[];
    const options=["pending","confirmed","completed","cancelled"].map(s=>'<option value="'+s+'" '+(o.status===s?"selected":"")+'>'+s+'</option>').join("");
    return '<article class="order-card"><div class="order-header"><div><h3>'+escapeHtml(o.customerName)+'</h3><span class="order-id">Order #'+escapeHtml(o.id.slice(0,12))+'</span></div><span class="order-status '+escapeHtml(o.status)+'">'+escapeHtml(o.status)+'</span></div><div class="order-body"><p><strong>Workplace:</strong> '+escapeHtml(o.workplace)+'</p><p><strong>For:</strong> '+date+'</p><p><strong>Note:</strong> '+escapeHtml(o.note||"—")+'</p></div><div class="order-lines">'+lines.map(x=>'<div>'+escapeHtml(x.quantity)+' × '+escapeHtml(x.name)+' — '+money(x.unitPrice*x.quantity)+'</div>').join("")+'</div><p class="order-total">'+money(o.total)+'</p><div class="order-actions"><label for="status-'+o.id+'">Status:</label><select id="status-'+o.id+'">'+options+'</select><button type="button" data-save-status="'+o.id+'">Save</button></div></article>';
  }).join("")||'<p class="muted">No customer order requests yet.</p>';
}
$("#orders-list").addEventListener("click",async e=>{
  const btn=e.target.closest("[data-save-status]");if(!btn||!canEdit())return;
  const id=btn.dataset.saveStatus,select=document.getElementById("status-"+id);
  if(!select||!["pending","confirmed","completed","cancelled"].includes(select.value))return;
  btn.disabled=true;
  try {await updateDoc(doc(db,"orders",id),{status:select.value,reviewedAt:serverTimestamp()});
    await loadOrders();$("#stat-pending").textContent=orders.filter(o=>o.status==="pending").length;
    message("Order status saved. Contact the customer separately to confirm.",true);
  } catch(err){console.error(err);message("Could not update order status.");btn.disabled=false;}
});
function csvCell(value) {
  let x=String(value??"");if(/^[=+\-@\t\r]/.test(x))x="'"+x;
  return '"'+x.replace(/"/g,'""')+'"';
}
$("#export-csv").addEventListener("click",()=>{
  if(!canEdit()||!orders.length){message("No orders to export.");return;}
  const rows=[["Order ID","Customer","Workplace","Workday","Status","Items","Note","Total"]]
    .concat(orders.map(o=>[o.id,o.customerName,o.workplace,o.serviceDate?.toDate?.()?.toISOString().slice(0,10)||"",o.status,(o.items||[]).map(i=>i.quantity+"x "+i.name).join("; "),o.note,o.total]));
  const blob=new Blob(["\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ems-taste-orders.csv";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  message("CSV exported. Store customer information securely.",true);
});
async function loadCustomers() {
  const [profiles, count] = await Promise.all([
    getDocs(query(collection(db, "customers"), limit(100))),
    getCountFromServer(collection(db, "customers"))
  ]);
  customers = profiles.docs.map(item => ({ uid: item.id, ...item.data() }));
  $("#stat-customers").textContent = count.data().count;
  $("#customer-directory").innerHTML = customers.length
    ? customers.map(customer => '<div class="customer-directory-item">' +
        '<div><strong>' + escapeHtml(customer.displayName) + '</strong>' +
        '<small>' + escapeHtml(customer.email) + '</small>' +
        '<small>' + (customer.blocked ? "Account blocked" : "Active") + '</small></div>' +
        '<button type="button" data-block-customer="' + escapeHtml(customer.uid) + '"' +
        ' class="button button-outline">' + (customer.blocked ? "Unblock" : "Block") + '</button>' +
      '</div>').join("")
    : '<p class="muted">There are no customer profiles yet.</p>';
}
async function loadReviews() {
  const snapshot = await getDocs(query(collection(db, "reviews"), limit(100)));
  reviews = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    .sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
}
function updateInsights() {
  const counts = new Map();
  orders.filter(o=>o.status!=="cancelled").forEach(order => {
    (order.items || []).forEach(item => {
      const name = String(item.name || "Unnamed dish");
      counts.set(name, (counts.get(name)||0) + Number(item.quantity || 0));
    });
  });
  const popular = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
  $("#top-dishes").innerHTML = popular.length
    ? popular.map(([dish,quantity])=>'<div class="insight-row"><strong>'+escapeHtml(dish)+'</strong><span>'+quantity+' servings</span></div>').join("")
    : '<p class="muted">No order data yet.</p>';
  const avg = reviews.length ? reviews.reduce((n,x)=>n+Number(x.rating||0),0)/reviews.length : null;
  $("#rating-average").textContent = avg === null ? "No ratings yet" : avg.toFixed(1)+" / 5 · "+reviews.length+" review(s)";
  $("#customer-feedback").innerHTML = reviews.length
    ? reviews.slice(0,30).map(item=>'<div class="feedback-line"><strong>'+Number(item.rating)+' / 5 ★</strong> <small>Order '+escapeHtml(item.orderId?.slice(-15)||"")+'</small><p>'+escapeHtml(item.comment || "Rating only")+'</p></div>').join("")
    : '<p class="muted">Customers can leave one private review after staff marks their order completed.</p>';
}
$("#customer-directory").addEventListener("click", async event => {
  const button = event.target.closest("[data-block-customer]");
  if(!button || !canEdit())return;
  const customer = customers.find(item=>item.uid===button.dataset.blockCustomer);
  if(!customer)return;
  const action = customer.blocked ? "unblock" : "block";
  if(!window.confirm("Are you sure you want to "+action+" this customer account?"))return;
  button.disabled=true;
  try {
    await updateDoc(doc(db, "customers", customer.uid), { blocked: !customer.blocked });
    await loadCustomers();
    message("Customer account updated. This affects new orders and feedback.",true);
  } catch(err){
    console.error(err);
    message("Unable to update customer account.");
    button.disabled=false;
  }
});

document.querySelectorAll("[data-panel]").forEach(tab=>tab.addEventListener("click",()=>{
  document.querySelectorAll("[data-panel]").forEach(b=>{
    const active=b===tab;b.classList.toggle("active",active);
    b.setAttribute("aria-selected",String(active));
    document.getElementById(b.dataset.panel).hidden=!active;
  });
}));
$("#year").textContent=new Date().getFullYear();
