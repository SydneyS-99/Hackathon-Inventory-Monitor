"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import "./navbar.css";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  // optional: hide navbar on auth pages (comment out if you want it everywhere)
  const hideOn = ["/login", "/signup", "/forgot-password"];
  if (hideOn.includes(pathname)) return null;

  return (
    <header className="nav-wrap">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brand-icon">☕✨</span>
          <span className="brand-text">The Magic Bean Stock</span>
        </Link>

        <div className="nav-links">
          <Link className="nav-link" href="/dashboard">
            Dashboard
          </Link>
          <Link className="nav-link" href="/upload">
            Upload
          </Link>
          <Link className="nav-link" href="/sustainability">
            Sustainability
          </Link>
        </div>

        <div className="nav-right">
          {user ? (
            <>
              <span className="user-pill" title={user.email ?? ""}>
                {user.displayName ? user.displayName : user.email ?? "Signed in"}
              </span>
              <button className="nav-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="nav-btn ghost" href="/login">
                Login
              </Link>
              <Link className="nav-btn" href="/signup">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
