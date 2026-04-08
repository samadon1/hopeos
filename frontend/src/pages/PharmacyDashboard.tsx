"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pill, Package, Clock, CheckCircle, Search, Loader2, X, FileText, RefreshCw } from 'lucide-react';
import apiService from '../services/api.service';
import PharmacyDispenseModal from '../components/admin/PharmacyDispenseModal';

interface GroupedPatientOrders {
  patientId: string;
  patientName: string;
  patientIdentifier: string;
  orders: any[];
  totalOrders: number;
  pendingCount: number;
  dispensedCount: number;
  overallStatus: 'pending' | 'partial' | 'dispensed';
  latestOrderDate: Date;
  prescribedBy: string;
}

export default function PharmacyDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'dispensed'>('all');
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [groupedOrders, setGroupedOrders] = useState<GroupedPatientOrders[]>([]);
  const [selectedPatientOrders, setSelectedPatientOrders] = useState<GroupedPatientOrders | null>(null);
  const [dispenseDetails, setDispenseDetails] = useState<Record<string, { quantityDispensed: string; pharmacistNotes: string }>>({});
  const [stats, setStats] = useState([
    { label: 'Pending Orders', value: '0', icon: Clock, color: 'orange', filterKey: 'pending' as const },
    { label: 'Dispensed Today', value: '0', icon: CheckCircle, color: 'green', filterKey: 'dispensed' as const },
    { label: 'Low Stock Items', value: '0', icon: Package, color: 'red', filterKey: null },
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
    if (order.createdAt?.toDate) return order.createdAt.toDate();
    if (order.createdAt) return new Date(order.createdAt);
    if (order.orderedDate?.toDate) return order.orderedDate.toDate();
    if (order.orderedDate) return new Date(order.orderedDate);
    return new Date();
  };

  // Helper to get dispensed date
  const getDispensedDate = (order: any) => {
    if (order.dispensedAt?.toDate) return order.dispensedAt.toDate();
    if (order.dispensedAt) return new Date(order.dispensedAt);
    if (order.updatedAt?.toDate) return order.updatedAt.toDate();
    if (order.updatedAt) return new Date(order.updatedAt);
    return null;
  };

  // Group orders by patient
  const groupOrdersByPatient = (orders: any[]): GroupedPatientOrders[] => {
    const grouped = new Map<string, GroupedPatientOrders>();

    orders.forEach(order => {
      const key = order.patientId;
      if (!grouped.has(key)) {
        grouped.set(key, {
          patientId: order.patientId,
          patientName: order.patientName,
          patientIdentifier: order.patientIdentifier || order.patientId,
          orders: [],
          totalOrders: 0,
          pendingCount: 0,
          dispensedCount: 0,
          overallStatus: 'dispensed',
          latestOrderDate: getOrderDate(order),
          prescribedBy: order.prescribedByName || order.prescribedBy || 'N/A',
        });
      }

      const group = grouped.get(key)!;
      group.orders.push(order);
      group.totalOrders++;

      if (order.status === 'pending') {
        group.pendingCount++;
      } else if (order.status === 'dispensed' || order.status === 'completed') {
        group.dispensedCount++;
      }

      // Update latest order date
      const orderDate = getOrderDate(order);
      if (orderDate > group.latestOrderDate) {
        group.latestOrderDate = orderDate;
        group.prescribedBy = order.prescribedByName || order.prescribedBy || group.prescribedBy;
      }
    });

    // Calculate overall status for each group
    grouped.forEach(group => {
      if (group.pendingCount === group.totalOrders) {
        group.overallStatus = 'pending';
      } else if (group.pendingCount > 0) {
        group.overallStatus = 'partial';
      } else {
        group.overallStatus = 'dispensed';
      }
    });

    // Convert to array and sort by latest order date (newest first)
    return Array.from(grouped.values()).sort((a, b) =>
      b.latestOrderDate.getTime() - a.latestOrderDate.getTime()
    );
  };

  // Fetch pharmacy orders from Python backend
  const fetchPharmacyOrders = async () => {
    try {
      const orders = await apiService.getPharmacyOrders();

      // Transform and enrich orders with patient details
      const enrichedOrders = await Promise.all(
        orders.map(async (order: any) => {
          let createdAt: Date;
          if (order.created_at) {
            createdAt = new Date(order.created_at);
          } else {
            createdAt = new Date();
          }

          // Get patient name for table display
          let patientName = order.patient_name || 'Unknown Patient';
          let patientIdentifier = order.patient_id;
          try {
            const patient = await apiService.getPatient(order.patient_id);
            if (patient) {
              // Handle both camelCase and snake_case responses
              const firstName = patient.firstName || patient.first_name || '';
              const lastName = patient.lastName || patient.last_name || '';
              patientName = `${firstName} ${lastName}`.trim() || patientName;
              patientIdentifier = patient.identifier || order.patient_id;
            }
          } catch (error) {
            // Keep default values
          }

          return {
            id: order.id,
            ...order,
            // Map snake_case to camelCase for consistency
            patientId: order.patient_id || order.patientId,
            drugName: order.drug_name || order.drugName,
            prescribedBy: order.prescribed_by || order.prescribedBy,
            prescribedByName: order.prescribed_by_name || order.prescribedByName,
            dispensedAt: order.dispensed_at ? new Date(order.dispensed_at) : null,
            patientName,
            patientIdentifier,
            medication: order.drug_name || order.drugName || order.medicationName || 'Unknown Medication',
            dosage: order.dosage || order.instructions || 'N/A',
            createdAt,
          };
        })
      );

      // Sort main table by createdAt desc (newest first)
      enrichedOrders.sort((a: any, b: any) => {
        const dateA = a.createdAt?.getTime?.() || 0;
        const dateB = b.createdAt?.getTime?.() || 0;
        return dateB - dateA;
      });

      // Update main prescriptions table
      setPrescriptions(enrichedOrders);

      // Group orders by patient
      const grouped = groupOrdersByPatient(enrichedOrders);
      setGroupedOrders(grouped);

      setLoading(false);

      // Calculate stats
      const pendingOrdersCount = enrichedOrders.filter((o: any) => o.status === 'pending').length;
      const dispensedToday = enrichedOrders.filter((o: any) => {
        if (o.status !== 'dispensed' && o.status !== 'completed') return false;
        const dispensedDate = getDispensedDate(o);
        return dispensedDate && isToday(dispensedDate);
      }).length;

      setStats([
        { label: 'Pending Orders', value: pendingOrdersCount.toString(), icon: Clock, color: 'orange', filterKey: 'pending' as const },
        { label: 'Dispensed Today', value: dispensedToday.toString(), icon: CheckCircle, color: 'green', filterKey: 'dispensed' as const },
        { label: 'Low Stock Items', value: '0', icon: Package, color: 'red', filterKey: null },
      ]);
    } catch (error) {
      console.error('Error fetching pharmacy orders:', error);
      setLoading(false);
    }
  };

  // Initial fetch and polling for updates
  useEffect(() => {
    fetchPharmacyOrders();

    // Poll for updates every 10 seconds
    const pollInterval = setInterval(fetchPharmacyOrders, 10000);

    return () => clearInterval(pollInterval);
  }, []);

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

  const handleDispense = async (orderId: string, order: any, customDetails?: { quantityDispensed?: string; pharmacistNotes?: string }) => {
    // Prevent duplicate dispenses
    if (order.status === 'dispensed' || order.status === 'completed') {
      throw new Error('This medication has already been dispensed.');
    }

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

      // Update order status with custom dispense details
      const updateData: any = {
        status: 'dispensed',
        dispensed_at: new Date().toISOString(),
      };
      if (customDetails?.quantityDispensed) {
        updateData.quantity_dispensed = customDetails.quantityDispensed;
      }
      if (customDetails?.pharmacistNotes) {
        updateData.pharmacist_notes = customDetails.pharmacistNotes;
      }
      await apiService.updatePharmacyOrder(orderId, updateData);

      // Create medication record for the dispensed medication
      await apiService.createMedication({
        patientId: patientId,
        patientName: order.patientName,
        drugName: order.drugName || order.drug_name || order.medicationName || order.medication || 'Unknown Medication',
        dosage: order.dosage || 'As prescribed',
        dosageUnit: 'mg',
        frequency: order.instructions || order.notes || 'As directed',
        route: 'Oral',
        duration: 7,
        durationUnit: 'days',
        quantity: order.quantity || 1,
        instructions: order.instructions || order.notes || '',
        prescribedBy: order.prescribedBy || order.prescribed_by || 'admin',
        prescribedByName: order.prescribedByName || order.prescribed_by_name || 'Unknown User',
        status: 'active',
        pharmacyOrderId: orderId,
        skipOrder: true, // Don't create a new pharmacy order - we're dispensing an existing one
      });

      // Refresh the orders list
      await fetchPharmacyOrders();
    } catch (error) {
      console.error('Error dispensing medication:', error);
      throw error; // Re-throw to let modal handle error display
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Stats Grid - Clickable Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isActive = stat.filterKey && statusFilter === stat.filterKey;
          const isClickable = stat.filterKey !== null;

          return isClickable ? (
            <button
              key={stat.label}
              onClick={() => setStatusFilter(isActive ? 'all' : stat.filterKey!)}
              className={`bg-white border p-5 text-left transition-all rounded-2xl shadow-sm ${
                isActive
                  ? 'border-olive-500 ring-2 ring-olive-200'
                  : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{stat.value}</p>
                </div>
                <div className={`h-10 w-10 flex items-center justify-center rounded-xl ${
                  isActive ? 'bg-olive-100' : 'bg-gray-50'
                }`}>
                  <Icon className={`h-5 w-5 ${isActive ? 'text-olive-600' : 'text-gray-600'}`} />
                </div>
              </div>
              {isActive && (
                <p className="text-xs text-olive-600 mt-2 font-medium">Click to clear filter</p>
              )}
            </button>
          ) : (
            <div key={stat.label} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{stat.value}</p>
                </div>
                <div className="h-10 w-10 bg-gray-50 flex items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prescriptions List */}
      <div className="bg-white border border-gray-100 overflow-hidden rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Prescription Orders</h2>
        </div>

        {/* Search Bar and Filters */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by patient name or ID..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-xl ${
                  dateFilter === 'today'
                    ? 'bg-olive-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-xl ${
                  dateFilter === 'week'
                    ? 'bg-olive-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-xl ${
                  dateFilter === 'all'
                    ? 'bg-olive-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Prescriptions Table - Grouped by Patient */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Medications
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Prescribed By
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-olive-600 mx-auto mb-2" />
                    <p className="text-gray-600">Loading prescriptions...</p>
                  </td>
                </tr>
              ) : (
                    groupedOrders
                      .filter((group) => {
                        // Apply date filter based on latest order
                        if (dateFilter === 'today' && !isToday(group.latestOrderDate)) return false;
                        if (dateFilter === 'week' && !isWithinWeek(group.latestOrderDate)) return false;

                        // Apply status filter
                        if (statusFilter !== 'all') {
                          if (statusFilter === 'pending' && group.pendingCount === 0) return false;
                          if (statusFilter === 'dispensed' && group.overallStatus !== 'dispensed') return false;
                        }

                        // Apply search filter
                        if (!searchQuery) return true;
                        const query = searchQuery.toLowerCase();
                        return (
                          group.patientName?.toLowerCase().includes(query) ||
                          group.patientIdentifier?.toLowerCase().includes(query) ||
                          group.orders.some(o => o.medication?.toLowerCase().includes(query))
                        );
                      })
                      .map((group) => {
                        const formattedDate = group.latestOrderDate.toLocaleDateString();

                        return (
                      <tr
                        key={group.patientId}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => {
                          // Initialize dispense details for all pending orders
                          const initialDetails: Record<string, { quantityDispensed: string; pharmacistNotes: string }> = {};
                          group.orders.forEach(order => {
                            if (order.status === 'pending') {
                              initialDetails[order.id] = {
                                quantityDispensed: order.quantity?.toString() || '',
                                pharmacistNotes: '',
                              };
                            }
                          });
                          setDispenseDetails(initialDetails);
                          setSelectedPatientOrders(group);
                        }}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{group.patientName}</p>
                            <p className="text-xs text-gray-500">{group.patientIdentifier}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 bg-olive-100 text-olive-600 flex items-center justify-center font-bold text-sm rounded-lg">
                              {group.totalOrders}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {group.totalOrders === 1 ? '1 medication' : `${group.totalOrders} medications`}
                              </p>
                              <p className="text-xs text-gray-500">
                                {group.orders.slice(0, 2).map(o => o.medication).join(', ')}
                                {group.orders.length > 2 && ` +${group.orders.length - 2} more`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-700">{group.prescribedBy}</p>
                          <p className="text-xs text-gray-500">{formattedDate}</p>
                        </td>
                        <td className="px-6 py-4">
                          {group.overallStatus === 'pending' ? (
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full bg-orange-400"></div>
                              <span className="text-sm text-orange-700 font-medium">
                                {group.pendingCount} pending
                              </span>
                            </div>
                          ) : group.overallStatus === 'partial' ? (
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full bg-amber-400"></div>
                              <span className="text-sm text-amber-700 font-medium">
                                {group.pendingCount} pending, {group.dispensedCount} dispensed
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                              <span className="text-sm font-medium text-emerald-700">All dispensed</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Initialize dispense details for all pending orders
                              const initialDetails: Record<string, { quantityDispensed: string; pharmacistNotes: string }> = {};
                              group.orders.forEach(order => {
                                if (order.status === 'pending') {
                                  initialDetails[order.id] = {
                                    quantityDispensed: order.quantity?.toString() || '',
                                    pharmacistNotes: '',
                                  };
                                }
                              });
                              setDispenseDetails(initialDetails);
                              setSelectedPatientOrders(group);
                            }}
                            className="text-sm font-medium text-olive-600 hover:text-olive-800 transition-colors"
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Empty State - Only show when not loading */}
        {!loading && groupedOrders.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Pill className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Prescriptions Found</h3>
            <p className="text-gray-600">There are no prescription orders at the moment.</p>
          </div>
        )}
      </div>

      {/* Pharmacy Dispense Modal */}
      {selectedOrder && (
        <PharmacyDispenseModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDispense={handleDispense}
        />
      )}

      {/* Patient Orders Modal - Shows all medications for a patient */}
      {selectedPatientOrders && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] flex items-center justify-center bg-black bg-opacity-50"
          style={{
            margin: 0,
            padding: 0,
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            minHeight: '100vh',
            position: 'fixed',
            transform: 'translateZ(0)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedPatientOrders(null);
            }
          }}
        >
          <div className="bg-white shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col m-4 rounded-2xl">
            <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-olive-100 text-olive-600 flex items-center justify-center rounded-xl">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedPatientOrders.patientName}</h2>
                  <p className="text-sm text-gray-600">
                    {selectedPatientOrders.totalOrders} medication{selectedPatientOrders.totalOrders > 1 ? 's' : ''} •
                    ID: {selectedPatientOrders.patientIdentifier}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatientOrders(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 border border-gray-100 p-4 text-center rounded-xl">
                  <p className="text-2xl font-bold text-gray-900">{selectedPatientOrders.totalOrders}</p>
                  <p className="text-xs text-gray-600">Total Items</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 p-4 text-center rounded-xl">
                  <p className="text-2xl font-bold text-orange-600">{selectedPatientOrders.pendingCount}</p>
                  <p className="text-xs text-orange-700">Pending</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-4 text-center rounded-xl">
                  <p className="text-2xl font-bold text-emerald-600">{selectedPatientOrders.dispensedCount}</p>
                  <p className="text-xs text-emerald-700">Dispensed</p>
                </div>
              </div>

              {/* Medications List */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Medications</h3>
                {selectedPatientOrders.orders.map((order) => (
                  <div
                    key={order.id}
                    className={`border p-4 rounded-xl ${
                      order.status === 'pending'
                        ? 'bg-white border-gray-200'
                        : 'bg-emerald-50 border-emerald-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Pill className={`h-4 w-4 ${order.status === 'pending' ? 'text-olive-600' : 'text-emerald-600'}`} />
                          <p className="text-sm font-semibold text-gray-900">{order.medication}</p>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{order.dosage || 'No dosage specified'}</p>
                        {order.instructions && order.instructions !== order.dosage && (
                          <p className="text-xs text-gray-500 mt-1">Instructions: {order.instructions}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Prescribed Qty: {order.quantity || 1}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.status === 'pending' ? (
                          <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">
                            Pending
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg">
                            Dispensed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Per-medication dispense fields for pending orders */}
                    {order.status === 'pending' && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Quantity to Dispense
                            </label>
                            <input
                              type="text"
                              value={dispenseDetails[order.id]?.quantityDispensed || ''}
                              onChange={(e) => setDispenseDetails(prev => ({
                                ...prev,
                                [order.id]: {
                                  ...prev[order.id],
                                  quantityDispensed: e.target.value,
                                }
                              }))}
                              placeholder={`Prescribed: ${order.quantity || 1}`}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Pharmacist Notes
                            </label>
                            <input
                              type="text"
                              value={dispenseDetails[order.id]?.pharmacistNotes || ''}
                              onChange={(e) => setDispenseDetails(prev => ({
                                ...prev,
                                [order.id]: {
                                  ...prev[order.id],
                                  pharmacistNotes: e.target.value,
                                }
                              }))}
                              placeholder="Optional notes..."
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const details = dispenseDetails[order.id];
                                await handleDispense(order.id, order, details);
                                // Refresh the grouped data after dispense
                                const updatedOrders = selectedPatientOrders.orders.map(o =>
                                  o.id === order.id ? { ...o, status: 'dispensed' } : o
                                );
                                const updatedGroup = {
                                  ...selectedPatientOrders,
                                  orders: updatedOrders,
                                  pendingCount: selectedPatientOrders.pendingCount - 1,
                                  dispensedCount: selectedPatientOrders.dispensedCount + 1,
                                  overallStatus: selectedPatientOrders.pendingCount - 1 === 0 ? 'dispensed' as const : 'partial' as const,
                                };
                                setSelectedPatientOrders(updatedGroup);
                              } catch (error: any) {
                                alert(error.message || 'Failed to dispense medication');
                              }
                            }}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-olive-500 text-white text-sm font-medium rounded-lg hover:bg-olive-600 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Dispense This Item
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show dispense details for already dispensed orders */}
                    {order.status !== 'pending' && (order.quantityDispensed || order.pharmacistNotes) && (
                      <div className="mt-3 pt-3 border-t border-emerald-100 text-xs text-emerald-700">
                        {order.quantityDispensed && (
                          <p>Qty Dispensed: {order.quantityDispensed}</p>
                        )}
                        {order.pharmacistNotes && (
                          <p className="mt-1">Notes: {order.pharmacistNotes}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 bg-gray-50 flex items-center justify-between rounded-b-2xl">
              <button
                onClick={() => setSelectedPatientOrders(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition-colors"
              >
                Close
              </button>
              {selectedPatientOrders.pendingCount > 0 && (
                <button
                  onClick={async () => {
                    try {
                      setActionLoading(true);
                      // Dispense all pending orders with their individual details
                      const pendingOrders = selectedPatientOrders.orders.filter(o => o.status === 'pending');
                      for (const order of pendingOrders) {
                        const details = dispenseDetails[order.id];
                        await handleDispense(order.id, order, details);
                      }
                      // Update local state
                      const updatedOrders = selectedPatientOrders.orders.map(o => ({
                        ...o,
                        status: 'dispensed'
                      }));
                      setSelectedPatientOrders({
                        ...selectedPatientOrders,
                        orders: updatedOrders,
                        pendingCount: 0,
                        dispensedCount: selectedPatientOrders.totalOrders,
                        overallStatus: 'dispensed',
                      });
                      // Clear dispense details
                      setDispenseDetails({});
                    } catch (error: any) {
                      alert(error.message || 'Failed to dispense all medications');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="px-6 py-2 bg-olive-500 text-white font-medium rounded-lg hover:bg-olive-600 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Dispensing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Dispense All ({selectedPatientOrders.pendingCount})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View Details Modal */}
      {viewingOrder && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed z-[9999] flex items-center justify-center bg-black bg-opacity-50" 
          style={{ 
            margin: 0, 
            padding: 0, 
            top: 0, 
            left: 0, 
            width: '100vw',
            height: '100vh',
            minHeight: '100vh',
            position: 'fixed',
            transform: 'translateZ(0)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingOrder(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col m-4">
            <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-olive-600" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Dispensed Medication</h2>
                  <p className="text-sm text-gray-600">{viewingOrder.medication}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Patient Info */}
              <div className="bg-olive-50 border border-olive-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-olive-900">Patient</p>
                <p className="text-base text-olive-700">{viewingOrder.patientName}</p>
                <p className="text-xs text-olive-600 mt-1">ID: {viewingOrder.patientIdentifier || viewingOrder.patientId}</p>
              </div>

              {/* Medication */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medication
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-700">
                  {viewingOrder.medication}
                </div>
              </div>

              {/* Dosage */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dosage & Instructions
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-700">
                  {viewingOrder.dosage || viewingOrder.instructions || 'No dosage information'}
                </div>
              </div>

              {/* Prescribed By */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Prescribed By
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-700">
                  {viewingOrder.prescribedByName || viewingOrder.prescribedBy || 'N/A'}
                </div>
              </div>

              {/* Dispensed Date */}
              {viewingOrder.dispensedAt && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Dispensed Date
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-700">
                    {viewingOrder.dispensedAt?.toDate
                      ? viewingOrder.dispensedAt.toDate().toLocaleString()
                      : viewingOrder.dispensedAt
                      ? new Date(viewingOrder.dispensedAt).toLocaleString()
                      : 'N/A'}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={() => setViewingOrder(null)}
                  className="px-6 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors"
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