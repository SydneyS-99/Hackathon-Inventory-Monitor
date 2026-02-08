"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import "./navbar.css";

type CardNavLink = {
  label: string;
  href: string;
  ariaLabel: string;
};

export type CardNavItem = {
  label: string;
  bgColor: string;
  textColor: string;
  links: CardNavLink[];
};

export interface CardNavProps {
  logo?: string;
  logoAlt?: string;
  brandText?: string;
  items?: CardNavItem[];
  className?: string;
  ease?: string;
  baseColor?: string;
  menuColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
}

const ArrowIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={className}>
    <path
      fill="currentColor"
      d="M7 17a1 1 0 0 1 0-2h7.586L6.293 6.707a1 1 0 1 1 1.414-1.414L16 13.586V6a1 1 0 1 1 2 0v10a1 1 0 0 1-1 1H7z"
    />
  </svg>
);

export default function Navbar({
  logo,
  logoAlt = "Logo",
  brandText = "The Magic Bean Stock",
  items,
  className = "",
  ease = "power3.inOut",
  baseColor = "rgba(10, 8, 18, 0.75)",
  menuColor = "#fff",
  buttonBgColor,
  buttonTextColor,
}: CardNavProps) {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const pathname = usePathname();
  const router = useRouter();

  const navRef = useRef<HTMLElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const hideOn = ["/login", "/signup", "/forgot-password"];
  const shouldHide = hideOn.includes(pathname);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  const isPublicRoute = (href: string) =>
    href === "/" || href === "/login" || href === "/signup" || href === "/forgot-password";

  const defaultItems: CardNavItem[] = [
    {
      label: "Dashboard",
      bgColor: "#151225",
      textColor: "#ffffff",
      links: [{ label: "Open", href: "/dashboard", ariaLabel: "Go to Dashboard" }],
    },
    {
      label: "Sustainability",
      bgColor: "#111827",
      textColor: "#ffffff",
      links: [{ label: "Open", href: "/sustainability", ariaLabel: "Go to Sustainability" }],
    },
    {
      label: "Upload Datasets",
      bgColor: "#0f172a",
      textColor: "#ffffff",
      links: [{ label: "Open", href: "/upload", ariaLabel: "Go to Inventory" }],
    },
    {
      label: "Home",
      bgColor: "#1b1432",
      textColor: "#ffffff",
      links: [{ label: "Open", href: "/", ariaLabel: "Go to Home" }],
    },
  ];

  const navItems = (items && items.length ? items : defaultItems).slice(0, 4);

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      const href = item.links?.[0]?.href ?? "/";
      if (!user && !isPublicRoute(href)) return false;
      return true;
    });
  }, [navItems, user]);

  const visibleCount = visibleNavItems.length;

  const calculateHeight = () => {
  const navEl = navRef.current;
  if (!navEl) return 450; // Increased fallback for taller cards

  const contentEl = navEl.querySelector(".card-nav-content") as HTMLElement | null;
  if (!contentEl) return 60;

  const prevVisibility = contentEl.style.visibility;
  const prevDisplay = contentEl.style.display;

  contentEl.style.visibility = "hidden";
  contentEl.style.display = "flex";
  
  const topBar = 60;
  // Increase this padding if the cards feel cut off at the bottom
  const bottomBuffer = 40; 
  const contentHeight = contentEl.scrollHeight;

  contentEl.style.visibility = prevVisibility;
  contentEl.style.display = prevDisplay;

  return topBar + contentHeight + bottomBuffer;
};

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    const cards = Array.from(navEl.querySelectorAll<HTMLElement>(".nav-card"));

    // Set initial states explicitly
    gsap.set(navEl, { height: 60, overflow: "hidden" });
    gsap.set(cards, { y: 20, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight(),
      duration: 0.6,
      ease: ease,
    });

    tl.to(
      cards,
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.08,
      },
      "-=0.3"
    );

    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    if (isExpanded && tlRef.current) {
      tlRef.current.progress(1);
    }

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
  }, [ease, visibleCount]);

  useLayoutEffect(() => {
    const rebuild = () => {
      if (!tlRef.current) return;
      tlRef.current.kill();
      const newTl = createTimeline();
      if (!newTl) return;
      if (isExpanded) newTl.progress(1);
      tlRef.current = newTl;
    };

    window.addEventListener("resize", rebuild);
    return () => window.removeEventListener("resize", rebuild);
  }, [isExpanded, visibleCount]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;

    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      // Invalidate ensures height is re-calculated for expansion
      tl.invalidate().restart(); 
    } else {
      setIsHamburgerOpen(false);
      tl.reverse();
      tl.eventCallback("onReverseComplete", () => {
        setIsExpanded(false);
      });
    }
  };

  if (shouldHide) return null;

  return (
    <header className="nav-wrap">
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? "open" : ""} ${className}`}
        style={{ backgroundColor: baseColor }}
      >
        <div className="card-nav-top">
          <div
            className={`hamburger-menu ${isHamburgerOpen ? "open" : ""}`}
            onClick={toggleMenu}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleMenu();
              }
            }}
            role="button"
            aria-label={isExpanded ? "Close menu" : "Open menu"}
            tabIndex={0}
            style={{ color: menuColor }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          <div className="logo-container">
            {logo ? (
              <img src={logo} alt={logoAlt} className="logo" />
            ) : (
              <Link href="/" className="brand-text-link" aria-label="Go to home">
                {brandText}
              </Link>
            )}
          </div>

          <div className="nav-right">
            {user ? (
              <>
                <span className="user-pill" title={user.email ?? ""}>
                  {user.displayName ?? user.email ?? "Signed in"}
                </span>
                <button
                  type="button"
                  className="card-nav-cta-button"
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  className="card-nav-cta-button ghost"
                  href="/login"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    color: buttonTextColor || "#fff",
                  }}
                >
                  Login
                </Link>
                <Link
                  className="card-nav-cta-button"
                  href="/signup"
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {visibleNavItems.map((item, idx) => {
            const href = item.links?.[0]?.href ?? "/";
            const ariaLabel = item.links?.[0]?.ariaLabel ?? item.label;

            return (
              <div
                key={`${item.label}-${idx}`}
                className="nav-card"
                style={{ backgroundColor: item.bgColor, color: item.textColor }}
              >
                <div className="nav-card-label">{item.label}</div>
                <Link
                  href={href}
                  aria-label={ariaLabel}
                  className="nav-card-full-link"
                  onClick={() => {
                    if (isExpanded) toggleMenu();
                  }}
                >
                  <span>Open</span>
                  <ArrowIcon className="nav-card-link-icon" />
                </Link>
              </div>
            );
          })}
        </div>
      </nav>
    </header>
  );
}