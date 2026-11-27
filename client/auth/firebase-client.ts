"use client";

import { getApp, getApps, initializeApp } from "@firebase/app";
import { browserSessionPersistence, getAuth, setPersistence, type Auth } from "@firebase/auth";

/**
 * The Firebase web config is public by design; all authorisation happens on the server.
 * The browser SDK is used ONLY to obtain an ID token at sign-in, which is exchanged for an HttpOnly cookie.
 * Persistence is per-tab session storage, and we sign the SDK out right after the exchange,
 * so no long-lived Firebase credential stays in the browser.
 */
let ready: Promise<Auth> | null = null;

export function clientAuth(): Promise<Auth> {
  if (!ready) {
    const app = getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    const auth = getAuth(app);
    auth.languageCode = "en";
    ready = setPersistence(auth, browserSessionPersistence).then(() => auth);
  }
  return ready;
}
