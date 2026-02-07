"use client";

import { auth } from "../../../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function signIn() {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/upload");
    } catch (e: any) {
      setError(e.message || "Sign-in failed");
    }
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Inventory Alchemy 🔮</h1>
      <p>Sign in to upload your restaurant datasets.</p>

      <button onClick={signIn} style={{ padding: 12, marginTop: 12 }}>
        Sign in with Google
      </button>

      {error && <p style={{ marginTop: 12, color: "red" }}>{error}</p>}
    </main>
  );
}
