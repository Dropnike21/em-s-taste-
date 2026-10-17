import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup,
  signOut, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection, getDocs, getDoc, doc, setDoc, query, where, limit,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const state = {
  ready: false, error: null, settings: null, items: [], usingLiveMenu: false,
  authReady: false, customer: null, orders: [], reviews: [], accountError: null
};
window.EMS_LIVE_STATE = state;
const notify = () => window.dispatchEvent(new CustomEvent("ems-data"));
const isoDate = date => date.toISOString().slice(0, 10);
const validGoogle = async user => {
  if (!user || !user.emailVerified) return false;
  const result = await getIdTokenResult(user);
  return result.claims?.firebase?.sign_in_provider === "google.com";
};

async function refreshMenu() {
  try {
    const [settingsDoc, menuDocs] = await Promise.all([
      getDoc(doc(db, "settings", "storefront")),
      getDocs(collection(db, "menu"))
    ]);
    state.settings = settingsDoc.exists() ? settingsDoc.data() : null;
    state.items = menuDocs.docs.map(record => ({ ...record.data(), id: record.id }));
    state.usingLiveMenu = state.items.length > 0;
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
    await loadCustomerRecords();
  } catch (error) {
    console.error("Customer account unavailable:", error);
    state.customer = null;
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
  if (items.reduce((count, item) => count + item.quantity, 0) > 10) throw new Error("There is a limit of ten servings per order.");
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

onAuthStateChanged(auth, syncAccount);
refreshMenu();
