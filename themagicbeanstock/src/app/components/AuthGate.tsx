"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { usePathname, useRouter } from "next/navigation";

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password"];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If the route is public, don’t block it.
    if (PUBLIC_ROUTES.includes(pathname)) {
      setChecking(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      }
      setChecking(false);
    });

    return () => unsub();
  }, [pathname, router]);

  // Optional: while checking auth for protected routes, show a simple loader
  if (!PUBLIC_ROUTES.includes(pathname) && checking) {
    return (
      <div style={{ padding: 24, color: "white" }}>
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}
