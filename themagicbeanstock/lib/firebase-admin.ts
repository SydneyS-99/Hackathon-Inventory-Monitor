import * as admin from "firebase-admin";

const firebaseConfig = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
    });
    console.log("✅ Firebase Admin successfully initialized.");
  } catch (error) {
    console.error("❌ Firebase Initialization Error:", error);
  }
}

export const db = admin.firestore();