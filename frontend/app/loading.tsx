/**
 * app/loading.tsx — Global Route Loading State
 * ══════════════════════════════════════════════
 * Shown by Next.js during Suspense / route-level data fetching.
 * Animated road pulse + skeleton bars, fully on-brand.
 * Must be a Server Component (no 'use client') for instant streaming.
 */

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col items-center justify-center p-6">

      {/* Animated logo mark */}
      <div className="relative mb-10">
        {/* Outer pulse ring */}
        <div className="absolute inset-0 rounded-full border-2 border-[#FF6200]/30 animate-ping" />
        {/* Inner ring */}
        <div className="absolute inset-2 rounded-full border border-[#FF6200]/20 animate-pulse" />
        {/* Icon */}
        <div className="relative w-16 h-16 rounded-full bg-[#FF6200]/10 border border-[#FF6200]/30 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#FF6200]" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>

      {/* Road segment skeleton */}
      <div className="w-full max-w-md space-y-4 mb-8">
        {/* Simulated navbar */}
        <div className="h-12 rounded-2xl bg-white/[0.04] animate-pulse" />

        {/* Simulated card grid */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-white/[0.04] animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>

        {/* Simulated map block */}
        <div className="h-48 rounded-2xl bg-white/[0.04] animate-pulse relative overflow-hidden">
          {/* Shimmer sweep */}
          <div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-[shimmer_1.8s_ease-in-out_infinite]"
            style={{ animationName: 'shimmerSweep' }}
          />
        </div>

        {/* Simulated text rows */}
        <div className="space-y-2">
          <div className="h-4 rounded-full bg-white/[0.04] animate-pulse w-3/4" />
          <div className="h-4 rounded-full bg-white/[0.04] animate-pulse w-1/2" style={{ animationDelay: '100ms' }} />
          <div className="h-4 rounded-full bg-white/[0.04] animate-pulse w-2/3" style={{ animationDelay: '200ms' }} />
        </div>
      </div>

      {/* Pulsing road dots (loading indicator) */}
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[#FF6200]/60"
            style={{
              animation: `pulse 1.4s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>

      <p className="text-white/20 text-xs mt-4 font-mono tracking-widest">
        ROAD SAFETY AI
      </p>

      <style>{`
        @keyframes shimmerSweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}
