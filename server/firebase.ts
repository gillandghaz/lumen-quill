import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * The ONLY place that touches the Firebase Admin SDK (enforced by ESLint).
 * Credentials come from server-only environment variables; they never reach the browser.
 */
function app(): App {
  if (getApps().length > 0) return getApp();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin is not configured");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

let db: Firestore | null = null;
export function firestore(): Firestore {
  if (!db) {
    db = getFirestore(app());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export function adminAuth(): Auth {
  return getAuth(app());
}

/** OAuth access token of the service account (for the Identity Toolkit admin config API). */
export async function serviceAccessToken(): Promise<{ projectId: string; token: string }> {
  const a = app();
  const credential = a.options.credential;
  const projectId = a.options.projectId;
  if (!credential || !projectId) throw new Error("Firebase Admin is not configured");
  const { access_token } = await credential.getAccessToken();
  return { projectId, token: access_token };
}

export { AggregateField, FieldValue, Timestamp, type Firestore, type Transaction, type DocumentSnapshot, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";
export type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
