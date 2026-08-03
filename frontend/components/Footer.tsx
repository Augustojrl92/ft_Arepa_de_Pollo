import Link from "next/link";
import LastUpdateText from "./LastUpdateText";

export default function Footer() {
  return (
    <footer className="w-full border-t border-border/60 bg-card/50 backdrop-blur-sm px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 text-xs md:flex-row md:items-center md:justify-between">
        
        <div className="flex items-center gap-2 text-text-secondary text-center md:text-left">
          <span className="text-text">
            <span className="font-semibold">AEDLPH</span> © 2026
          </span>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
          <nav className="flex flex-wrap items-center justify-center gap-1 p-1">
            <Link
              href="/status"
              className="px-2 py-1.5 sm:px-3 text-text-secondary transition-all duration-200 hover:text-accent"
            >
              Status
            </Link>
            <div className="h-3 w-px bg-border/60 shrink-0" aria-hidden="true" />
            <Link
              href="/privacy"
              className="px-2 py-1.5 sm:px-3 text-text-secondary transition-all duration-200 hover:text-accent"
            >
              Privacy Policy
            </Link>
            <div className="h-3 w-px bg-border/60 shrink-0" aria-hidden="true" />
            <Link
              href="/terms"
              className="px-2 py-1.5 sm:px-3 text-text-secondary transition-all duration-200 hover:text-accent"
            >
              Terms of Service
            </Link>
          </nav>
          
          <LastUpdateText />
        </div>

      </div>
    </footer>
  );
}