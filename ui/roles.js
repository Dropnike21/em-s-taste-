import { db } from "../firebase-config.js";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

/* Firestore remains the authority; this only resolves a role for navigation. */
export async function getWorkspaceRole(user) {
  if (!user || !user.emailVerified) return null;
  const token = await getIdTokenResult(user);
  if (token.claims?.firebase?.sign_in_provider !== "google.com") return null;
  const owner = await getDoc(doc(db, "admins", user.uid));
  if (owner.exists() && owner.data().active === true) return "admin";
  const team = await getDoc(doc(db, "team", user.uid));
  if (team.exists() && team.data().active === true &&
      ["admin", "staff"].includes(team.data().role)) return team.data().role;
  return null;
}