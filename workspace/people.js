import { auth, db, $, esc, msg } from "./shared.js";
import {
  collection, doc, getDocs, getDoc, getCountFromServer,
  query, limit, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const FIVE_MINUTES = 5 * 60 * 1000;
let customers = [];
let team = [];
let teamLastLoaded = 0;
let teamInFlight = null;
let ownerIsCurrentUser = false;

function statusText(message) {
  const el = $("#team-refresh-status");
  if (el) el.textContent = message;
}
function timeInPH(now) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit"
  }).format(now);
}
function renderTeam() {
  const current = auth.currentUser;
  const ownerCard = ownerIsCurrentUser && current
    ? '<div class="customer-directory-item">' +
      '<div><strong>' + esc(current.displayName || "Business owner (you)") + '</strong>' +
      '<small>' + esc(current.email || "Google account") + '</small>' +
      '<small>Owner administrator · Active · Protected in admins collection</small></div>' +
      '<span class="team-role-tag">Owner</span></div>'
    : "";
  const cards = team.map(person =>
    '<div class="customer-directory-item">' +
    '<div><strong>' + esc(person.label || "Team member") + '</strong>' +
    '<small>UID: ' + esc(person.uid) + '</small>' +
    '<small>' + esc(person.role) + ' · ' + (person.active ? "Active" : "Disabled") + '</small></div>' +
    '<button type="button" data-edit-team="' + esc(person.uid) + '">Edit access</button></div>'
  ).join("");
  $("#team-directory").innerHTML = ownerCard + cards ||
    '<p class="muted">No team members assigned yet. Add a staff member using their Firebase UID.</p>';
}

// Only an admin can list all team entries. The owner's admins/{uid} document
// is individually readable; Firestore rules do not permit listing all owners.
export async function refreshTeam(force = false) {
  if (!auth.currentUser) return;
  if (teamInFlight) return teamInFlight;
  if (!force && teamLastLoaded && Date.now() - teamLastLoaded < FIVE_MINUTES) {
    return;
  }
  const button = $("#refresh-team");
  button.disabled = true;
  statusText("Checking authorized team members…");
  teamInFlight = (async () => {
    try {
      const uid = auth.currentUser.uid;
      const [members, owner] = await Promise.all([
        getDocs(collection(db, "team")),
        getDoc(doc(db, "admins", uid))
      ]);
      if (auth.currentUser?.uid !== uid) return;
      team = members.docs.map(record => ({ uid: record.id, ...record.data() }))
        .sort((a, b) => String(a.label || a.uid).localeCompare(String(b.label || b.uid)));
      ownerIsCurrentUser = owner.exists() && owner.data().active === true;
      teamLastLoaded = Date.now();
      renderTeam();
      statusText("Updated " + timeInPH(new Date(teamLastLoaded)) + " PH · Auto-refresh every 5 minutes while this page is open.");
    } catch (error) {
      console.error("Unable to load team directory:", error);
      statusText("Could not load team members. Check your admin permissions and try Refresh.");
      throw error;
    } finally {
      button.disabled = false;
      teamInFlight = null;
    }
  })();
  return teamInFlight;
}

async function refreshCustomers() {
  const [list, count] = await Promise.all([
    getDocs(query(collection(db, "customers"), limit(100))),
    getCountFromServer(collection(db, "customers"))
  ]);
  customers = list.docs.map(record => ({ uid: record.id, ...record.data() }));
  $("#stat-customers").textContent = count.data().count;
  $("#customer-directory").innerHTML = customers.map(person =>
    '<div class="customer-directory-item"><div><strong>' + esc(person.displayName) + '</strong>' +
    '<small>' + esc(person.email) + '</small>' +
    '<small>' + (person.blocked ? "Blocked" : "Active") + '</small></div>' +
    '<button class="button button-outline" data-block="' + esc(person.uid) + '">' +
    (person.blocked ? "Unblock" : "Block") + '</button></div>'
  ).join("") || '<p class="muted">No customer profiles yet.</p>';
}

// Two independent reads: one failed customer query should never prevent the
// authorized team directory from appearing.
export async function refreshPeople() {
  const results = await Promise.allSettled([refreshCustomers(), refreshTeam()]);
  if (results[0].status === "rejected") {
    $("#customer-directory").innerHTML =
      '<p class="muted">Customer directory unavailable. Try refreshing this workspace.</p>';
    console.error("Customer directory failed:", results[0].reason);
  }
  if (results[1].status === "rejected") console.error("Team directory failed:", results[1].reason);
  if (results.some(x => x.status === "rejected")) {
    throw new Error("One or more directories could not be loaded.");
  }
}

export function clearTeamCache() {
  team = [];
  teamLastLoaded = 0;
  ownerIsCurrentUser = false;
  statusText("Team list will load when you sign in.");
  $("#team-directory").innerHTML = '<p class="muted">Sign in as an administrator to load team access.</p>';
}

export function initPeople() {
  $("#refresh-team").addEventListener("click", async () => {
    try { await refreshTeam(true); }
    catch { msg("Could not refresh team permissions. Verify Firestore rules and connection."); }
  });
  $("#customer-directory").addEventListener("click", async event => {
    const button = event.target.closest("[data-block]");
    if (!button) return;
    const person = customers.find(x => x.uid === button.dataset.block);
    if (!person) return;
    if (!confirm((person.blocked ? "Unblock" : "Block") + " this customer account?")) return;
    button.disabled = true;
    try {
      await updateDoc(doc(db, "customers", person.uid), { blocked: !person.blocked });
      await refreshCustomers();
      msg("Customer access updated.", true);
    } catch (error) {
      console.error(error);
      msg("Customer moderation failed.");
      button.disabled = false;
    }
  });
  $("#team-directory").addEventListener("click", event => {
    const button = event.target.closest("[data-edit-team]");
    if (!button) return;
    const person = team.find(x => x.uid === button.dataset.editTeam);
    if (!person) return;
    $("#member-uid").value = person.uid;
    $("#member-label").value = person.label || "";
    $("#member-role").value = person.role;
    $("#member-active").checked = person.active === true;
    $("#team-form").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#team-form").addEventListener("submit", async event => {
    event.preventDefault();
    const uid = $("#member-uid").value.trim();
    const role = $("#member-role").value;
    const label = $("#member-label").value.trim();
    if (!/^[a-zA-Z0-9]{10,128}$/.test(uid) || !["staff", "admin"].includes(role)) {
      msg("Enter a valid Firebase Authentication UID and staff/admin role.");
      return;
    }
    if (uid === auth.currentUser?.uid) {
      msg("You cannot change your own team role here. Ask another administrator to review access.");
      return;
    }
    const button = $("#team-form").querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await setDoc(doc(db, "team", uid), {
        role, active: $("#member-active").checked, label,
        updatedAt: serverTimestamp()
      });
      $("#team-form").reset();
      await refreshTeam(true);
      msg("Team role saved. The member can sign in with Google to access the assigned workspace.", true);
    } catch (error) {
      console.error(error);
      msg("Could not save team permissions.");
    } finally {
      button.disabled = false;
    }
  });
}
