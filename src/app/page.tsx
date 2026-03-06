import Image from "next/image";
import { NYSBanner } from "@/components/nys-banner";
import { Dashboard } from "@/components/dashboard";
import { ElectionAuthorityProvider } from "@/components/election-authority-context";
import { ElectionAuthoritySelector } from "@/components/election-authority-selector";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <NYSBanner />

      {/* Main Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="hidden sm:block flex-shrink-0">
              <Image
                src="/NYSLogo.png"
                alt="New York State"
                width={72}
                height={72}
                className="brightness-0 invert"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-white/70 mb-1">
                New York State Board of Elections
              </p>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold leading-tight">
                Dr. John L. Flateau Voting &amp; Elections Database of New York Act
              </h1>
            </div>
          </div>
        </div>
      </header>

      <ElectionAuthorityProvider>
        {/* Navigation Bar */}
        <nav className="bg-accent text-accent-foreground border-b border-primary/20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2.5">
              <span className="text-sm font-medium border-b-2 border-nys-gold pb-1">
                Election Data Portal
              </span>
              <ElectionAuthoritySelector />
            </div>
          </div>
        </nav>

        <main className="flex-1">
          <div className="container mx-auto px-4 py-8">
            <Dashboard />
          </div>
        </main>

        <footer className="bg-primary text-primary-foreground py-6">
          <div className="container mx-auto px-4 text-center text-sm opacity-80">
            &copy; {new Date().getFullYear()} New York State Board of Elections. All Rights Reserved.
          </div>
        </footer>
      </ElectionAuthorityProvider>
    </div>
  );
}
