export default function Loading() {
  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[312px_minmax(0,1fr)] gap-6 max-xl:grid-cols-1">
        <aside className="section-panel h-[calc(100vh-4rem)] p-7 max-xl:h-auto">
          <div className="flex items-center gap-3 border-b border-white/10 pb-7">
            <div className="skeleton h-12 w-12" />
            <div className="grid flex-1 gap-2">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-5 w-36" />
            </div>
          </div>
          <div className="mt-7 grid gap-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="skeleton h-11 w-full" />
            ))}
          </div>
        </aside>
        <section className="grid gap-5">
          <div className="skeleton h-40 w-full" />
          <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-32" />
            ))}
          </div>
          <div className="skeleton h-80 w-full" />
        </section>
      </div>
    </main>
  );
}
