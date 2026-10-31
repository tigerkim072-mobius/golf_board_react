import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

export const auth = hasFirebaseConfig
  ? getAuth(
      getApps().length > 0
        ? getApp()
        : initializeApp(firebaseConfig),
    )
  : null;
