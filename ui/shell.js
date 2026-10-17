/* Shared Em's Taste interface utilities (no Firebase secrets or role grants). */
(() => {
  "use strict";
  const refs = document.querySelectorAll(".ems-account");
  let currentActions = {};
  let loadingTimer = null;
  let loadingFallback = null;
  let loadingStarted = 0;
  let loadingOpen = false;
  const loader = document.createElement("div");
  loader.id = "ems-shared-loader";
  loader.className = "ems-loading-overlay";
  loader.hidden = true;
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-live", "polite");
  loader.innerHTML = '<div class="ems-loader-card">' +
    '<img src="logo.svg" width="78" height="78" alt="" />' +
    '<span class="ems-loader-brand">EM’S TASTE</span>' +
    '<strong>Preparing something good…</strong>' +
    '<span class="ems-loader-message">Loading your experience</span>' +
    '<span class="ems-loader-progress" aria-hidden="true"><i></i></span>' +
    '</div>';
  document.body.append(loader);
  function hideMenus() {
    for (const root of refs) {
      const button = root.querySelector(".ems-account-trigger");
      const menu = root.querySelector(".ems-account-menu");
      if (menu && !menu.hidden) {
        menu.hidden = true;
        button?.setAttribute("aria-expanded", "false");
      }
    }
  }
  for (const root of refs) {
    const button = root.querySelector(".ems-account-trigger");
    const menu = root.querySelector(".ems-account-menu");
    button?.addEventListener("click", () => {
      const open = menu.hidden;
      hideMenus();
      menu.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      if (open) menu.querySelector('a:not([hidden]),button:not([hidden])')?.focus();
    });
    menu?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-account-action]");
      if (!action) return;
      hideMenus();
      const callback = currentActions[action.dataset.accountAction];
      if (typeof callback === "function") callback();
    });
  }
  document.addEventListener("click", (event) => {
    if (![...refs].some(root => root.contains(event.target))) hideMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const open = [...refs].find(root => !root.querySelector(".ems-account-menu")?.hidden);
      if (open) {
        hideMenus();
        open.querySelector(".ems-account-trigger")?.focus();
      }
    }
  });
  function setAccount({ name = "Guest", email = "", role = "Guest", signedIn = false,
                       canManage = false, onOrders, onSignIn, onSignOut } = {}) {
    currentActions = {
      orders: onOrders, "sign-in": onSignIn, "sign-out": onSignOut
    };
    const displayName = String(name || email?.split("@")[0] || "Guest");
    const displayRole = signedIn
      ? (role === "admin" ? "Administrator" : role === "staff" ? "Staff" : "Customer")
      : "Guest";
    for (const root of refs) {
      root.querySelector(".ems-account-name").textContent = signedIn ? displayName : "Sign in";
      root.querySelector(".ems-account-role").textContent = signedIn ? displayRole : "Browse as guest";
      root.querySelector(".ems-account-avatar").textContent =
        signedIn ? displayName.trim().charAt(0).toLocaleUpperCase() : "G";
      const trigger = root.querySelector(".ems-account-trigger");
      trigger.setAttribute("aria-label", signedIn ?
        "Account: " + displayName + ", " + displayRole + ". Open account menu." :
        "Guest account. Open sign-in menu.");
      const subtitle = root.querySelector(".ems-menu-email");
      if (subtitle) subtitle.textContent = signedIn ? (email || "") : "Explore the menu or sign in with Google";
      root.querySelectorAll("[data-signed-in]").forEach(node => node.hidden = !signedIn);
      root.querySelectorAll("[data-signed-out]").forEach(node => node.hidden = signedIn);
      root.querySelectorAll("[data-manager-access]").forEach(node => node.hidden = !signedIn || !canManage);
      root.querySelectorAll("[data-customer-orders]").forEach(node => node.hidden = !signedIn);
      root.querySelectorAll("[data-role-label]").forEach(node => node.textContent = displayRole);
    }
    hideMenus();
  }
  function showLoading(message = "Loading your experience") {
    if (loadingTimer) clearTimeout(loadingTimer);
    if (loadingFallback) clearTimeout(loadingFallback);
    loadingOpen = true;
    loader.querySelector(".ems-loader-message").textContent = message;
    loadingTimer = setTimeout(() => {
      if (!loadingOpen) return;
      loadingStarted = Date.now();
      loader.hidden = false;
    }, 160);
    // Never trap visitors behind a loader if Firebase or network requests stall.
    loadingFallback = setTimeout(() => hideLoading(), 12000);
  }
  function hideLoading() {
    loadingOpen = false;
    clearTimeout(loadingTimer);
    clearTimeout(loadingFallback);
    loader.hidden = true;
  }
  window.EMS_UI = { setAccount, showLoading, hideLoading, hideMenus };
  // A short consistent initial load prevents flashing the wrong role/header.
  showLoading("Checking your account…");
})();