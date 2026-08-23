// Loading skeleton shown by each portal's loading.tsx during navigation.
export default function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 w-48 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-6 flex items-end gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-1 rounded-t bg-slate-100" style={{ height: `${30 + ((i * 37) % 90)}px` }} />
            ))}
          </div>
        </div>
        <div className="h-56 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-3 w-full rounded bg-slate-100" />)}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="mb-3 h-4 w-full rounded bg-slate-100 last:mb-0" />)}
      </div>
    </div>
  );
}
