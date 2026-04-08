"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FlaskConical, Clock, CheckCircle, AlertTriangle, Search, FileText, Loader2, X, File, Download, ExternalLink, RefreshCw } from 'lucide-react';
import apiService from '../services/api.service';
import LabResultModal from '../components/admin/LabResultModal';

export default function LabDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed' | 'urgent'>('all');
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [stats, setStats] = useState([
    { label: 'Pending Tests', value: '0', icon: Clock, color: 'orange', filterKey: 'pending' as const },
    { label: 'In Progress', value: '0', icon: FlaskConical, color: 'blue', filterKey: 'in-progress' as const },
    { label: 'Completed Today', value: '0', icon: CheckCircle, color: 'green', filterKey: 'completed' as const },
    { label: 'Urgent Tests', value: '0', icon: AlertTriangle, color: 'red', filterKey: 'urgent' as const },
  ]);

  // Helper to check if a date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Helper to check if date is within last 7 days
  const isWithinWeek = (date: Date) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date >= weekAgo;
  };

  // Helper to get date from Firestore timestamp or string
  const getOrderDate = (order: any) => {
    if (order.orderedDate?.toDate) return order.orderedDate.toDate();
    if (order.orderedDate) return new Date(order.orderedDate);
    if (order.createdAt?.toDate) return order.createdAt.toDate();
    if (order.createdAt) return new Date(order.createdAt);
    return new Date();
  };

  // Helper to get completed date
  const getCompletedDate = (order: any) => {
    if (order.completedAt?.toDate) return order.completedAt.toDate();
    if (order.completedAt) return new Date(order.completedAt);
    if (order.updatedAt?.toDate) return order.updatedAt.toDate();
    if (order.updatedAt) return new Date(order.updatedAt);
    return null;
  };

  const handleCompleteTest = async (orderId: string, order: any, result: string, notes?: string, attachments?: { imageUrls: string[]; fileUrls: Array<{ name: string; url: string }> }) => {
    try {
      setActionLoading(true);

      // Get patient ID from the order
      let patientId = order.patientId || order.patient_id;
      try {
        const patient = await apiService.getPatient(patientId);
        patientId = patient.id;
      } catch (error) {
        // Keep the original patientId if patient lookup fails
      }

      // Prepare update data with attachments if provided
      const updateData: any = {
        status: 'completed',
        result: result,
        notes: notes || null,
        completed_at: new Date().toISOString(),
      };

      // Add attachments if provided
      if (attachments) {
        updateData.attachments = {
          images: attachments.imageUrls || [],
          files: attachments.fileUrls || [],
        };
      }

      // Update order status to completed with result and attachments
      await apiService.updateLabOrder(orderId, updateData);

      // Create observation record for the lab result
      await apiService.createObservation({
        patientId: patientId,
        conceptType: 'Lab Test',
        conceptDisplay: order.testType || order.test_type || 'Lab Test',
        value: result,
        valueType: 'text',
        valueText: result,
        status: 'completed',
        labOrderId: orderId,
        notes: notes || null,
        metadata: attachments ? {
          attachments: {
            images: attachments.imageUrls || [],
            files: attachments.fileUrls || [],
          },
        } : undefined,
      });

      // Refresh the orders list
      await fetchLabOrders();
    } catch (error) {
      console.error('Error completing test:', error);
      throw error; // Re-throw to let modal handle error display
    } finally {
      setActionLoading(false);
    }
  };

  // Prevent body scroll when viewing order modal is open
  useEffect(() => {
    if (viewingOrder) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [viewingOrder]);

  // Fetch lab orders from Python backend
  const fetchLabOrders = async () => {
    try {
      const orders = await apiService.getLabOrders();

      // Transform and enrich orders with patient details
      const enrichedOrders = await Promise.all(
        orders.map(async (order: any) => {
          let createdAt: Date;
          if (order.ordered_date) {
            createdAt = new Date(order.ordered_date);
          } else if (order.created_at) {
            createdAt = new Date(order.created_at);
          } else {
            createdAt = new Date();
          }

          // Get patient details for table display
          let patientName = order.patient_name || 'Unknown Patient';
          let patientIdentifier = order.patient_id;
          let patientGender: string | undefined;
          let patientAge: number | undefined;

          try {
            const patient: any = await apiService.getPatient(order.patient_id);
            if (patient) {
              // Handle both camelCase and snake_case responses
              const firstName = patient.firstName || patient.first_name || '';
              const lastName = patient.lastName || patient.last_name || '';
              patientName = `${firstName} ${lastName}`.trim() || patientName;
              patientIdentifier = patient.identifier || order.patient_id;
              patientGender = patient.gender;
              // Calculate age from birthdate
              const birthdate = patient.birthdate || patient.dateOfBirth;
              if (birthdate) {
                const dob = new Date(birthdate);
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const monthDiff = today.getMonth() - dob.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                  age--;
                }
                patientAge = age;
              } else if (patient.age) {
                patientAge = parseInt(patient.age);
              }
            }
          } catch (error) {
            // Keep default values
          }

          return {
            id: order.id,
            ...order,
            // Map snake_case to camelCase for consistency
            testType: order.test_type || order.testType,
            patientId: order.patient_id || order.patientId,
            orderedBy: order.ordered_by || order.orderedBy,
            orderedByName: order.ordered_by_name || order.orderedByName,
            orderedDate: order.ordered_date ? new Date(order.ordered_date) : null,
            completedAt: order.completed_at ? new Date(order.completed_at) : null,
            patientName,
            patientGender,
            patientAge,
            patientIdentifier,
            createdAt,
          };
        })
      );

      // Update main lab orders table
      setLabOrders(enrichedOrders);
      setLoading(false);

      // Calculate stats
      const pendingCount = enrichedOrders.filter((o: any) => o.status === 'pending').length;
      const inProgressCount = enrichedOrders.filter((o: any) => o.status === 'in-progress' || o.status === 'active').length;
      const completedToday = enrichedOrders.filter((o: any) => {
        if (o.status !== 'completed') return false;
        const completedDate = getCompletedDate(o);
        return completedDate && isToday(completedDate);
      }).length;
      const urgentCount = enrichedOrders.filter((o: any) => o.priority === 'urgent' && o.status !== 'completed').length;

      setStats([
        { label: 'Pending Tests', value: pendingCount.toString(), icon: Clock, color: 'orange', filterKey: 'pending' as const },
        { label: 'In Progress', value: inProgressCount.toString(), icon: FlaskConical, color: 'blue', filterKey: 'in-progress' as const },
        { label: 'Completed Today', value: completedToday.toString(), icon: CheckCircle, color: 'green', filterKey: 'completed' as const },
        { label: 'Urgent Tests', value: urgentCount.toString(), icon: AlertTriangle, color: 'red', filterKey: 'urgent' as const },
      ]);
    } catch (error) {
      console.error('Error fetching lab orders:', error);
      setLoading(false);
    }
  };

  // Initial fetch and polling for updates
  useEffect(() => {
    fetchLabOrders();

    // Poll for updates every 10 seconds
    const pollInterval = setInterval(fetchLabOrders, 10000);

    return () => clearInterval(pollInterval);
  }, []);

  return (
    <div className="space-y-5">
      {/* Stats Grid - Clickable Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isActive = statusFilter === stat.filterKey;

          return (
            <button
              key={stat.label}
              onClick={() => setStatusFilter(isActive ? 'all' : stat.filterKey)}
              className={`bg-white rounded-2xl border p-5 text-left transition-all duration-200 shadow-card hover:shadow-card-hover ${
                isActive
                  ? 'border-olive-500 ring-2 ring-olive-500/20'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-semibold text-gray-900 tabular-nums mt-1">{stat.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-olive-500' : 'bg-gray-100'
                }`}>
                  <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                </div>
              </div>
              {isActive && (
                <p className="text-xs text-olive-600 mt-2 font-medium">Click to clear filter</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Lab Orders List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Laboratory Orders</h2>
        </div>

        {/* Search Bar and Filters */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by patient name, ID, or test type..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:bg-white transition-all"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  dateFilter === 'today'
                    ? 'bg-olive-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  dateFilter === 'week'
                    ? 'bg-olive-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  dateFilter === 'all'
                    ? 'bg-olive-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Lab Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Test Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ordered By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-olive-500 mx-auto mb-2" />
                    <p className="text-gray-600">Loading lab orders...</p>
                  </td>
                </tr>
              ) : (
                    labOrders
                      .filter((order) => {
                        // Apply date filter
                        const orderDate = getOrderDate(order);
                        if (dateFilter === 'today' && !isToday(orderDate)) return false;
                        if (dateFilter === 'week' && !isWithinWeek(orderDate)) return false;

                        // Apply status filter from cards
                        if (statusFilter !== 'all') {
                          if (statusFilter === 'pending' && order.status !== 'pending') return false;
                          if (statusFilter === 'in-progress' && order.status !== 'in-progress' && order.status !== 'active') return false;
                          if (statusFilter === 'completed') {
                            if (order.status !== 'completed') return false;
                            // For completed filter, only show completed today
                            const completedDate = getCompletedDate(order);
                            if (!completedDate || !isToday(completedDate)) return false;
                          }
                          if (statusFilter === 'urgent' && (order.priority !== 'urgent' || order.status === 'completed')) return false;
                        }

                        // Apply search filter
                        if (!searchQuery) return true;
                        const query = searchQuery.toLowerCase();
                        return (
                          order.patientName?.toLowerCase().includes(query) ||
                          order.patientIdentifier?.toLowerCase().includes(query) ||
                          order.patientId?.toLowerCase().includes(query) ||
                          order.testType?.toLowerCase().includes(query)
                        );
                      })
                      .map((order) => {
                        const orderDate = order.orderedDate?.toDate 
                          ? order.orderedDate.toDate() 
                          : order.orderedDate 
                          ? new Date(order.orderedDate) 
                          : null;
                        const formattedDate = orderDate 
                          ? orderDate.toLocaleDateString() 
                          : 'N/A';

                        return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{order.patientName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {order.patientGender && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                order.patientGender.toLowerCase() === 'male'
                                  ? 'bg-blue-100 text-blue-700'
                                  : order.patientGender.toLowerCase() === 'female'
                                  ? 'bg-pink-100 text-pink-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {order.patientGender.charAt(0).toUpperCase()}
                              </span>
                            )}
                            {order.patientAge !== undefined && (
                              <span className="text-xs text-gray-500">{order.patientAge} yrs</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{order.patientIdentifier || order.patientId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-800">{order.testType || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">{order.orderedByName || order.orderedBy || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{formattedDate}</p>
                      </td>
                      <td className="px-6 py-4">
                        {order.priority === 'urgent' ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                            <span className="text-sm font-medium text-gray-900">Urgent</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-600">Routine</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {order.status === 'pending' && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                            <span className="text-sm text-gray-700">Pending</span>
                          </div>
                        )}
                        {(order.status === 'in-progress' || order.status === 'active') && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                            <span className="text-sm font-medium text-blue-700">In Progress</span>
                          </div>
                        )}
                        {order.status === 'completed' && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                            <span className="text-sm font-medium text-emerald-700">Completed</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {order.status === 'completed' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setViewingOrder(order);
                            }}
                            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                          >
                            View Results
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedOrder(order)}
                            disabled={actionLoading}
                            className="text-sm font-medium text-olive-600 hover:text-olive-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            Process Test
                          </button>
                        )}
                      </td>
                    </tr>
                        );
                      })
              )}
            </tbody>
          </table>
        </div>

        {/* Empty State - Only show when not loading */}
        {!loading && labOrders.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FlaskConical className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lab Orders Found</h3>
            <p className="text-gray-600">There are no pending lab orders at the moment.</p>
          </div>
        )}
      </div>

      {/* Lab Result Modal */}
      {selectedOrder && (
        <LabResultModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onComplete={handleCompleteTest}
        />
      )}

      {/* View Results Modal */}
      {viewingOrder && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingOrder(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col m-4">
            <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-olive-500 rounded-xl flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Lab Test Results</h2>
                  <p className="text-sm text-gray-500">{viewingOrder.testType || 'Lab Test'}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Patient Info */}
              <div className="bg-olive-50 border border-olive-200 rounded-xl p-4">
                <p className="text-sm font-medium text-olive-800">Patient</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-base font-medium text-olive-900">{viewingOrder.patientName}</p>
                  {viewingOrder.patientGender && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      viewingOrder.patientGender.toLowerCase() === 'male'
                        ? 'bg-blue-100 text-blue-700'
                        : viewingOrder.patientGender.toLowerCase() === 'female'
                        ? 'bg-pink-100 text-pink-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {viewingOrder.patientGender}
                    </span>
                  )}
                  {viewingOrder.patientAge !== undefined && (
                    <span className="text-sm text-olive-600">{viewingOrder.patientAge} years</span>
                  )}
                </div>
                <p className="text-xs text-olive-600 mt-1">ID: {viewingOrder.patientIdentifier || viewingOrder.patientId}</p>
              </div>

              {/* Test Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Type
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">
                  {viewingOrder.testType || 'Lab Test'}
                </div>
              </div>

              {/* Test Result */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Result
                </label>
                <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-base font-medium text-emerald-900">
                    {viewingOrder.result || 'No result recorded'}
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl min-h-[60px]">
                  {viewingOrder.notes ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingOrder.notes}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No notes provided</p>
                  )}
                </div>
              </div>

              {/* Completion Date */}
              {viewingOrder.completedAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completed Date
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">
                    {viewingOrder.completedAt?.toDate
                      ? viewingOrder.completedAt.toDate().toLocaleString()
                      : viewingOrder.completedAt
                      ? new Date(viewingOrder.completedAt).toLocaleString()
                      : 'N/A'}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {viewingOrder.attachments && (viewingOrder.attachments.images?.length > 0 || viewingOrder.attachments.files?.length > 0) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attachments
                  </label>
                  <div className="space-y-4">
                    {/* Images */}
                    {viewingOrder.attachments.images && viewingOrder.attachments.images.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-2">Images ({viewingOrder.attachments.images.length})</p>
                        <div className="grid grid-cols-3 gap-3">
                          {viewingOrder.attachments.images.map((imageUrl: string, index: number) => (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={`Attachment ${index + 1}`}
                                className="w-full h-24 object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => window.open(imageUrl, '_blank')}
                              />
                              <a
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-xl"
                                title="Click to view full size"
                              >
                                <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files */}
                    {viewingOrder.attachments.files && viewingOrder.attachments.files.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-2">Files ({viewingOrder.attachments.files.length})</p>
                        <div className="space-y-2">
                          {viewingOrder.attachments.files.map((file: { name: string; url: string }, index: number) => (
                            <a
                              key={index}
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors group"
                            >
                              <div className="flex items-center space-x-3">
                                <File className="h-5 w-5 text-gray-500" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                  <p className="text-xs text-gray-500">Click to download</p>
                                </div>
                              </div>
                              <Download className="h-4 w-4 text-gray-400 group-hover:text-olive-600 transition-colors" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={() => setViewingOrder(null)}
                  className="px-5 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
