"use client";
import FloatingLines from "../components/background";
import { auth } from "../../../lib/firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import "./signup.css";
import StarBorder from "../components/StarBorder";

export default function SignUpPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      if (displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }

      router.push("/upload");
    } catch (err: any) {
      setError(err?.message || "Sign-up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <FloatingLines />
      <div className="auth-card">
        <img src="/sprout.png" alt="Logo" className="auth-logo" width="10%"/>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Join The Magic Bean Stock</p>

        <form className="auth-form" onSubmit={handleSignup}>
          <label className="auth-label">
            Name
            <input
              className="auth-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name here..."
              required
              disabled={loading}
            />
          </label>

          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="Enter your email here..."
              disabled={loading}
            />
          </label>

          <label className="auth-label">
            Password
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              placeholder="Enter your password here..."
              disabled={loading}
            />
          </label>

          <label className="auth-label">
            Confirm password
            <input
              className="auth-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              placeholder="Confirm your password here..."
              disabled={loading}
            />
          </label>

          <StarBorder as="button" className="primary-btn" color="magenta" speed="5s" thickness={3} type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </StarBorder>
        </form>

        {error && <p className="error-text">{error}</p>}

        <div className="auth-links">
          <Link href="/login">Back to login</Link>
        </div>
      </div>
    </main>
  );
}
