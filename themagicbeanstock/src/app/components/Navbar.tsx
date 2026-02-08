"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
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
  ease = "power3.out",
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
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // ✅ compute, but DO NOT return yet
  const hideOn = ["/login", "/signup", "/forgot-password"];
  const shouldHide = hideOn.includes(pathname);

  // Auth state
  React.useEffect(() => {
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
      label: "Inventory",
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

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      const contentEl = navEl.querySelector(".card-nav-content") as HTMLElement | null;
      if (contentEl) {
        const wasVisible = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;

        contentEl.style.visibility = "visible";
        contentEl.style.pointerEvents = "auto";
        contentEl.style.position = "static";
        contentEl.style.height = "auto";

        contentEl.offsetHeight;

        const topBar = 60;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return topBar + contentHeight + padding;
      }
    }

    return 260;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 60, overflow: "hidden" });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease,
    });

    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 }, "-=0.1");

    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, navItems.length]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;

    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback("onReverseComplete", () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) cardsRef.current[i] = el;
  };

  // ✅ NOW it's safe to return null (after hooks)
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
              // eslint-disable-next-line @next/next/no-img-element
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
          {navItems.map((item, idx) => {
            const href = item.links?.[0]?.href ?? "/";
            const ariaLabel = item.links?.[0]?.ariaLabel ?? item.label;

            if (!user && !isPublicRoute(href)) return null;

            return (
              <div
                key={`${item.label}-${idx}`}
                className="nav-card"
                ref={setCardRef(idx)}
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
