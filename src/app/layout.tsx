import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthProvider } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "AfricaSkills — Forme. Certifie. Emploie.",
  description:
    "La première plateforme panafricaine de formation, certification et emploi. Anglais, Dev, Data, IA, Cybersécurité, Design, Entrepreneuriat.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#0A0A0A] text-neutral-100 antialiased">
        <AuthProvider>
          <Navbar />
          <main className="relative">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
