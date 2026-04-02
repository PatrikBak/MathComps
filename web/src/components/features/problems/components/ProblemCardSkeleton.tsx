export const ProblemCardSkeleton = () => (
  <div className="bg-surface border border-foreground/10 rounded-lg shadow-lg animate-pulse overflow-hidden">
    {/* Card Header - matches ProblemCard header structure */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/10">
      <div className="flex items-center gap-3">
        <div className="h-4 w-8 bg-foreground/10 rounded"></div>
        <div className="h-5 w-20 bg-foreground/10 rounded"></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-16 bg-foreground/10 rounded-md"></div>
      </div>
    </div>

    {/* Card Body - matches ProblemCard body structure */}
    <div className="px-6 py-5">
      <div className="space-y-3">
        <div className="h-4 bg-foreground/10 rounded w-full"></div>
        <div className="h-4 bg-foreground/10 rounded w-5/6"></div>
        <div className="h-4 bg-foreground/10 rounded w-3/4"></div>
        <div className="h-4 bg-foreground/10 rounded w-1/2"></div>
      </div>
      {/* Author section skeleton */}
      <div className="flex items-center justify-end mt-4">
        <div className="h-4 w-32 bg-foreground/10 rounded"></div>
      </div>
    </div>

    {/* Card Footer - matches ProblemCard footer structure */}
    <div className="border-t bg-surface/50 border-foreground/10">
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-x-6">
        {/* Tags section */}
        <div>
          <div className="px-6 pt-4 md:pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-8 w-16 bg-foreground/10 rounded-full"></div>
              <div className="h-8 w-20 bg-foreground/10 rounded-full"></div>
              <div className="h-8 w-14 bg-foreground/10 rounded-full"></div>
            </div>
          </div>
          <div className="my-4 border-b border-foreground/10 md:hidden"></div>
        </div>

        {/* Actions section */}
        <div className="px-6 pb-4 md:py-4">
          <div className="flex flex-col md:flex-row md:flex-nowrap md:justify-end justify-center items-center gap-3">
            <div className="h-10 w-32 bg-foreground/10 rounded-md"></div>
            <div className="h-10 w-28 bg-foreground/10 rounded-md"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
)
