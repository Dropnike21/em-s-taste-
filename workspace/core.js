import { auth, db, $, msg } from "./shared.js";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup,
  signOut, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { initMenu, refreshMenu, refreshSuggestions } from "./menu.js";
import { initOrders, refreshOrders } from "./orders.js";
import { initBulk, refreshBulk } from "./bulk.js";
import { initPrep, refreshPrep } from "./prep.js";
import { initSettings, refreshSettings } from "./settings.js";
import { refreshInsights } from "./insights.js";
import { initPeople, refreshPeople, refreshTeam, clearTeamCache } from "./people.js";
import { initReports, refreshReports } from "./reports.js";
import { refreshOverview } from "./overview.js";

const staffPanels = new Set(["overview-panel", "orders-panel", "bulk-panel", "prep-panel", "menu-panel"]);
const adminPanels = new Set(["settings-panel", "insights-panel", "reports-panel", "team-panel"]);
const panelInfo = {
  "overview-panel": ["Overview", "Your kitchen, at a glance."],
  "orders-panel": ["Orders & payments", "Review incoming requests, track payment status, and update fulfillment."],
  "bulk-panel": ["Large meal requests", "Quote and confirm bookings of 51 or more meals."],
  "prep-panel": ["Kitchen preparation", "Organize confirmed servings by dish and workplace."],
  "menu-panel": ["Menu & products", "Manage food names, descriptions, prices, and availability."],
  "settings-panel": ["Ordering controls", "Configure the next meal workday and preorder availability."],
  "insights-panel": ["Customers & insights", "Review customer activity and completed-meal feedback."],
  "reports-panel": ["Reports & feedback", "Review customer concerns and resolve reported problems."],
  "team-panel": ["Users & roles", "Search registered accounts and assign Customer, Staff, or Administrator access."]
};
let role = null;
let loading = false;
let verifying = false;
let authAttempt = 0;

function setLoginState(text, error = false) {
  const el = $("#login-state");
  el.textContent = text;
  el.classList.toggle("error", error);
}
function showLogin() {
  role = null;
  $("#login-view").hidden = false;
  $("#dashboard-view").hidden = true;
  $("#sign-out").hidden = true;
}
function showHelp(user, reason) {
  const el = $("#admin-access-help");
  el.hidden = false;
  el.open = true;
  $("#admin-help-reason").textContent = reason;
  $("#admin-help-email").textContent = user?.email || "Not signed in";
  $("#admin-help-uid").textContent = user?.uid || "—";
  $("#google-login").textContent = "Continue with another Google account";
  $("#retry-access").hidden = !user;
}
function hideHelp() {
  $("#admin-access-help").hidden = true;
  $("#admin-access-help").open = false;
  $("#google-login").innerHTML = '<span class="google-mark" aria-hidden="true">G</span> Continue with Google';
}
function authorizedPanel(panelId) {
  return Boolean(role && (staffPanels.has(panelId) || (role === "admin" && adminPanels.has(panelId))));
}
function closeMobileNav() {
  $(".workspace-nav-area").classList.remove("mobile-open");
  $("#workspace-mobile-nav").setAttribute("aria-expanded", "false");
}
function activateTab(panelId, changeHistory = false) {
  if (!authorizedPanel(panelId)) return;
  for (const tab of document.querySelectorAll("[data-panel]")) {
    const selected = tab.dataset.panel === panelId;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panel = $("#" + tab.dataset.panel);
    if (panel) panel.hidden = !selected;
  }
  const [title, subtitle] = panelInfo[panelId];
  $("#workspace-page-title").textContent = title;
  $("#workspace-page-desc").textContent = subtitle;
  if (changeHistory) history.replaceState(null, "", "#" + panelId);
  closeMobileNav();
  if (panelId === "team-panel" && role === "admin") {
    refreshTeam().catch(error => console.error("Team directory refresh failed:", error));
  }
  if (window.matchMedia("(max-width: 860px)").matches) {
    $("#workspace-page-title").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
function showDashboard(user, access) {
  role = access;
  $("#login-view").hidden = true;
  $("#dashboard-view").hidden = false;
  $("#sign-out").hidden = false;
  $("#workspace-role").textContent = role === "admin" ? "Administrator" : "Staff member";
  $("#workspace-email").textContent = user.email || "Google account";
  const isAdmin = role === "admin";
  $("#admin-nav-section").hidden = !isAdmin;
  for (const item of document.querySelectorAll("[data-admin-only]")) item.hidden = !isAdmin;
  for (const item of document.querySelectorAll("[data-panel]")) {
    item.hidden = !authorizedPanel(item.dataset.panel);
  }
  const requested = decodeURIComponent(location.hash.replace(/^#/, ""));
  activateTab(authorizedPanel(requested) ? requested : "overview-panel");
}
async function ensureProfile(user) {
  // A customer record makes new Google sign-ins discoverable in Users & roles,
  // even when they first visit the staff portal instead of the storefront.
  // Existing profile fields are never overwritten.
  try {
    const ref = doc(db, "customers", user.uid);
    const existing = await getDoc(ref);
    if (existing.exists()) return;
    const name = (user.displayName || user.email?.split("@")[0] || "Customer").trim().slice(0,80);
    await setDoc(ref, {
      displayName: name || "Customer",
      email: user.email || "",
      createdAt: serverTimestamp(),
      blocked: false
    });
  } catch (error) {
    console.warn("Unable to register user profile; proceeding with normal role check:", error);
  }
}
async function getRole(user) {
  const result = await getIdTokenResult(user);
  if (result.claims?.firebase?.sign_in_provider !== "google.com") return null;
  // Original owner authorization and staff roles are distinct; the customer
  // profile has no bearing on either.
  const owner = await getDoc(doc(db, "admins", user.uid));
  if (owner.exists() && owner.data().active === true) return "admin";
  const team = await getDoc(doc(db, "team", user.uid));
  if (team.exists() && team.data().active === true &&
      ["admin", "staff"].includes(team.data().role)) return team.data().role;
  return null;
}
async function loadAll() {
  if (!role || loading) return;
  loading = true;
  const button = $("#refresh-dashboard");
  button.disabled = true;
  button.textContent = "Refreshing…";
  msg("Refreshing workspace data…", true);
  try {
    const tasks = [
      ["Menu", refreshMenu()],
      ["Orders", refreshOrders()],
      ["Bulk bookings", refreshBulk()],
      ["Menu suggestions", refreshSuggestions()]
    ];
    if (role === "admin") {
      tasks.push(["Ordering controls", refreshSettings()]);
      tasks.push(["Customer directory", refreshPeople()]);
      tasks.push(["Customer reports", refreshReports()]);
    }
    const settled = await Promise.allSettled(tasks.map(([, task]) => task));
    const errors = settled.flatMap((outcome, index) => {
      if (outcome.status === "fulfilled") return [];
      console.error(tasks[index][0] + " failed:", outcome.reason);
      return [tasks[index][0]];
    });
    // Preparation/insights depend on orders, but not on unrelated collections.
    if (settled[1].status === "fulfilled") {
      try { refreshPrep(); } catch (error) { console.error(error); errors.push("Kitchen prep"); }
      if (role === "admin") {
        try { await refreshInsights(); } catch (error) { console.error(error); errors.push("Insights"); }
      }
    }
    try { await refreshOverview(); } catch (error) { errors.push("Overview status"); }
    if (errors.length) {
      msg("Could not load: " + errors.join(", ") + ". Other sections may still be available. Check Firestore permissions and try Refresh.");
    } else {
      msg("Workspace updated.", true);
    }
  } finally {
    loading = false;
    button.disabled = false;
    button.textContent = "↻ Refresh";
  }
}
async function authorize(user) {
  if (verifying) return;
  verifying = true;
  const attempt = ++authAttempt;
  const loginButton = $("#google-login");
  loginButton.disabled = true;
  setLoginState("Verifying your team access…");
  try {
    const access = await getRole(user);
    if (attempt !== authAttempt || auth.currentUser?.uid !== user.uid) return;
    if (!access) {
      showLogin();
      const reason = "This Google account is recognized but has no active admin or staff role. Customer registration does not interfere with access.";
      showHelp(user, reason);
      msg(reason);
      setLoginState("Role approval needed. See Access troubleshooting.", true);
      return;
    }
    hideHelp();
    showDashboard(user, access);
    setLoginState("Signed in.", false);
    msg("");
    await loadAll();
  } catch (error) {
    console.error("Em's Taste authorization check failed:", error);
    showLogin();
    const reason = error.code === "permission-denied"
      ? "Firestore denied the role lookup. The published rules may not allow reading your own admins or team record."
      : "Cannot check your role (" + (error.code || "connection error") + "). Confirm Firebase is reachable.";
    showHelp(user, reason);
    msg(reason);
    setLoginState(reason, true);
  } finally {
    verifying = false;
    loginButton.disabled = false;
  }
}
onAuthStateChanged(auth, async user => {
  if (!user) {
    authAttempt += 1;
    clearTeamCache();
    showLogin();
    hideHelp();
    msg("");
    setLoginState("No separate Em’s Taste password required.");
    return;
  }
  await ensureProfile(user);
  await authorize(user);
});
$("#google-login").addEventListener("click", async () => {
  const button = $("#google-login");
  if (button.disabled) return;
  button.disabled = true;
  try {
    if (auth.currentUser && !role) await signOut(auth);
    setLoginState("Opening Google’s sign-in window…");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
    setLoginState("Signed in to Google. Checking workspace permissions…");
  } catch (error) {
    console.error("Google sign-in failed:", error);
    const explanations = {
      "auth/popup-blocked": "The browser blocked the Google window. Allow popups or open this page in Chrome.",
      "auth/popup-closed-by-user": "Google sign-in was cancelled.",
      "auth/unauthorized-domain": "Add this website domain to Firebase Authentication → Authorized domains.",
      "auth/operation-not-allowed": "Enable the Google provider under Firebase Authentication.",
      "auth/network-request-failed": "The network connection failed. Please try again."
    };
    setLoginState(explanations[error.code] || "Google sign-in could not complete. Try again.", true);
  } finally {
    button.disabled = false;
  }
});
$("#retry-access").addEventListener("click", async () => {
  if (!auth.currentUser) {
    setLoginState("Sign in with Google first.", true);
    return;
  }
  await authorize(auth.currentUser);
});
$("#sign-out").addEventListener("click", async () => {
  $("#sign-out").disabled = true;
  try { await signOut(auth); }
  catch (error) { console.error(error); msg("Could not sign out. Please try again."); }
  finally { $("#sign-out").disabled = false; }
});
$("#refresh-dashboard").addEventListener("click", loadAll);
$("#workspace-mobile-nav").addEventListener("click", () => {
  const area = $(".workspace-nav-area");
  const open = area.classList.toggle("mobile-open");
  $("#workspace-mobile-nav").setAttribute("aria-expanded", String(open));
});
document.querySelectorAll("[data-panel]").forEach(tab => {
  tab.addEventListener("click", () => activateTab(tab.dataset.panel, true));
  tab.addEventListener("keydown", event => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const choices = [...document.querySelectorAll("[data-panel]")].filter(item => !item.hidden);
    const index = choices.indexOf(tab);
    const next = choices[(index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length];
    next.focus();
  });
});
document.addEventListener("click", event => {
  const button = event.target.closest("[data-go]");
  if (!button || !role) return;
  activateTab(button.dataset.go, true);
});
window.addEventListener("hashchange", () => {
  const panelId = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (authorizedPanel(panelId)) activateTab(panelId);
});

window.addEventListener("ems-workspace-orders-updated", () => {
  if (!role) return;
  try { refreshPrep(); } catch (error) { console.error(error); }
  refreshOverview().catch(error => console.error(error));
});
window.addEventListener("ems-workspace-menu-updated", () => {
  if (role) refreshOverview().catch(error => console.error(error));
});

// Only active administrator sessions may load private team data.
// Hidden/background tabs do not repeatedly query Firestore.
window.setInterval(() => {
  if (role !== "admin" || !auth.currentUser || document.visibilityState !== "visible") return;
  refreshTeam().catch(error => console.error("Scheduled team refresh failed:", error));
}, 5 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && role === "admin") {
    refreshTeam().catch(error => console.error("Team refresh on return failed:", error));
  }
});

initMenu(); initOrders(); initBulk(); initPrep(); initSettings(); initPeople(); initReports();
$("#year").textContent = String(new Date().getFullYear());
