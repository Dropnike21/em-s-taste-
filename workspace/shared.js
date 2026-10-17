import { auth, db } from "../firebase-config.js";
export { auth, db };
export const $ = selector => document.querySelector(selector);
export const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
export const peso = value => new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(value)||0);
export const stamp = date => date?.toDate?.()?.toISOString?.().slice(0,10) || "—";
let successTimer;
export const msg = (message, okay = false) => {
  const errorBox = $("#page-message");
  const toast = $("#page-toast");
  clearTimeout(successTimer);
  if (!message) {
    errorBox.hidden = true;
    errorBox.textContent = "";
    if (toast) { toast.hidden = true; toast.textContent = ""; }
    return;
  }
  if (okay) {
    errorBox.hidden = true;
    errorBox.textContent = "";
    if (toast) {
      toast.textContent = message;
      toast.hidden = false;
      successTimer = setTimeout(() => {
        toast.hidden = true;
        toast.textContent = "";
      }, 3500);
    }
    return;
  }
  if (toast) { toast.hidden = true; toast.textContent = ""; }
  errorBox.textContent = message;
  errorBox.hidden = false;
};
export const firebase13="https://www.gstatic.com/firebasejs/13.0.0/";
export function dateNext() {
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  const d=new Date(Date.UTC(+p.year,+p.month-1,+p.day+1));
  while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
}
