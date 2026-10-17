(() => {
  "use strict";
  const settings = window.EMS_CONFIG || {};
  let dishes = Array.isArray(window.EMS_MENU) ? window.EMS_MENU : [];
  const STORAGE_KEY = "ems-taste-cart-v1";
  const maxPerDish = 5;
  const $ = (selector) => document.querySelector(selector);
  const money = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
  const html = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const menuGrid = $("#menu-grid");
  const cartDrawer = $("#cart-drawer");
  const cartOverlay = $("#cart-overlay");
  const reviewOverlay = $("#review-overlay");
  let filter = "all";
  let cart = loadCart();
  let lastFocus = null;
  let orderText = "";
  let schedule = getSchedule();

  function loadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const safe = {};
      for (const item of dishes) {
        const qty = Number(parsed[item.id]);
        if (Number.isSafeInteger(qty) && qty > 0 && item.available !== false) safe[item.id] = Math.min(qty, maxPerDish);
      }
      return safe;
    } catch {
      return {};
    }
  }

  function saveCart() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { /* Private browsing can block storage. */ }
  }

  // Use Asia/Manila explicitly so visitors outside the Philippines see the same cutoff.
  function phParts(now = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    });
    const pieces = Object.fromEntries(formatter.formatToParts(now).map(x => [x.type, x.value]));
    return { year: Number(pieces.year), month: Number(pieces.month), day: Number(pieces.day), hour: Number(pieces.hour) };
  }

  function addDay(date, amount = 1) {
    const result = new Date(date.getTime());
    result.setUTCDate(result.getUTCDate() + amount);
    return result;
  }
  function prettyDate(date) {
    return new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(date);
  }
  function getSchedule() {
    const parts = phParts();
    const today = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const weekday = today.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isOrderDay = weekday === 0 || (weekday >= 1 && weekday <= 4);
    const open = isOrderDay && parts.hour < (settings.cutoffHour || 23);
    const orderWindow = new Date(today.getTime());
    if (!open) {
      // Find next Sunday–Thursday ordering day, skipping today after its cutoff.
      do { orderWindow.setUTCDate(orderWindow.getUTCDate() + 1); }
      while (![0, 1, 2, 3, 4].includes(orderWindow.getUTCDay()));
    }
    const serviceDate = addDay(orderWindow);
    return { open, today, orderWindow, serviceDate, weekday };
  }

  function acceptingOrders() {
    const live = window.EMS_LIVE_STATE;
    if (!live?.ready || live.error || !live.usingLiveMenu || !live.settings?.ordersOpen || !schedule.open) return false;
    const published = live.settings.menuDate?.toDate?.();
    return published instanceof Date && published.toISOString().slice(0, 10) === schedule.serviceDate.toISOString().slice(0, 10) && live.settings.menuDayKey === schedule.serviceDate.toISOString().slice(0, 10);
  }

  function updateSchedule() {
    schedule = getSchedule();
    $("#menu-date").textContent = prettyDate(schedule.serviceDate);
    $("#cart-delivery").textContent = "Meals for " + prettyDate(schedule.serviceDate);
    const live = window.EMS_LIVE_STATE;
    const published = Boolean(live?.ready && live.usingLiveMenu && !live.error);
    const open = acceptingOrders();
    const status = $("#schedule-status");
    status.classList.toggle("closed", !open);
    status.textContent = open ? "● Online orders open" : "○ Ordering unavailable";
    $("#schedule-message").textContent = !published
      ? "Website preview: the live menu and ordering have not been activated."
      : open
        ? "Requests for " + prettyDate(schedule.serviceDate) + " close at 11:00 PM Philippine time."
        : "Order requests are not open. Next order window: " + prettyDate(schedule.orderWindow) + ".";
    $("#sample-warning").textContent = published ? "Current published menu" : "Sample menu — for preview only";
    $("#menu-disclaimer").textContent = published
      ? "* Prices and availability are subject to kitchen confirmation. Menu updates may require a page refresh."
      : "* This is a sample menu for preview. Published dishes and current prices will appear after setup.";
    updateCheckoutButton();
  }

  function availableDishes() {
    return dishes.filter(d => filter === "all" || d.category === filter);
  }

  const bowlIcon = `<svg class="food-visual-icon" viewBox="0 0 150 150" aria-hidden="true">
    <ellipse cx="75" cy="82" rx="61" ry="22" fill="#fff6df" stroke="#a66b46" stroke-width="4"/>
    <path d="M16 85q8 48 59 48t59-48q-54 20-118 0Z" fill="#9c563c"/>
    <path d="M35 92q39 11 81 0" stroke="#d2a17a" stroke-width="4" fill="none"/>
    <path d="M55 53q-17-13 2-26M78 53q-18-18 2-36M97 54q-13-15 3-26" stroke="#b78d6e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M92 70q8-27 26-31-2 23-26 31Z" fill="#73775a"/>
  </svg>`;

  function paintMenu() {
    const visible = availableDishes();
    $("#menu-count").textContent = visible.length + (visible.length === 1 ? " item" : " items");
    menuGrid.innerHTML = visible.map(item => {
      const unavailable = item.available === false;
      const image = typeof item.image === "string" && /^(https?:\/\/|\.\.?\/|images\/)/i.test(item.image)
        ? `<img loading="lazy" src="${html(item.image)}" alt="${html(item.name)}">`
        : bowlIcon;
      return `<article class="food-card">
        <div class="food-visual ${["sage", "coral", "cream"].includes(item.palette) ? item.palette : ""}">
          <span class="food-tag">${html(unavailable ? "Unavailable" : item.tag || "Home-cooked")}</span>${image}
        </div>
        <div class="food-content">
          <p class="food-category">${item.category === "sides" ? "Rice & extras" : "Home-cooked ulam"}</p>
          <h3>${html(item.name)}</h3>
          <p class="food-description">${html(item.description)}</p>
          <div class="food-bottom"><span class="price">${money(Number(item.price) || 0)}</span>
          <button type="button" class="add-button" data-add="${html(item.id)}" ${unavailable ? "disabled" : ""} aria-label="Add ${html(item.name)} to order">${unavailable ? "Sold out" : "+ Add to order"}</button></div>
        </div>
      </article>`;
    }).join("") || '<p class="empty-menu">No items in this category yet.</p>';
  }

  function lineItems() {
    return dishes.filter(d => cart[d.id] > 0 && d.available !== false);
  }
  function totalItems() {
    return lineItems().reduce((sum, item) => sum + cart[item.id], 0);
  }
  function totalAmount() {
    return lineItems().reduce((sum, item) => sum + (Number(item.price) || 0) * cart[item.id], 0);
  }

  function updateCheckoutButton() {
    const button = $("#prepare-order");
    const open = acceptingOrders();
    const signedIn = Boolean(window.EMS_LIVE_STATE?.customer?.uid && !window.EMS_LIVE_STATE.customer.blocked);
    button.disabled = !totalItems() || !open || !signedIn || button.dataset.submitting === "yes";
    button.innerHTML = !open
      ? "Online requests unavailable"
      : signedIn ? "Send order request <span aria-hidden='true'>→</span>" : "Sign in with Google first";
    $("#cart-google-login").hidden = signedIn;
    $("#cart-auth-notice").hidden = signedIn;
    if (!signedIn) {
      $("#cart-auth-notice").textContent = window.EMS_LIVE_STATE?.customer?.blocked
        ? "This account cannot place orders. Contact Em's Taste if you believe this is a mistake."
        : "Sign in with Google to request a meal. One request per account per workday.";
    }
  }

  function paintCart() {
    const count = totalItems();
    $("#cart-count").textContent = count;
    $("#drawer-count").textContent = "(" + count + ")";
    $("#cart-total").textContent = money(totalAmount());
    const rows = lineItems();
    $("#cart-items").innerHTML = rows.length
      ? rows.map(item => `<div class="cart-item"><div><h3>${html(item.name)}</h3><p>${money(Number(item.price) || 0)} each</p></div>
          <div class="cart-item-right"><strong>${money((Number(item.price) || 0) * cart[item.id])}</strong>
          <div class="quantity"><button type="button" data-remove="${html(item.id)}" aria-label="Remove one ${html(item.name)}">−</button>
          <span>${cart[item.id]}</span>
          <button type="button" data-add="${html(item.id)}" ${cart[item.id] >= maxPerDish ? "disabled" : ""} aria-label="Add one ${html(item.name)}">+</button></div></div></div>`).join("")
      : '<div class="empty-cart"><span class="empty-cart-icon">♡</span><strong>Your order is waiting.</strong><p>Choose something delicious from the menu and it’ll appear here.</p></div>';
    updateCheckoutButton();
  }

  function changeQuantity(id, change) {
    const item = dishes.find(d => d.id === id);
    if (!item || item.available === false) return;
    if (change > 0 && totalItems() >= 10) {
      window.alert("For now, orders are limited to ten servings in total.");
      return;
    }
    if (change > 0 && !cart[id] && lineItems().length >= 6) {
      window.alert("You can select up to six different dishes per order.");
      return;
    }
    const next = Math.max(0, Math.min(maxPerDish, (cart[id] || 0) + change));
    if (next === 0) delete cart[id]; else cart[id] = next;
    saveCart();
    paintCart();
  }

  function openCart() {
    lastFocus = document.activeElement;
    cartOverlay.hidden = false;
    cartDrawer.classList.add("open");
    cartDrawer.setAttribute("aria-hidden", "false");
    $("#open-cart").setAttribute("aria-expanded", "true");
    document.body.classList.add("no-scroll");
    $("#close-cart").focus();
  }

  function closeCart(restoreFocus = true) {
    cartDrawer.classList.remove("open");
    cartDrawer.setAttribute("aria-hidden", "true");
    cartOverlay.hidden = true;
    $("#open-cart").setAttribute("aria-expanded", "false");
    if (reviewOverlay.hidden) document.body.classList.remove("no-scroll");
    if (restoreFocus && lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function buildSummary(name, workplace, note) {
    const lines = [
      "EM'S TASTE — ORDER REQUEST" + (!schedule.open ? " (PREVIEW — ORDERING CLOSED)" : ""),
      "For: " + prettyDate(schedule.serviceDate),
      "Name: " + name,
      "Workplace / pickup group: " + workplace,
      "--------------------------------",
      ...lineItems().map(item => cart[item.id] + " × " + item.name + " — " + money(cart[item.id] * (Number(item.price) || 0))),
      "--------------------------------",
      "TOTAL: " + money(totalAmount())
    ];
    if (note) lines.push("Note: " + note);
    lines.push("", "Order request pending. Please wait for staff confirmation.");
    if (settings.sampleMenu) lines.push("DEMO ONLY: Sample dishes and prices.");
    return lines.join("\n");
  }

  function openReview() {
    closeCart(false);
    reviewOverlay.hidden = false;
    $("#order-summary").textContent = orderText;
    $("#share-feedback").textContent = "";
    $("#share-order").hidden = typeof navigator.share !== "function";
    document.body.classList.add("no-scroll");
    $(".review-dialog").focus();
  }

  function closeReview() {
    reviewOverlay.hidden = true;
    document.body.classList.remove("no-scroll");
    $("#open-cart").focus();
  }

  async function copyOrder() {
    const feedback = $("#share-feedback");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(orderText);
      } else {
        const helper = document.createElement("textarea");
        helper.value = orderText; helper.style.position = "fixed"; helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        if (!document.execCommand("copy")) throw new Error("Copy was blocked");
        helper.remove();
      }
      feedback.textContent = "Order details copied, including the reference number.";
    } catch {
      feedback.textContent = "Copy unavailable. Select and copy the order details shown above.";
    }
  }

  function renderCustomer() {
    const live = window.EMS_LIVE_STATE;
    const customer = live?.customer;
    const signedIn = Boolean(customer);
    $("#customer-google-login").hidden = signedIn;
    $("#customer-signout").hidden = !signedIn;
    $("#customer-refresh").hidden = !signedIn;
    $("#customer-history").hidden = !signedIn;
    $("#account-shortcut").textContent = signedIn ? "My orders" : "Sign in";
    $("#customer-heading").textContent = signedIn ? "Hello, " + customer.displayName + "." : "Your meals, your account.";
    $("#customer-status").textContent = live?.accountError ||
      (customer?.blocked ? "Ordering is disabled for this account. Contact Em's Taste for assistance."
        : signedIn ? "Signed in as " + customer.email + ". Review your past requests and meals below."
        : !live?.authReady ? "Checking your sign-in status…"
        : "Sign in with Google before placing an order. Your past orders and feedback will stay linked to your account.");
    if (signedIn) {
      const name = $("#customer-name");
      if (!name.value) name.value = customer.displayName || "";
      const reviews = new Set((live.reviews || []).map(x => x.id));
      $("#my-orders").innerHTML = (live.orders || []).length
        ? live.orders.map(order => {
            const date = order.serviceDate?.toDate?.()?.toLocaleDateString("en-PH", {timeZone:"UTC",weekday:"short",month:"short",day:"numeric",year:"numeric"}) || order.serviceDay || "";
            const reviewed = reviews.has(order.id);
            const canReview = order.status === "completed" && !reviewed && !customer.blocked;
            return '<article class="my-order-card"><h4>Meals for ' + html(date) +
              '</h4><small>Order #' + html(order.id.slice(-17)) + '</small>' +
              '<p><span class="order-status ' + html(order.status) + '">' + html(order.status) + '</span> · ' + money(order.total) + '</p>' +
              '<p>' + (order.items || []).map(item => html(item.quantity) + ' × ' + html(item.name)).join(' · ') + '</p>' +
              (reviewed ? '<p class="my-review-notice">✓ Thanks for sharing your feedback.</p>' : '') +
              (canReview ? '<form class="my-review-form" data-review-id="' + html(order.id) + '">' +
                '<label>How was your meal? (required)</label><select name="rating" required><option value="">Choose a rating</option><option value="5">★★★★★ – Excellent</option><option value="4">★★★★ – Good</option><option value="3">★★★ – Okay</option><option value="2">★★ – Needs improvement</option><option value="1">★ – Poor</option></select>' +
                '<label>Comments (optional)</label><textarea name="comment" maxlength="500" rows="2" placeholder="Tell us what you enjoyed or what to improve."></textarea>' +
                '<button type="submit" class="button button-primary">Send feedback</button><p role="status" class="my-review-notice"></p></form>' : '') +
              '</article>';
          }).join("")
        : '<p class="muted">No orders yet. Your requests will appear here after you submit them.</p>';
    }
    updateCheckoutButton();
  }

  async function customerSignIn() {
    $("#customer-status").textContent = "Opening Google sign-in…";
    try {
      await window.EMS_GOOGLE_SIGNIN();
    } catch (err) {
      console.error(err);
      $("#customer-status").textContent = err.code === "auth/popup-closed-by-user"
        ? "Sign-in was cancelled."
        : err.code === "auth/popup-blocked"
        ? "Your browser blocked the sign-in popup. Please enable popups or use a normal browser."
        : "Unable to sign in with Google. Check your browser and Firebase Authentication settings.";
    }
  }

  function setupEvents() {
    $("#account-shortcut").addEventListener("click", () => {
      document.querySelector("#account-section").scrollIntoView({behavior:"smooth", block:"start"});
    });
    $("#customer-google-login").addEventListener("click", customerSignIn);
    $("#cart-google-login").addEventListener("click", async () => {
      closeCart(false);
      document.querySelector("#account-section").scrollIntoView({behavior:"smooth", block:"start"});
      await customerSignIn();
    });
    $("#customer-signout").addEventListener("click", () => window.EMS_SIGNOUT());
    $("#customer-refresh").addEventListener("click", () => window.EMS_ACCOUNT_REFRESH());
    $("#my-orders").addEventListener("submit", async event => {
      const form = event.target.closest("[data-review-id]");
      if (!form) return;
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const status = form.querySelector('[role="status"]');
      button.disabled = true;
      status.textContent = "Sending feedback…";
      try {
        await window.EMS_REVIEW_SUBMIT({
          orderId: form.dataset.reviewId,
          rating: Number(form.elements.rating.value),
          comment: form.elements.comment.value.trim()
        });
        status.textContent = "Thank you for your feedback.";
      } catch (err) {
        status.textContent = err?.message || "Unable to save feedback. Please try again.";
        button.disabled = false;
      }
    });
    $("#open-cart").addEventListener("click", openCart);
    $("#close-cart").addEventListener("click", () => closeCart());
    cartOverlay.addEventListener("click", () => closeCart());
    $("#close-review").addEventListener("click", closeReview);
    reviewOverlay.addEventListener("click", e => { if (e.target === reviewOverlay) closeReview(); });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (!reviewOverlay.hidden) closeReview();
        else if (cartDrawer.classList.contains("open")) closeCart();
      }
    });
    $("#filters").addEventListener("click", e => {
      const button = e.target.closest("[data-category]");
      if (!button) return;
      filter = button.dataset.category;
      document.querySelectorAll("[data-category]").forEach(b => {
        const active = b === button;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      paintMenu();
    });
    menuGrid.addEventListener("click", e => {
      const button = e.target.closest("[data-add]");
      if (!button) return;
      changeQuantity(button.dataset.add, 1);
      openCart();
    });
    $("#cart-items").addEventListener("click", e => {
      const plus = e.target.closest("[data-add]");
      const minus = e.target.closest("[data-remove]");
      if (plus) changeQuantity(plus.dataset.add, 1);
      if (minus) changeQuantity(minus.dataset.remove, -1);
    });
    $("#order-form").addEventListener("submit", async e => {
      e.preventDefault();
      updateSchedule();
      const feedback = $("#cart-error");
      feedback.textContent = "";
      const customer = window.EMS_LIVE_STATE?.customer;
      if (!customer || customer.blocked) {
        feedback.textContent = "Sign in with a valid Google customer account before ordering.";
        return;
      }
      if (!acceptingOrders()) {
        feedback.textContent = "Online ordering is not active for this workday.";
        return;
      }
      if (!totalItems()) return;
      const form = e.currentTarget;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const name = $("#customer-name").value.trim();
      const workplace = $("#workplace").value.trim();
      const note = $("#order-note").value.trim();
      if (!name || !workplace) {
        feedback.textContent = "Please enter your name and workplace.";
        return;
      }
      const items = lineItems().map(item => ({
        id: item.id,
        name: item.name,
        quantity: cart[item.id],
        unitPrice: Number(item.price)
      }));
      const summary = buildSummary(name, workplace, note);
      const button = $("#prepare-order");
      button.dataset.submitting = "yes";
      updateCheckoutButton();
      try {
        const reference = await window.EMS_SUBMIT({
          name, workplace, note, items, total: totalAmount(), serviceDate: schedule.serviceDate
        });
        orderText = "Order reference: " + reference + "\nStatus: PENDING (awaiting confirmation)\n\n" + summary;
        $("#review-title").textContent = "Order request received";
        $("#review-message").textContent = "Your request is recorded in our system. Em's Taste must confirm it before it is final.";
        cart = {};
        saveCart();
        paintCart();
        form.reset();
        openReview();
      } catch (error) {
        console.error(error);
        feedback.textContent = "Order not submitted. " + (error?.message || "Please try again.");
      } finally {
        button.dataset.submitting = "no";
        updateCheckoutButton();
      }
    });
    $("#copy-order").addEventListener("click", copyOrder);
    $("#share-order").addEventListener("click", async () => {
      try {
        await navigator.share({ title: "Em's Taste order request", text: orderText });
        $("#share-feedback").textContent = "Shared. Please wait for your coordinator to confirm your order.";
      } catch (err) {
        if (err?.name !== "AbortError") $("#share-feedback").textContent = "Sharing unavailable. Try Copy order details instead.";
      }
    });
  }

  $("#year").textContent = String(phParts().year);
  updateSchedule();
  paintMenu();
  paintCart();
  setupEvents();
  window.addEventListener("ems-data", () => {
    const live = window.EMS_LIVE_STATE;
    if (live?.usingLiveMenu) {
      dishes = window.EMS_MENU;
      cart = loadCart();
      saveCart();
      paintMenu();
      paintCart();
    }
    updateSchedule();
    renderCustomer();
  });
  if (window.EMS_LIVE_STATE?.ready) {
    const loaded = window.EMS_LIVE_STATE;
    if (loaded.usingLiveMenu) {
      dishes = window.EMS_MENU;
      cart = loadCart();
      saveCart();
      paintMenu();
      paintCart();
    }
    updateSchedule();
  }
  renderCustomer();
  window.setInterval(updateSchedule, 30000);
})();