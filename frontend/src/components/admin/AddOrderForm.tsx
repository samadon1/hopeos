"use client"

import { useState, useEffect } from 'react';
import { X, Pill, TestTube, Loader2, CheckCircle, Check } from 'lucide-react';
import apiService from '../../services/api.service';

interface AddOrderFormProps {
  patientUuid: string;
  patientName: string;
  orderType: 'medication' | 'lab';
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddOrderForm({
  patientUuid,
  patientName,
  orderType,
  onClose,
  onSuccess
}: AddOrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customItem, setCustomItem] = useState('');
  // Per-medication details (dosage, instructions, quantity for each)
  const [medicationDetails, setMedicationDetails] = useState<Record<string, { dosage: string; instructions: string; quantity: string }>>({});
  // For custom input, use single fields
  const [customDosage, setCustomDosage] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');
  const [priority, setPriority] = useState<'routine' | 'urgent'>('routine');
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    loadCatalog();
  }, [orderType]);

  const loadCatalog = async () => {
    try {
      setLoadingCatalog(true);
      if (orderType === 'medication') {
        const medications = await apiService.getMedications();
        if (medications.length === 0) {
          // Catalog is empty, initialize it
          console.log('Initializing medication catalog...');
          await apiService.initializeMedicationCatalog();
          const updatedMedications = await apiService.getMedications();
          setCatalog(updatedMedications);
        } else {
          setCatalog(medications);
        }
      } else {
        // Run cleanup to fix any combined Hepatitis entries
        await apiService.cleanupLabTestCatalog();

        const labTests = await apiService.getLabTests();
        if (labTests.length === 0) {
          // Catalog is empty, initialize it
          console.log('Initializing lab test catalog...');
          await apiService.initializeLabTestCatalog();
          const updatedLabTests = await apiService.getLabTests();
          setCatalog(updatedLabTests);
        } else {
          setCatalog(labTests);
        }
      }
    } catch (error) {
      console.error('Error loading catalog:', error);
      // Try to initialize if loading fails
      try {
        if (orderType === 'medication') {
          await apiService.initializeMedicationCatalog();
          const medications = await apiService.getMedications();
          setCatalog(medications);
        } else {
          await apiService.initializeLabTestCatalog();
          const labTests = await apiService.getLabTests();
          setCatalog(labTests);
        }
      } catch (initError) {
        console.error('Error initializing catalog:', initError);
        setError('Failed to load catalog. Please try again.');
      }
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        // Remove from selection and clean up details
        const newDetails = { ...medicationDetails };
        delete newDetails[itemId];
        setMedicationDetails(newDetails);
        return prev.filter(id => id !== itemId);
      } else {
        // Add to selection and initialize details for medications
        if (orderType === 'medication') {
          setMedicationDetails(prevDetails => ({
            ...prevDetails,
            [itemId]: { dosage: '', instructions: '', quantity: '1' }
          }));
        }
        return [...prev, itemId];
      }
    });
  };

  // Update medication detail for a specific item
  const updateMedicationDetail = (itemId: string, field: 'dosage' | 'instructions' | 'quantity', value: string) => {
    setMedicationDetails(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  // Select/deselect all filtered items
  const toggleSelectAll = () => {
    const filteredIds = filteredCatalog.map(item => item.id);
    const allSelected = filteredIds.every(id => selectedItems.includes(id));
    if (allSelected) {
      setSelectedItems(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedItems(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  // Filter catalog based on search
  const filteredCatalog = catalog.filter(item =>
    item.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    if (useCustomInput) {
      if (!customItem.trim()) {
        setError(`Please enter a ${orderType === 'medication' ? 'medication' : 'lab test'} name`);
        return;
      }
    } else {
      if (selectedItems.length === 0) {
        setError(`Please select at least one ${orderType === 'medication' ? 'medication' : 'lab test'}`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Get current logged-in user's display name
      const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
      const providerName = adminUser.displayName || adminUser.username || 'Unknown User';

      if (useCustomInput) {
        // Single custom item
        const itemName = customItem.trim();
        if (orderType === 'medication') {
          await apiService.createPharmacyOrder({
            patientId: patientUuid,
            patientName: patientName,
            drugName: itemName,
            dosage: customDosage || 'As prescribed',
            instructions: customInstructions || '',
            quantity: parseInt(customQuantity) || 1,
            notes: customInstructions || '',
            priority: priority,
            prescribedBy: adminUser.username || 'admin',
            prescribedByName: providerName,
          });
        } else {
          await apiService.createLabOrder({
            patientId: patientUuid,
            patientName: patientName,
            testType: itemName,
            priority: priority,
            orderedBy: adminUser.username || 'admin',
            orderedByName: providerName,
          });
        }
      } else {
        // Multiple selected items - create orders for each
        for (const itemId of selectedItems) {
          const itemName = catalog.find(item => item.id === itemId)?.name || itemId;
          const details = medicationDetails[itemId] || { dosage: '', instructions: '', quantity: '1' };

          if (orderType === 'medication') {
            await apiService.createPharmacyOrder({
              patientId: patientUuid,
              patientName: patientName,
              drugName: itemName,
              dosage: details.dosage || 'As prescribed',
              instructions: details.instructions || '',
              quantity: parseInt(details.quantity) || 1,
              notes: details.instructions || '',
              priority: priority,
              prescribedBy: adminUser.username || 'admin',
              prescribedByName: providerName,
            });
          } else {
            await apiService.createLabOrder({
              patientId: patientUuid,
              patientName: patientName,
              testType: itemName,
              priority: priority,
              orderedBy: adminUser.username || 'admin',
              orderedByName: providerName,
            });
          }
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error creating order:', err);
      setError(err.message || `Failed to create ${orderType} order. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white   max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {orderType === 'medication' ? (
              <Pill className="h-5 w-5 text-blue-600" />
            ) : (
              <TestTube className="h-5 w-5 text-green-600" />
            )}
            <h2 className="text-xl font-bold text-slate-900">
              Add {orderType === 'medication' ? 'Medication' : 'Lab Test'} Order
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100  transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Patient Info */}
          <div className="bg-blue-50 border border-blue-200  p-4">
            <p className="text-sm font-semibold text-blue-900">Patient</p>
            <p className="text-base text-blue-700">{patientName}</p>
          </div>

          {/* Select Item(s) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">
                {orderType === 'medication' ? 'Medication(s)' : 'Lab Test(s)'} *
                {selectedItems.length > 0 && !useCustomInput && (
                  <span className="ml-2 text-blue-600 font-normal">
                    ({selectedItems.length} selected)
                  </span>
                )}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomInput}
                  onChange={(e) => {
                    setUseCustomInput(e.target.checked);
                    if (e.target.checked) {
                      setSelectedItems([]);
                    } else {
                      setCustomItem('');
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span>Enter custom {orderType === 'medication' ? 'medication' : 'lab test'}</span>
              </label>
            </div>
            {loadingCatalog ? (
              <div className="flex items-center gap-2 text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading catalog...</span>
              </div>
            ) : useCustomInput ? (
              <input
                type="text"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                placeholder={`Enter ${orderType === 'medication' ? 'medication' : 'lab test'} name...`}
                required
                className="w-full px-4 py-3 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div className="border border-slate-300 rounded-md overflow-hidden">
                {/* Search and Select All */}
                <div className="p-3 bg-slate-50 border-b border-slate-200">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={`Search ${orderType === 'medication' ? 'medications' : 'lab tests'}...`}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {filteredCatalog.every(item => selectedItems.includes(item.id))
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                    {selectedItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedItems([])}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>
                </div>
                {/* Checkbox List */}
                <div className="max-h-60 overflow-y-auto">
                  {filteredCatalog.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      No {orderType === 'medication' ? 'medications' : 'lab tests'} found
                    </div>
                  ) : (
                    filteredCatalog.map((item) => {
                      const isSelected = selectedItems.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors ${
                            isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItemSelection(item.id)}
                            className="sr-only"
                          />
                          <span className={`text-sm ${isSelected ? 'text-blue-900 font-medium' : 'text-slate-700'}`}>
                            {item.name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Medication-specific fields */}
          {orderType === 'medication' && (
            <>
              {/* Custom input - single set of fields */}
              {useCustomInput ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Dosage
                    </label>
                    <input
                      type="text"
                      value={customDosage}
                      onChange={(e) => setCustomDosage(e.target.value)}
                      placeholder="e.g., 500mg twice daily"
                      className="w-full px-4 py-3 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Instructions
                    </label>
                    <textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="Additional instructions..."
                      rows={2}
                      className="w-full px-4 py-3 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(e.target.value)}
                      min="1"
                      className="w-full px-4 py-3 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              ) : selectedItems.length > 0 ? (
                /* Per-medication fields */
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-slate-700">Medication Details</p>
                  {selectedItems.map((itemId) => {
                    const item = catalog.find(i => i.id === itemId);
                    const details = medicationDetails[itemId] || { dosage: '', instructions: '', quantity: '1' };
                    return (
                      <div key={itemId} className="bg-slate-50 border border-slate-200 rounded-md p-4">
                        <p className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <Pill className="h-4 w-4 text-blue-600" />
                          {item?.name || itemId}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Dosage
                            </label>
                            <input
                              type="text"
                              value={details.dosage}
                              onChange={(e) => updateMedicationDetail(itemId, 'dosage', e.target.value)}
                              placeholder="e.g., 500mg twice daily"
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Quantity
                            </label>
                            <input
                              type="number"
                              value={details.quantity}
                              onChange={(e) => updateMedicationDetail(itemId, 'quantity', e.target.value)}
                              min="1"
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Instructions
                            </label>
                            <input
                              type="text"
                              value={details.instructions}
                              onChange={(e) => updateMedicationDetail(itemId, 'instructions', e.target.value)}
                              placeholder="Optional notes..."
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Priority {selectedItems.length > 1 && !useCustomInput && <span className="font-normal text-slate-500">(shared)</span>}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value="routine"
                  checked={priority === 'routine'}
                  onChange={(e) => setPriority(e.target.value as 'routine' | 'urgent')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-slate-700">Routine</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value="urgent"
                  checked={priority === 'urgent'}
                  onChange={(e) => setPriority(e.target.value as 'routine' | 'urgent')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-slate-700">Urgent</span>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200  p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (useCustomInput ? !customItem.trim() : selectedItems.length === 0)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating {selectedItems.length > 1 ? `${selectedItems.length} Orders` : 'Order'}...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {useCustomInput
                    ? 'Create Order'
                    : selectedItems.length > 1
                      ? `Create ${selectedItems.length} Orders`
                      : 'Create Order'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

