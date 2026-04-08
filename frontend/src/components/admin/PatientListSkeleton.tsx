/**
 * Loading skeleton for Patient Search page
 * Provides visual feedback while patient data loads
 */

export default function PatientListSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Search and Filter Section Skeleton */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        {/* Community Filter */}
        <div className="mb-6">
          <div className="h-4 bg-slate-200 rounded w-40 mb-2"></div>
          <div className="h-12 bg-slate-100 rounded-lg"></div>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <div className="h-4 bg-slate-200 rounded w-32 mb-3"></div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <div className="h-12 bg-slate-100 rounded-lg"></div>
            </div>
            <div className="md:col-span-7">
              <div className="h-12 bg-slate-100 rounded-lg"></div>
            </div>
            <div className="md:col-span-2">
              <div className="h-12 bg-blue-100 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-5 bg-slate-200 rounded w-48"></div>
        <div className="h-8 bg-slate-100 rounded w-24"></div>
      </div>

      {/* Patient Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            {/* Patient Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-slate-100 rounded-full"></div>
                <div>
                  <div className="h-5 bg-slate-200 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-slate-100 rounded w-24"></div>
                </div>
              </div>
            </div>

            {/* Patient Info */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center">
                <div className="h-4 w-4 bg-slate-100 rounded mr-2"></div>
                <div className="h-3 bg-slate-100 rounded w-28"></div>
              </div>
              <div className="flex items-center">
                <div className="h-4 w-4 bg-slate-100 rounded mr-2"></div>
                <div className="h-3 bg-slate-100 rounded w-36"></div>
              </div>
              <div className="flex items-center">
                <div className="h-4 w-4 bg-slate-100 rounded mr-2"></div>
                <div className="h-3 bg-slate-100 rounded w-32"></div>
              </div>
            </div>

            {/* Action Button */}
            <div className="h-10 bg-blue-50 rounded-lg"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
