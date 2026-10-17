import { db } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, addDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const state = {
  ready: false, error: null, settings: null, items: [], usingLiveMenu: false
};
window.EMS_LIVE_STATE = state;
const notify = () => window.dispatchEvent(new CustomEvent("ems-data"));
const isoDate = date => date.toISOString().slice(0, 10);

async function refresh() {
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
    state.error = error.message || "Firestore is not ready";
  } finally {
    state.ready = true;
    notify();
  }
}

window.EMS_SUBMIT = async ({ name, workplace, note, items, total, serviceDate }) => {
  if (!state.ready || state.error || !state.settings || !state.usingLiveMenu) {
    throw new Error("Online ordering is not configured yet.");
  }
  if (state.settings.ordersOpen !== true || isoDate(state.settings.menuDate?.toDate?.() || new Date(0)) !== isoDate(serviceDate)) {
    throw new Error("Ordering is not open for the selected workday.");
  }
  if (items.length < 1 || items.length > 6) throw new Error("Select between 1 and 6 different menu items.");
  const lines = items.map(item => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice
  }));
  const ref = await addDoc(collection(db, "orders"), {
    customerName: name,
    workplace,
    note,
    items: lines,
    total,
    serviceDate: Timestamp.fromDate(serviceDate),
    createdAt: serverTimestamp(),
    status: "pending"
  });
  return ref.id;
};

refresh();
