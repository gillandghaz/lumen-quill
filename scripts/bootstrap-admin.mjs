// Creates (or repairs) THE single administrator account. Idempotent.
//
//   node --env-file=<secrets file> scripts/bootstrap-admin.mjs
//
// Reads FIREBASE_* (service account), ADMIN_EMAIL and ADMIN_USERNAME from the environment.
// - Finds the Firebase user by e-mail, or creates it (verified e-mail, no password: sign in with Google,
//   then set a password under Account if you also want e-mail sign-in).
// - Sets the custom claim role=admin, writes the app profile (role admin) and reserves the username.
// - Refuses if a DIFFERENT account already has the admin role (there is exactly one admin).
// Prints only ids and status, never secrets.
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, ADMIN_EMAIL, ADMIN_USERNAME } = process.env;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !ADMIN_EMAIL || !ADMIN_USERNAME) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY / ADMIN_EMAIL / ADMIN_USERNAME");
  process.exit(1);
}
const email = ADMIN_EMAIL.trim().toLowerCase();
const username = ADMIN_USERNAME.trim().toLowerCase();
if (!/^[a-z0-9](?:[a-z0-9_.]*[a-z0-9])?$/.test(username) || username.length < 3 || username.length > 24) {
  console.error("ADMIN_USERNAME is not a valid username");
  process.exit(1);
}

const app = initializeApp({
  credential: cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }),
  projectId: FIREBASE_PROJECT_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

const others = await db.collection("users").where("role", "==", "admin").get();
let user;
try {
  user = await auth.getUserByEmail(email);
  console.log("Firebase account found:", user.uid);
} catch (e) {
  if (e?.code !== "auth/user-not-found") throw e;
  user = await auth.createUser({ email, emailVerified: true, displayName: username });
  console.log("Firebase account created:", user.uid);
}
if (others.docs.some((d) => d.id !== user.uid)) {
  console.error("Another account already has the admin role. Refusing (exactly one admin).");
  process.exit(1);
}
if (!user.emailVerified) await auth.updateUser(user.uid, { emailVerified: true });
if (user.disabled) await auth.updateUser(user.uid, { disabled: false });
await auth.setCustomUserClaims(user.uid, { role: "admin" });

const now = Date.now();
await db.runTransaction(async (tx) => {
  const nameRef = db.collection("usernames").doc(username);
  const userRef = db.collection("users").doc(user.uid);
  const [name, prof] = await Promise.all([tx.get(nameRef), tx.get(userRef)]);
  if (name.exists && name.get("uid") !== user.uid) throw new Error("Username is taken by another account");
  const prev = prof.exists ? prof.data() : null;
  if (prev?.username && prev.username !== username) tx.delete(db.collection("usernames").doc(prev.username));
  tx.set(nameRef, { uid: user.uid });
  tx.set(userRef, {
    email,
    username,
    role: "admin",
    disabled: false,
    createdAt: prev?.createdAt ?? now,
    createdBy: prev?.createdBy ?? "bootstrap",
    lastLoginAt: prev?.lastLoginAt ?? null,
    usernameChangedAt: prev?.usernameChangedAt ?? null,
    settings: prev?.settings ?? { mode: "sonata", timeZone: "Asia/Jakarta", nextDay: "ask", fontScale: 1 },
  });
});
// The new claim applies to fresh tokens only: sign out of everything once.
await auth.revokeRefreshTokens(user.uid);
console.log(`Admin ready: ${username} (uid ${user.uid}). Sign in with Google or set a password under Account.`);
process.exit(0);
