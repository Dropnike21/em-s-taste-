import { auth, db, $, msg } from "./shared.js";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { initMenu, refreshMenu, refreshSuggestions } from "./menu.js";
import { initWeeklyMenu, refreshWeeklyMenu } from "./weekly.js";
import { initOrders, refreshOrders } from "./orders.js";
import { initBulk, refreshBulk } from "./bulk.js";
import { initPrep, refreshPrep } from "./prep.js";
import { initSettings, refreshSettings } from "./settings.js";
import { refreshInsights } from "./insights.js";
import { initPeople, refreshPeople, refreshTeam, clearTeamCache } from "./people.js";
import { initReports, refreshReports } from "./reports.js";
import { refreshOverview } from "./overview.js";
import { getWorkspaceRole } from "../ui/roles.js";

const staffPanels = new Set(["overview-panel", "orders-panel", "bulk-panel", "prep-panel", "menu-panel", "weekly-panel"]);
const adminPanels = new Set(["settings-panel", "insights-panel", "reports-panel", "team-panel"]);
const panelInfo = {
  "overview-panel": ["Overview", "Your kitchen, at a glance."],
  "orders-panel": ["Orders & payments", "Review incoming requests, track payment status, and update fulfillment."],
  "bulk-panel": ["Large meal requests", "Quote and confirm bookings of 51 or more meals."],
  "prep-panel": ["Kitchen preparation", "Organize confirmed servings by dish and workplace."],
  "menu-panel": ["Product catalog", "Edit saved products once, then reuse them in weekly menus."],
  "weekly-panel": ["Weekly menu", "Plan and publish meals for Monday through Friday."],
  "settings-panel": ["Ordering controls", "Configure the next meal workday and preorder availability."],
  "insights-panel": ["Insights", "Explore orders, meal popularity, and completed-meal ratings."],
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
function clearPrivateViews() {
  // Remove information from a previous team session, especially on shared devices.
  for (const id of ["orders-list","bulk-list","prep-summary","reports-list",
    "customer-feedback","top-dishes","users-directory"]) {
    const element = $("#" + id);
    if (element) element.textContent = "";
  }
  for (const id of ["stat-pending","stat-bulk","stat-customers","stat-total",
    "rating-average","users-total","users-staff","users-admins"]) {
    const element = $("#" + id);
    if (element) element.textContent = "—";
  }
  $("#workspace-email").textContent = "";
}
function showLogin() {
  role = null;
  $("#login-view").hidden = false;
  $("#dashboard-view").hidden = true;
  $("#staff-top-nav").hidden = true;
  $("#staff-nav-toggle").hidden = true;
  $("#sign-out").hidden = true;
  window.EMS_UI?.setAccount({
    signedIn: false,
    onSignIn: () => $("#google-login").click()
  });
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
  document.querySelectorAll('.ems-primary-nav a[href^="#"]').forEach(link => {
    if (link.getAttribute("href") === "#" + panelId) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (changeHistory && location.hash !== "#" + panelId) history.pushState({emsPanel:panelId}, "", "#" + panelId);
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
  $("#staff-top-nav").hidden = false;
  $("#staff-nav-toggle").hidden = false;
  $("#sign-out").hidden = true; // Sign-out is in the shared account menu.
  window.EMS_UI?.setAccount({
    signedIn: true,
    name: user.displayName || user.email || "Team member",
    email: user.email || "",
    role,
    canManage: true,
    onSignOut: () => $("#sign-out").click()
  });
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
  return getWorkspaceRole(user);
}

async function loadAll(force = false) {
  if (!role || loading) return;
  loading = true;
  if (force) window.EMS_UI?.showLoading("Refreshing kitchen data…");
  const button = $("#refresh-dashboard");
  button.disabled = true;
  button.textContent = "Refreshing…";
  msg("");
  try {
    const tasks = [
      ["Menu", refreshMenu()],
      ["Orders", refreshOrders()],
      ["Bulk bookings", refreshBulk()],
      ["Menu suggestions", refreshSuggestions()]
    ];
    if (role === "admin") {
      tasks.push(["Ordering controls", refreshSettings()]);
      tasks.push(["User directory", refreshPeople(force)]);
      tasks.push(["Customer reports", refreshReports()]);
    }
    const settled = await Promise.allSettled(tasks.map(([, task]) => task));
    const errors = settled.flatMap((outcome, index) => {
      if (outcome.status === "fulfilled") return [];
      console.error(tasks[index][0] + " failed:", outcome.reason);
      return [tasks[index][0]];
    });
    // Preparation/insights depend on orders, but not on unrelated collections.
    if (settled[0].status === "fulfilled") {
      try { await refreshWeeklyMenu(); } catch (error) { console.error(error); errors.push("Weekly menu"); }
    }
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
      msg("");
    }
  } finally {
    loading = false;
    button.disabled = false;
    button.textContent = "↻ Refresh";
    if (force) window.EMS_UI?.hideLoading();
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
    window.EMS_UI?.hideLoading();
  }
}
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.EMS_UI?.hideLoading();
    authAttempt += 1;
    clearTeamCache();
    clearPrivateViews();
    showLogin();
    hideHelp();
    msg("");
    setLoginState("No separate Em’s Taste password required.");
    return;
  }
  window.EMS_UI?.showLoading("Checking your workspace access…");
  await ensureProfile(user);
  await authorize(user);
});
$("#google-login").addEventListener("click", async () => {
  const button = $("#google-login");
  if (button.disabled) return;
  button.disabled = true;
  try {
    // Keep the popup within the original click's user-activation window.
    // Google's account chooser can switch users without signing out first.
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
  try {
    await signOut(auth);
    clearTeamCache();
    clearPrivateViews();
    // Fully discard privileged UI state from this browser session.
    window.location.replace("admin.html");
  } catch (error) {
    console.error(error);
    msg("Could not sign out. Please try again.");
    $("#sign-out").disabled = false;
  }
});
$("#refresh-dashboard").addEventListener("click", () => loadAll(true));
$("#workspace-mobile-nav").addEventListener("click", () => {
  const area = $(".workspace-nav-area");
  const open = area.classList.toggle("mobile-open");
  $("#workspace-mobile-nav").setAttribute("aria-expanded", String(open));
  if (open) {
    const selected = area.querySelector("[data-panel].active");
    (selected || area.querySelector("[data-panel]:not([hidden])"))?.focus();
  }
});
document.addEventListener("click", event => {
  const area = $(".workspace-nav-area");
  const toggle = $("#workspace-mobile-nav");
  if (area.classList.contains("mobile-open") &&
      !area.contains(event.target) && !toggle.contains(event.target)) closeMobileNav();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && $(".workspace-nav-area").classList.contains("mobile-open")) {
    closeMobileNav();
    $("#workspace-mobile-nav").focus();
  }
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
function restorePanelFromUrl() {
  const panelId = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (authorizedPanel(panelId)) activateTab(panelId);
  else if (role) activateTab("overview-panel");
}
window.addEventListener("hashchange", restorePanelFromUrl);
window.addEventListener("popstate", restorePanelFromUrl);

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

initMenu(); initWeeklyMenu(); initOrders(); initBulk(); initPrep(); initSettings(); initPeople(); initReports();
$("#year").textContent = String(new Date().getFullYear());
