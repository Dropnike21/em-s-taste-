import { db, $, msg, dateNext } from "./shared.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { menuItems } from "./menu.js";

function philippinesTime() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila", year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", hourCycle: "h23", weekday: "short"
    }).formatToParts(new Date()).map(x => [x.type, x.value])
  );
  return { hour: Number(parts.hour), weekday: parts.weekday };
}

export async function refreshOverview() {
  const state = $("#overview-ordering-state");
  const workday = $("#overview-workday");
  const sync = $("#overview-refresh-time");
  try {
    const snapshot = await getDoc(doc(db, "settings", "storefront"));
    if (!snapshot.exists()) {
      state.textContent = "Ordering not configured";
      state.classList.remove("open");
      workday.textContent = "Select a menu workday in Ordering controls before launching.";
    } else {
      const settings = snapshot.data();
      const menuDate = settings.menuDayKey ||
        settings.menuDate?.toDate?.()?.toISOString().slice(0, 10);
      const { hour, weekday } = philippinesTime();
      const eligible = ["Sun", "Mon", "Tue", "Wed", "Thu"].includes(weekday) && hour < 23;
      const correctDay = menuDate === dateNext();
      const availableCount = menuItems().filter(item => item.available === true).length;
      const available = Boolean(settings.ordersOpen && correctDay && eligible && availableCount > 0);
      state.textContent = available ? "Online pre-orders open" :
        settings.ordersOpen ? "Ordering paused by schedule" : "Online pre-orders closed";
      state.classList.toggle("open", available);
      workday.textContent = "Configured meal date: " + (menuDate || "Not set") +
        " · " + menuItems().filter(item => item.available === true).length + " available menu items";
    }
    sync.textContent = "Updated " + new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true
    }).format(new Date()) + " PH";
  } catch (error) {
    console.error("Unable to refresh storefront status:", error);
    state.textContent = "Cannot retrieve ordering status";
    state.classList.remove("open");
    workday.textContent = "Check the Firebase connection or permissions.";
    sync.textContent = "Some data unavailable";
    throw error;
  }
}
