"use client";

import { auth } from "../../../lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { FormEvent, useState } from "react";
import "./forgot-password.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setStatus("Reset link sent! Check your inbox.");
    } catch (err: any) {
      setError(err?.message || "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">We’ll email you a reset link.</p>

        <form className="auth-form" onSubmit={handleReset}>
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </label>

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {status && <p className="status-text">{status}</p>}
        {error && <p className="error-text">{error}</p>}

        <div className="auth-links">
          <Link href="/login">Back to login</Link>
        </div>
      </div>
    </main>
  );
}
