import "./globals.css";
import Navbar from "./components/Navbar";
import AuthGate from "./components/AuthGate";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthGate>
          <Navbar />
          {children}
        </AuthGate>
      </body>
    </html>
  );
}
