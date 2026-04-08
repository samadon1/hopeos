/**
 * Loading skeleton for Analytics page
 * Matches the new dashboard design with olive/green theme
 */

export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
            <div className="h-4 bg-gray-200 rounded-lg w-24 mb-3"></div>
            <div className="h-9 bg-gray-200 rounded-lg w-28 mb-4"></div>
            <div className="flex items-center space-x-2">
              <div className="h-5 bg-gray-100 rounded-full w-16"></div>
              <div className="h-3 bg-gray-100 rounded w-32"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Patient Visits Chart - 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-5 bg-gray-200 rounded-lg w-48 mb-3"></div>
              <div className="flex items-center space-x-6">
                <div className="h-4 bg-gray-100 rounded w-32"></div>
                <div className="h-4 bg-gray-100 rounded w-28"></div>
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="h-8 w-8 bg-gray-100 rounded-lg"></div>
              <div className="h-8 w-8 bg-gray-100 rounded-lg"></div>
            </div>
          </div>
          <div className="h-72 bg-gray-50 rounded-xl"></div>
        </div>

        {/* Patients by Community */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="h-5 bg-gray-200 rounded-lg w-40 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-32"></div>
            </div>
            <div className="h-8 w-8 bg-gray-100 rounded-lg"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg"></div>
                <div className="flex-1">
                  <div className="flex justify-between mb-2">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-100 rounded w-16"></div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Charts Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Radar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 bg-gray-200 rounded-lg w-36"></div>
            <div className="h-8 w-8 bg-gray-100 rounded-lg"></div>
          </div>
          <div className="h-56 bg-gray-50 rounded-xl"></div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="text-center">
                <div className="h-3 bg-gray-100 rounded w-12 mx-auto mb-1"></div>
                <div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 bg-gray-200 rounded-lg w-40"></div>
            <div className="h-8 w-8 bg-gray-100 rounded-lg"></div>
          </div>
          <div className="flex items-center justify-center">
            <div className="w-44 h-44 bg-gray-50 rounded-full flex items-center justify-center">
              <div className="w-28 h-28 bg-white rounded-full"></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                <div className="h-3 bg-gray-100 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Overview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="h-5 bg-gray-200 rounded-lg w-32 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-28"></div>
            </div>
            <div className="h-8 w-8 bg-gray-100 rounded-lg"></div>
          </div>
          <div className="flex flex-col items-center py-6">
            <div className="w-40 h-20 bg-gray-50 rounded-t-full mb-4"></div>
            <div className="h-8 bg-gray-200 rounded-lg w-16 mb-1"></div>
            <div className="h-3 bg-gray-100 rounded w-20"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="h-6 bg-gray-200 rounded w-8 mx-auto mb-1"></div>
              <div className="h-3 bg-gray-100 rounded w-12 mx-auto"></div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="h-6 bg-gray-200 rounded w-8 mx-auto mb-1"></div>
              <div className="h-3 bg-gray-100 rounded w-12 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <div className="h-5 bg-gray-200 rounded-lg w-44"></div>
              <div className="h-8 w-8 bg-gray-100 rounded-lg"></div>
            </div>
            <div className="h-56 bg-gray-50 rounded-xl"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
