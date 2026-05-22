'use client'

/**
 * components/shared/Skeleton.tsx
 * ════════════════════════════════
 * Pulsing skeleton screens — replace spinners everywhere.
 */

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/[0.06] shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-white/[0.06] rounded-full w-3/4" />
          <div className="h-2 bg-white/[0.04] rounded-full w-1/2" />
        </div>
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full" />
      <div className="h-2 bg-white/[0.04] rounded-full w-5/6" />
      <div className="h-2 bg-white/[0.06] rounded-full w-2/3" />
    </div>
  )
}

export function ChatSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-white/[0.06] shrink-0 mt-1" />
      <div className="flex-1 space-y-2 max-w-[80%]">
        <div className="h-3 bg-white/[0.06] rounded-full w-full" />
        <div className="h-3 bg-white/[0.04] rounded-full w-4/5" />
        <div className="h-3 bg-white/[0.06] rounded-full w-2/3" />
        <div className="h-3 bg-white/[0.04] rounded-full w-3/4" />
      </div>
    </div>
  )
}

export function MapServiceSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06]">
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-white/[0.06] rounded-full w-2/3" />
            <div className="h-2 bg-white/[0.04] rounded-full w-1/3" />
          </div>
          <div className="w-12 h-7 rounded-lg bg-white/[0.06]" />
        </div>
      ))}
    </div>
  )
}

export function ReportCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-white/[0.06] rounded-full w-1/3" />
        <div className="h-6 w-24 bg-white/[0.06] rounded-full" />
      </div>
      <div className="h-px bg-white/[0.06]" />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="p-3 rounded-xl bg-white/[0.03] space-y-1.5">
            <div className="h-2 bg-white/[0.04] rounded-full w-1/2" />
            <div className="h-3 bg-white/[0.06] rounded-full w-3/4" />
          </div>
        ))}
      </div>
      <div className="h-10 bg-white/[0.04] rounded-xl w-full" />
    </div>
  )
}

export function StatSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2 bg-white/[0.04] rounded-full w-1/2" />
        <div className="h-3 bg-white/[0.06] rounded-full w-2/3" />
      </div>
    </div>
  )
}
