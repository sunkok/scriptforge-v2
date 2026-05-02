import Image from "next/image";
import ScriptLauncher from "./ScriptLauncher";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-canvas)] px-4">
      {/* Subtle radial vignette — brightens the center slightly */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(99,102,241,0.04) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative flex flex-col items-center gap-10 w-full max-w-[480px]">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/scriptforge-logo.png"
            alt="Script Forge logo"
            width={200}
            height={200}
            className="w-[200px] h-auto"
            priority
          />
          <div className="flex flex-col items-center gap-1.5">
            <h1
              className="text-white text-[48px] leading-none tracking-tight"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontWeight: 700 }}
            >
              Script Forge
            </h1>
            <p className="text-[var(--color-fg-secondary)] text-[14px] font-sans">
              Browser-based screenwriting
            </p>
          </div>
        </div>

        {/* Launcher card */}
        <ScriptLauncher />
      </div>
    </main>
  );
}
