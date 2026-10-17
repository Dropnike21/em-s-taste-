import { auth, db } from "./firebase-config.js";
import { getWorkspaceRole } from "./ui/roles.js";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup,
  signOut, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  collection, getDocs, getDoc, doc, setDoc, query, where, limit,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const state = {
  ready: false, error: null, settings: null, items: [], catalog: [], weeklyPreview: [],
  plannedDay: false, usingLiveMenu: false,
  authReady: false, customer: null, workspaceRole: null, orders: [], reviews: [], accountError: null
};
window.EMS_LIVE_STATE = state;
const notify = () => window.dispatchEvent(new CustomEvent("ems-data"));
const isoDate = date => date.toISOString().slice(0, 10);
const validGoogle = async user => {
  if (!user || !user.emailVerified) return false;
  const result = await getIdTokenResult(user);
  return result.claims?.firebase?.sign_in_provider === "google.com";
};

// Customers order for the service day following the next eligible cutoff.
function serviceDateKey(){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
  timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",hourCycle:"h23"
 }).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const today=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)));
 const eligible=[0,1,2,3,4].includes(today.getUTCDay())&&Number(p.hour)<23;
 if(!eligible){
  do{today.setUTCDate(today.getUTCDate()+1);}
  while(![0,1,2,3,4].includes(today.getUTCDay()));
 }
 today.setUTCDate(today.getUTCDate()+1);
 return isoDate(today);
}
function dayKeysFor(dateKey){
 const monday=new Date(dateKey+"T00:00:00.000Z");
 monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 return Array.from({length:5},(_,day)=>{
  const d=new Date(monday);d.setUTCDate(d.getUTCDate()+day);return isoDate(d);
 });
}
async function refreshMenu() {
  try {
    const [settingsDoc, menuDocs] = await Promise.all([
      getDoc(doc(db, "settings", "storefront")),
      getDocs(collection(db, "menu"))
    ]);
    state.settings = settingsDoc.exists() ? settingsDoc.data() : null;
    const catalog = menuDocs.docs.map(record => ({ ...record.data(), id: record.id }))
      .filter(item => item.archived !== true && item.configured !== false &&
        Number.isInteger(item.price) && item.price > 0);
    state.catalog = catalog;
    state.usingLiveMenu = menuDocs.size > 0;
    state.weeklyPreview = [];
    state.plannedDay = false;
    const serviceKey = serviceDateKey();
    const keys = dayKeysFor(serviceKey);
    try {
      const week = await Promise.all(keys.map(key=>getDoc(doc(db,"menuDays",key))));
      state.weeklyPreview = week.map((snapshot,index)=>({
        dayKey:keys[index],
        exists:snapshot.exists(),
        published:snapshot.exists()&&snapshot.data().published===true,
        itemIds:snapshot.exists()&&Array.isArray(snapshot.data().itemIds)?
          snapshot.data().itemIds:[]
      }));
      const chosen = state.weeklyPreview.find(day=>day.dayKey===serviceKey);
      state.plannedDay = Boolean(chosen?.exists);
      // A saved plan overrides legacy global availability for its particular day.
      state.items = chosen?.exists
        ? catalog.filter(item=>chosen.published && chosen.itemIds.includes(item.id) && item.available===true)
        : catalog;
    } catch (planError) {
      // Older deployed rules may not yet allow reads of menuDays. Keep the
      // pre-existing store behavior working until the new rules are published.
      console.warn("Weekly menu unavailable; showing existing catalog availability:",planError);
      state.items = catalog;
    }
    if (state.usingLiveMenu) {
      window.EMS_MENU = state.items;
      window.EMS_CONFIG.sampleMenu = false;
    }
    state.error = null;
  } catch (error) {
    console.error("Unable to connect Em's Taste to Firestore:", error);
    state.error = "Live menu is unavailable. Please try again later.";
  } finally {
    state.ready = true;
    notify();
  }
}

async function syncAccount(user) {
  if (!user) {
    state.workspaceRole = null;
    state.customer = null;
    state.accountError = null;
    state.orders = [];
    state.reviews = [];
    state.authReady = true;
    notify();
    return;
  }
  try {
    if (!await validGoogle(user)) {
      throw new Error("Please sign in using your Google account.");
    }
    const ref = doc(db, "customers", user.uid);
    let snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      // A Firebase UID is not sufficient for ordering; a profile is required too.
      // A customer cannot make themselves an administrator or unblock themselves.
      const profile = {
        displayName: (user.displayName || "Customer").slice(0, 80),
        email: user.email,
        blocked: false,
        createdAt: serverTimestamp()
      };
      await setDoc(ref, profile);
      snapshot = await getDoc(ref);
    }
    state.customer = {
      uid: user.uid, displayName: snapshot.data().displayName,
      email: snapshot.data().email, blocked: snapshot.data().blocked === true
    };
    state.accountError = null;
    // Role badges and workspace links are derived from trusted Firestore records.
    // Failure to read an optional team role must not block normal customer access.
    try {
      state.workspaceRole = await getWorkspaceRole(user);
    } catch (roleError) {
      console.warn("Could not determine workspace role:", roleError);
      state.workspaceRole = null;
    }
    await loadCustomerRecords();
  } catch (error) {
    console.error("Customer account unavailable:", error);
    state.customer = null;
    state.workspaceRole = null;
    state.accountError = error.message || "Could not load your customer account.";
    state.orders = [];
    state.reviews = [];
  } finally {
    state.authReady = true;
    notify();
  }
}

async function loadCustomerRecords() {
  if (!state.customer?.uid) return;
  const uid = state.customer.uid;
  const [orderDocs, reviewDocs] = await Promise.all([
    getDocs(query(collection(db, "orders"), where("customerUid", "==", uid), limit(50))),
    getDocs(query(collection(db, "reviews"), where("customerUid", "==", uid), limit(50)))
  ]);
  state.orders = orderDocs.docs.map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  state.reviews = reviewDocs.docs.map(item => ({ id: item.id, ...item.data() }));
}

window.EMS_GOOGLE_SIGNIN = async () => {
  if (state.customer) return;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
  // The onAuthStateChanged listener loads or creates the customer's profile.
};
window.EMS_SIGNOUT = () => signOut(auth);
window.EMS_ACCOUNT_REFRESH = async () => {
  if (!auth.currentUser) return;
  await syncAccount(auth.currentUser);
};

window.EMS_SUBMIT = async ({ name, workplace, note, items, total, serviceDate }) => {
  const customer = state.customer;
  if (!auth.currentUser || !customer || customer.blocked || customer.uid !== auth.currentUser.uid) {
    throw new Error("Please sign in with a valid Google customer account.");
  }
  if (!state.ready || state.error || !state.settings || !state.usingLiveMenu) {
    throw new Error("Online ordering is not configured yet.");
  }
  const dayKey = isoDate(serviceDate);
  if (state.settings.ordersOpen !== true ||
      state.settings.menuDayKey !== dayKey ||
      isoDate(state.settings.menuDate?.toDate?.() || new Date(0)) !== dayKey) {
    throw new Error("Ordering is not open for this workday.");
  }
  if (items.length < 1 || items.length > 6) throw new Error("Select up to six different menu items.");
  if (items.reduce((count, item) => count + item.quantity, 0) > 50) throw new Error("Normal requests are limited to 50 servings; choose bulk booking for 51+.");
  const orderId = customer.uid + "_" + dayKey;
  const reference = doc(db, "orders", orderId);
  if (state.orders.some(order => order.id === orderId)) {
    throw new Error("You already have an order for this workday. View it under My orders.");
  }
  // Firestore rules allow CREATE only; updates/overwrites are blocked for customers.
  // Avoid reading a nonexistent private order document (get is owner-restricted).
  const lines = items.map(item => ({
    id: item.id, name: item.name, quantity: item.quantity, unitPrice: item.unitPrice
  }));
  await setDoc(reference, {
    customerUid: customer.uid, customerName: name, workplace, note,
    items: lines, total,
    serviceDay: dayKey, serviceDate: Timestamp.fromDate(serviceDate),
    createdAt: serverTimestamp(), status: "pending"
  });
  await loadCustomerRecords();
  notify();
  return orderId;
};

window.EMS_REVIEW_SUBMIT = async ({ orderId, rating, comment }) => {
  const customer = state.customer;
  if (!customer || customer.blocked || !auth.currentUser) throw new Error("Please sign in with your Google account.");
  const order = state.orders.find(record => record.id === orderId);
  if (!order || order.customerUid !== customer.uid || order.status !== "completed") {
    throw new Error("Only completed orders can be reviewed.");
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 500) {
    throw new Error("Choose a rating from one to five stars and a comment under 500 characters.");
  }
  if (state.reviews.some(record => record.id === orderId)) {
    throw new Error("You have already reviewed this order.");
  }
  await setDoc(doc(db, "reviews", orderId), {
    orderId, customerUid: customer.uid, rating, comment,
    createdAt: serverTimestamp()
  });
  await loadCustomerRecords();
  notify();
};

window.EMS_REFRESH_PUBLIC_MENU = refreshMenu;
onAuthStateChanged(auth, syncAccount);
refreshMenu();
