import { auth, db, $, esc, msg } from "./shared.js";
import {
  collection, doc, getDocs, getDoc, getCountFromServer,
  query, orderBy, documentId, startAfter, limit,
  setDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const FIVE_MINUTES = 5 * 60 * 1000;
const PAGE_SIZE = 100;
let profiles = new Map();
let team = new Map();
let ownerUid = null;
let lastLoaded = 0;
let profileTotal = 0;
let lastProfileDoc = null;
let hasMore = false;
let loading = null;
let loadingMore = false;
let generation = 0;

function statusText(text) {
  $("#team-refresh-status").textContent = text;
}
function timePH() {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit"
  }).format(new Date());
}
function roleOf(uid) {
  if (uid === ownerUid) return "owner";
  const grant = team.get(uid);
  return grant?.active && ["staff", "admin"].includes(grant.role) ? grant.role : "customer";
}
function allUsers() {
  const ids = new Set([...profiles.keys(), ...team.keys()]);
  if (ownerUid) ids.add(ownerUid);
  return [...ids].map(uid => {
    const profile = profiles.get(uid);
    const grant = team.get(uid);
    const currentOwner = uid === ownerUid;
    const isSelf = uid === auth.currentUser?.uid;
    return {
      uid,
      displayName: profile?.displayName || grant?.label ||
        (currentOwner ? auth.currentUser?.displayName || "Business owner" : "Team member"),
      email: profile?.email || (currentOwner ? auth.currentUser?.email : "") || "",
      blocked: profile?.blocked === true,
      hasProfile: Boolean(profile),
      role: roleOf(uid),
      isSelf,
      currentOwner
    };
  }).sort((a, b) => {
    const order = { owner: 0, admin: 1, staff: 2, customer: 3 };
    return order[a.role] - order[b.role] ||
      a.displayName.localeCompare(b.displayName);
  });
}
function render() {
  const rawSearch = $("#users-search").value.trim().toLowerCase();
  const filter = $("#users-role-filter").value;
  const list = allUsers();
  const visible = list.filter(u => {
    if (filter === "admin") {
      if (u.role !== "admin" && u.role !== "owner") return false;
    } else if (filter !== "all" && u.role !== filter) return false;
    if (!rawSearch) return true;
    return [u.displayName, u.email, u.uid].join(" ").toLowerCase().includes(rawSearch);
  });
  const counts = {
    staff: list.filter(u => u.role === "staff").length,
    admins: list.filter(u => ["admin", "owner"].includes(u.role)).length
  };
  $("#stat-customers").textContent = profileTotal;
  $("#users-total").textContent = profileTotal;
  $("#users-staff").textContent = counts.staff;
  $("#users-admins").textContent = counts.admins;
  $("#users-directory").innerHTML = visible.length ? visible.map(user => {
    const locked = user.currentOwner || user.isSelf;
    const options = ["customer", "staff", "admin"].map(role =>
      '<option value="' + role + '"' + (user.role === role ? " selected" : "") + '>' +
      role.charAt(0).toUpperCase() + role.slice(1) + "</option>"
    ).join("");
    const badge = user.role === "owner" ? "Owner · protected" :
      user.role === "admin" ? "Administrator" : user.role === "staff" ? "Staff" : "Customer";
    return '<article class="user-row" data-user-uid="' + esc(user.uid) + '">' +
      '<div class="user-row-identity"><div class="user-avatar" aria-hidden="true">' +
      esc((user.displayName || "?").slice(0,1).toUpperCase()) + '</div>' +
      '<div class="user-identity-text"><strong>' + esc(user.displayName) + '</strong>' +
      '<span>' + esc(user.email || "No customer email on record") + '</span>' +
      '<small>' + esc(user.hasProfile ? "Registered customer profile" : "Team record only") +
      (user.blocked ? " · Blocked from ordering" : "") + '</small></div></div>' +
      '<div class="user-row-controls"><span class="user-role-badge ' + esc(user.role) + '">' + badge + '</span>' +
      (locked
        ? '<small class="user-protected-label">' + (user.currentOwner ? "Owner access is protected" : "Cannot change your own role") + "</small>"
        : '<label class="user-role-picker"><span>Role</span><select data-user-role="' +
          esc(user.uid) + '">' + options + '</select></label>' +
          '<button type="button" class="button button-outline" data-save-user="' +
          esc(user.uid) + '">Save role</button>') +
      (user.hasProfile && !user.isSelf
        ? '<button type="button" class="user-block-button" data-block-user="' + esc(user.uid) + '">' +
          (user.blocked ? "Unblock orders" : "Block orders") + '</button>'
        : "") +
      '</div></article>';
  }).join("") :
  '<div class="empty-workspace-state"><strong>No matching accounts</strong>' +
  '<p>Try a different name, email, or role filter. You can load more customer profiles below.</p></div>';
  const hasTeamOnly = list.some(person => !person.hasProfile);
  $("#users-visible-count").textContent =
    "Loaded " + profiles.size + " of " + profileTotal + " customer profiles" +
    (hasTeamOnly ? " · Team-only users shown separately" : "") +
    " · " + visible.length + " matching accounts";
  $("#users-load-more").hidden = !hasMore;
}

function queryPage(cursor) {
  const base = collection(db, "customers");
  return cursor
    ? query(base, orderBy(documentId()), startAfter(cursor), limit(PAGE_SIZE))
    : query(base, orderBy(documentId()), limit(PAGE_SIZE));
}

export async function refreshTeam(force = false) {
  const user = auth.currentUser;
  if (!user) return;
  if (loading) return loading;
  if (!force && lastLoaded && Date.now() - lastLoaded < FIVE_MINUTES) return;
  const accountUid = user.uid;
  const version = ++generation;
  const button = $("#refresh-team");
  button.disabled = true;
  statusText("Loading registered users and their access levels…");
  loading = (async () => {
    try {
      const [page, teamSnapshot, owner, count] = await Promise.all([
        getDocs(queryPage(null)),
        getDocs(collection(db, "team")),
        getDoc(doc(db, "admins", accountUid)),
        getCountFromServer(collection(db, "customers"))
      ]);
      if (generation !== version || auth.currentUser?.uid !== accountUid) return;
      profiles = new Map(page.docs.map(record => [record.id, record.data()]));
      team = new Map(teamSnapshot.docs.map(record => [record.id, record.data()]));
      ownerUid = owner.exists() && owner.data().active === true ? accountUid : null;
      profileTotal = count.data().count;
      lastProfileDoc = page.docs.at(-1) || null;
      hasMore = page.size === PAGE_SIZE;
      lastLoaded = Date.now();
      render();
      statusText("Updated " + timePH() + " PH · List cached for 5 minutes. Use Refresh users for immediate updates.");
    } catch (error) {
      console.error("Could not load account directory:", error);
      statusText("Could not read user profiles or role assignments. Verify admin permissions and published Firestore rules.");
      throw error;
    } finally {
      button.disabled = false;
      loading = null;
    }
  })();
  return loading;
}
export const refreshPeople = () => refreshTeam();

async function loadMore() {
  if (loadingMore || !hasMore || !auth.currentUser) return;
  loadingMore = true;
  const version = generation;
  const uid = auth.currentUser.uid;
  const btn = $("#users-load-more");
  btn.disabled = true;
  btn.textContent = "Loading…";
  try {
    const page = await getDocs(queryPage(lastProfileDoc));
    if (generation !== version || auth.currentUser?.uid !== uid) return;
    for (const record of page.docs) profiles.set(record.id, record.data());
    lastProfileDoc = page.docs.at(-1) || lastProfileDoc;
    hasMore = page.size === PAGE_SIZE;
    render();
    statusText("Loaded " + profiles.size + " customer profiles · Last refreshed " + timePH() + " PH.");
  } catch (error) {
    console.error(error);
    msg("Could not load more users. Try again.");
  } finally {
    loadingMore = false;
    btn.disabled = false;
    btn.textContent = "Load more users";
  }
}
export function clearTeamCache() {
  generation++;
  profiles.clear();
  team.clear();
  ownerUid = null;
  lastLoaded = 0;
  profileTotal = 0;
  lastProfileDoc = null;
  hasMore = false;
  $("#users-directory").innerHTML =
    '<p class="muted">Sign in as an administrator to load the user directory.</p>';
  $("#users-total").textContent = "—";
  $("#users-staff").textContent = "—";
  $("#users-admins").textContent = "—";
  $("#users-visible-count").textContent = "No users loaded.";
  $("#users-load-more").hidden = true;
}

async function saveRole(uid, role, label) {
  if (uid === auth.currentUser?.uid || uid === ownerUid) {
    throw new Error("You cannot modify your own or the protected owner's access.");
  }
  if (!["customer", "staff", "admin"].includes(role)) throw new Error("Invalid role");
  const current = roleOf(uid);
  if (current === role) return false;
  if (role === "admin" &&
      !confirm("Grant full ADMINISTRATOR access to " + label + "? Administrators can manage users, orders and reports.")) return false;
  if (role === "customer" && current !== "customer" &&
      !confirm("Remove " + label + "'s " + current + " access? They will become a regular customer.")) return false;
  if (role === "staff" && current === "customer" &&
      !confirm("Allow " + label + " to manage meals and transactions as STAFF?")) return false;
  if (role === "customer") {
    await deleteDoc(doc(db, "team", uid));
  } else {
    await setDoc(doc(db, "team", uid), {
      role, active: true, label: label.slice(0,80), updatedAt: serverTimestamp()
    });
  }
  await refreshTeam(true);
  return true;
}
export function initPeople() {
  $("#users-search").addEventListener("input", render);
  $("#users-role-filter").addEventListener("change", render);
  $("#users-load-more").addEventListener("click", loadMore);
  $("#refresh-team").addEventListener("click", async () => {
    try { await refreshTeam(true); }
    catch { msg("Could not refresh the users directory. Check Firestore permissions."); }
  });
  $("#users-directory").addEventListener("click", async event => {
    const save = event.target.closest("[data-save-user]");
    const block = event.target.closest("[data-block-user]");
    if (!save && !block) return;
    const uid = save?.dataset.saveUser || block?.dataset.blockUser;
    const user = allUsers().find(person => person.uid === uid);
    if (!user || user.currentOwner || user.isSelf) return;
    const button = save || block;
    button.disabled = true;
    try {
      if (save) {
        const row = button.closest("[data-user-uid]");
        const selected = row.querySelector("[data-user-role]").value;
        const changed = await saveRole(uid, selected, user.displayName);
        if (changed) msg("Role updated for " + user.displayName + ". Ask them to sign in again to apply the change.", true);
        else render();
      } else {
        const next = !user.blocked;
        if (!confirm((next ? "Block" : "Unblock") + " meal ordering for " + user.displayName + "?")) return;
        await updateDoc(doc(db, "customers", uid), { blocked: next });
        profiles.set(uid, { ...profiles.get(uid), blocked: next });
        render();
        msg(user.displayName + (next ? " cannot place new orders." : " can place orders again."), true);
      }
    } catch (error) {
      console.error("User management failed:", error);
      msg("Unable to update account. Check admin permissions and retry.");
    } finally {
      button.disabled = false;
    }
  });

  // Fallback for existing team members who do not yet have a customer profile.
  $("#team-form").addEventListener("submit", async event => {
    event.preventDefault();
    const uid = $("#member-uid").value.trim();
    const role = $("#member-role").value;
    const label = $("#member-label").value.trim();
    if (!/^[a-zA-Z0-9]{10,128}$/.test(uid) || !["staff", "admin"].includes(role)) {
      msg("Enter a valid existing Firebase UID and a staff/admin role.");
      return;
    }
    if (uid === auth.currentUser?.uid || uid === ownerUid) {
      msg("The original owner or your own role cannot be modified here.");
      return;
    }
    const existing = team.get(uid);
    if (existing?.active && existing.role === role) {
      msg("This account already has that access.", true);
      return;
    }
    if (role === "admin" && !confirm("Grant administrator permissions to this UID?")) return;
    const button = $("#team-form").querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await setDoc(doc(db, "team", uid), { role, active: $("#member-active").checked,
        label, updatedAt: serverTimestamp() });
      $("#team-form").reset();
      await refreshTeam(true);
      msg("Team access saved.", true);
    } catch (error) {
      console.error(error);
      msg("Could not save access. Check your admin permissions.");
    } finally {
      button.disabled = false;
    }
  });
}
