export default function PlatformLoading() {
  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 border-b border-white/10 pb-6">
          <div className="skeleton mb-3 h-4 w-40" />
          <div className="skeleton h-14 w-full max-w-4xl" />
        </div>
        <div className="mb-5 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-32" />
          ))}
        </div>
        <div className="grid grid-cols-[minmax(320px,0.7fr)_minmax(0,1.3fr)] gap-5 max-xl:grid-cols-1">
          <div className="skeleton h-96" />
          <div className="skeleton h-96" />
        </div>
      </div>
    </main>
  );
}
