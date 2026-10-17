import { db, $, esc, peso, stamp, msg } from "./shared.js";
import {
  collection, doc, getDocs, updateDoc, serverTimestamp, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

let orders = [];
export const getOrders = () => orders;

const transitions = {
  pending: ["pending", "confirmed", "cancelled"],
  confirmed: ["confirmed", "completed", "cancelled"],
  completed: ["completed"],
  cancelled: ["cancelled"]
};
const paymentStates = ["unpaid", "paid", "refunded"];

function filteredOrders() {
  const search = ($("#order-search")?.value || "").trim().toLocaleLowerCase();
  const status = $("#order-filter")?.value || "all";
  return orders.filter(o => {
    if (status !== "all" && (o.status || "pending") !== status) return false;
    if (!search) return true;
    const haystack = [
      o.customerName, o.workplace, o.serviceDay, o.status,
      ...(o.items || []).map(item => item.name)
    ].join(" ").toLocaleLowerCase();
    return haystack.includes(search);
  });
}

function renderOrders() {
  const visible = filteredOrders();
  $("#orders-visible-count").textContent = visible.length + " of " + orders.length + " recent order requests";
  $("#orders-list").innerHTML = visible.length ? visible.map(o => {
    const current = o.status || "pending";
    const options = (transitions[current] || [current]).map(s =>
      '<option value="' + esc(s) + '"' + (s === current ? " selected" : "") + '>' +
      s[0].toUpperCase() + s.slice(1) + "</option>"
    ).join("");
    const payments = paymentStates.map(s =>
      '<option value="' + s + '"' + (s === (o.paymentStatus || "unpaid") ? " selected" : "") +
      ">" + s[0].toUpperCase() + s.slice(1) + "</option>"
    ).join("");
    const lines = (o.items || []).map(item =>
      "<div>" + esc(item.quantity) + " × " + esc(item.name) + " — " +
      peso((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)) + "</div>"
    ).join("");
    return '<article class="order-card" data-order-card="' + esc(o.id) + '">' +
      '<div class="order-header"><div><h3>' + esc(o.customerName) + '</h3>' +
      '<span class="order-id">Request #' + esc(o.id.slice(-20)) + "</span></div>" +
      '<span class="order-status ' + esc(current) + '">' + esc(current) + "</span></div>" +
      '<div class="order-body"><p><strong>Workplace:</strong> ' + esc(o.workplace) + "</p>" +
      '<p><strong>Meal date:</strong> ' + esc(o.serviceDay || stamp(o.serviceDate)) + "</p>" +
      '<p><strong>Notes:</strong> ' + esc(o.note || "—") + "</p>" +
      '<p><strong>Payment:</strong> ' + esc(o.paymentStatus || "unpaid") + "</p></div>" +
      '<div class="order-lines">' + lines + "</div>" +
      '<p class="order-total">' + peso(o.total) + "</p>" +
      '<div class="order-actions">' +
      '<label>Fulfillment status<select data-status="' + esc(o.id) + '">' + options + "</select></label>" +
      '<label>Payment record<select data-payment="' + esc(o.id) + '">' + payments + "</select></label>" +
      '<button type="button" data-save-order="' + esc(o.id) + '">Save changes</button></div>' +
      '<p class="order-footnote">Changes are recorded internally. Notify the customer/coordinator separately.</p></article>';
  }).join("") : '<div class="empty-workspace-state"><strong>No matching order requests</strong><p>Try another search or status filter. Only the 150 most recent orders are loaded.</p></div>';
}

export async function refreshOrders() {
  const snapshot = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(150)));
  orders = snapshot.docs.map(r => ({ id: r.id, ...r.data() }));
  $("#stat-pending").textContent = orders.filter(o => o.status === "pending").length;
  $("#stat-total").textContent = peso(orders.filter(o => o.status !== "cancelled")
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0));
  renderOrders();
}

function safeCsv(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function initOrders() {
  $("#order-search").addEventListener("input", renderOrders);
  $("#order-filter").addEventListener("change", renderOrders);
  $("#orders-list").addEventListener("click", async event => {
    const button = event.target.closest("[data-save-order]");
    if (!button) return;
    const order = orders.find(o => o.id === button.dataset.saveOrder);
    if (!order) return;
    const card = button.closest("[data-order-card]");
    const status = card.querySelector("[data-status]")?.value;
    const paymentStatus = card.querySelector("[data-payment]")?.value;
    if (!(transitions[order.status] || []).includes(status) || !paymentStates.includes(paymentStatus)) {
      msg("Invalid status change. Use the normal Pending → Confirmed → Completed workflow.");
      return;
    }
    if (status === order.status && paymentStatus === (order.paymentStatus || "unpaid")) {
      msg("No changes to save.", true);
      return;
    }
    if ((status === "completed" || status === "cancelled") &&
        status !== order.status &&
        !confirm("Mark this order as " + status + "? This affects kitchen preparation and cannot be reversed from this screen.")) {
      return;
    }
    if (paymentStatus === "paid" && (order.paymentStatus || "unpaid") !== "paid" &&
        !confirm("Confirm you have verified payment for this order?")) return;
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status, paymentStatus, reviewedAt: serverTimestamp()
      });
      await refreshOrders();
      window.dispatchEvent(new Event("ems-workspace-orders-updated"));
      msg("Transaction updated. Contact the customer or workplace coordinator to confirm changes.", true);
    } catch (error) {
      console.error("Unable to update order:", error);
      msg("Transaction could not be saved. Check Firestore permission and try again.");
      button.disabled = false;
      button.textContent = "Save changes";
    }
  });
  $("#export-csv").addEventListener("click", () => {
    if (!orders.length) { msg("No orders are available for export."); return; }
    const rows = [["ID", "Customer", "Workplace", "Service day", "Status", "Payment",
      "Items", "Amount requested"]].concat(orders.map(o => [
      o.id, o.customerName, o.workplace, o.serviceDay, o.status, o.paymentStatus || "unpaid",
      (o.items || []).map(item => item.quantity + "x " + item.name).join("; "), o.total
    ]));
    const blob = new Blob(["\uFEFF" + rows.map(row => row.map(safeCsv).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url;
    link.download = "ems-taste-recent-transactions.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    msg("Exported the most recent 150 transactions. Protect this file as customer information.", true);
  });
}
