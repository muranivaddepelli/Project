import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, isToday, parseISO } from 'date-fns';
import './Dahboard.css';
import { 
  HiOutlineArrowDownTray, 
  HiOutlineBookmarkSquare,
  HiOutlineFunnel,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineExclamationTriangle,
  HiOutlineDocumentText,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineLockClosed
} from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { useChecklist, useSaveChecklist, useExportChecklist, useChecklistStatistics } from '../hooks/useChecklist';
import { useStaffRecords, useUpdateStaffRecord, useDeleteStaffRecord } from '../hooks/useStaffRecords';
import { useActiveAreas } from '../hooks/useAreas';
import { useActiveHospitals } from '../hooks/useHospitals';
import { Button, Select, DatePicker, Toggle, Spinner, EmptyState, Modal, Input } from '../components/common';

const CATEGORIES = [
  { value: 'observation', label: 'Observation' },
  { value: 'incident', label: 'Incident' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'general', label: 'General' },
  { value: 'patient_feedback', label: 'Patient Feedback' },
  { value: 'supply_request', label: 'Supply Request' }
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
];

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' }
];

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-700 border-green-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-700';
    case 'in_progress': return 'bg-purple-100 text-purple-700';
    case 'resolved': return 'bg-green-100 text-green-700';
    case 'closed': return 'bg-slate-100 text-slate-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

/** Used after save: only clear local overlay if the user did not edit again while the request was in flight. */
const localChangesMatchSnapshot = (snapshot, current) => {
  const snapKeys = Object.keys(snapshot);
  const currKeys = Object.keys(current);
  if (snapKeys.length !== currKeys.length) return false;
  for (const k of snapKeys) {
    const s = snapshot[k];
    const c = current[k];
    if (!c) return false;
    if (!!s.status !== !!c.status) return false;
    if ((s.staffName || '').trim() !== (c.staffName || '').trim()) return false;
  }
  return true;
};

const Dashboard = () => {
  const { isAdmin, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [localChanges, setLocalChanges] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [validationErrors, setValidationErrors] = useState({});
  
  // Auto-save debounce timer ref
  const autoSaveTimerRef = useRef(null);
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Check if selected date is today (editable) or past (read-only)
  const isCurrentDate = useMemo(() => {
    return isToday(parseISO(selectedDate));
  }, [selectedDate]);

  // Get user's hospital ID for filtering
  const userHospitalId = user?.hospital?._id || user?.hospital;
  
  // Get hospitals for admin filter
  const { data: hospitals } = useActiveHospitals();
  
  // Determine effective hospital ID for filtering
  // Admin can select any hospital or see all, staff sees only their hospital
  const effectiveHospitalId = useMemo(() => {
    if (isAdmin) {
      return selectedHospital || null; // Admin: selected hospital or all (null)
    }
    return userHospitalId; // Staff: always their hospital
  }, [isAdmin, selectedHospital, userHospitalId]);
  
  // Initialize admin's hospital filter to their hospital
  useEffect(() => {
    if (isAdmin && userHospitalId && !selectedHospital) {
      setSelectedHospital(userHospitalId);
    }
  }, [isAdmin, userHospitalId, selectedHospital]);

  const queryClient = useQueryClient();
  const { data: checklist, isLoading: checklistLoading, error: checklistError } = useChecklist(selectedDate, selectedArea || null, effectiveHospitalId);
  const { data: statistics } = useChecklistStatistics(selectedDate, effectiveHospitalId);
  const { data: areas, isLoading: areasLoading } = useActiveAreas(effectiveHospitalId);
  const { mutateAsync: saveChecklistAsync, isPending: isSaving } = useSaveChecklist();
  const { exportCSV } = useExportChecklist();
  
  // Staff Records - fetch all records (everyone can see all)
  const { data: staffRecordsData, isLoading: recordsLoading } = useStaffRecords({ limit: 50 });
  const { mutate: updateRecord, isPending: isUpdating } = useUpdateStaffRecord();
  const { mutate: deleteRecord, isPending: isDeleting } = useDeleteStaffRecord();

  const hospitalOptions = useMemo(() => {
    if (!hospitals) return [];
    return hospitals.map(h => ({
      value: h._id,
      label: h.name
    }));
  }, [hospitals]);

  const areaOptions = useMemo(() => {
    if (!areas) return [];
    return areas.map(area => ({
      value: area._id,
      label: area.name
    }));
  }, [areas]);

  const mergedChecklist = useMemo(() => {
    if (!checklist) return [];
    return checklist.map(item => {
      const localChange = localChanges[item.task._id];
      return {
        ...item,
        entry: {
          ...item.entry,
          status: localChange?.status ?? item.entry?.status ?? false,
          staffName: localChange?.staffName ?? item.entry?.staffName ?? ''
        }
      };
    });
  }, [checklist, localChanges]);

  // Auto-save function with debounce
  const performAutoSave = useCallback(async () => {
    if (!isCurrentDate || Object.keys(localChanges).length === 0) return;

    const localSnapshot = {};
    for (const [k, v] of Object.entries(localChanges)) {
      localSnapshot[k] = { status: v.status, staffName: v.staffName ?? '' };
    }

    // Validate: staff name required when status is Yes
    const errors = {};
    let hasErrors = false;
    
    mergedChecklist.forEach(item => {
      if (item.entry.status && !item.entry.staffName.trim()) {
        errors[item.task._id] = 'Staff name required';
        hasErrors = true;
      }
    });

    setValidationErrors(errors);
    if (hasErrors) {
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saving');
    
    const entries = mergedChecklist.map(item => ({
      taskId: item.task._id,
      status: item.entry.status,
      staffName: item.entry.staffName
    }));

    try {
      await saveChecklistAsync({ date: selectedDate, entries });

      queryClient.setQueryData(
        ['checklist', selectedDate, selectedArea || null, effectiveHospitalId],
        (old) => {
          if (!old?.data?.checklist) return old;
          return {
            ...old,
            data: {
              ...old.data,
              checklist: old.data.checklist.map((item) => {
                const change = localSnapshot[item.task._id];
                if (!change) return item;
                return {
                  ...item,
                  entry: {
                    ...item.entry,
                    status: change.status,
                    staffName: change.staffName,
                    completedAt: change.status
                      ? new Date().toISOString()
                      : item.entry?.completedAt ?? null,
                  },
                };
              }),
            },
          };
        }
      );

      setLocalChanges((prev) =>
        localChangesMatchSnapshot(localSnapshot, prev) ? {} : prev
      );

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);

      queryClient.invalidateQueries({ queryKey: ['checklist-stats'] });

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['checklist'] });
      }, 1500);
    } catch {
      setSaveStatus('error');
    }
  }, [isCurrentDate, localChanges, mergedChecklist, selectedDate, selectedArea, effectiveHospitalId, saveChecklistAsync, queryClient]);

  // Trigger auto-save when changes occur (debounced)
  useEffect(() => {
    if (Object.keys(localChanges).length === 0) return;
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new timer for 1.5 seconds
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [localChanges, performAutoSave]);

  const handleStatusChange = useCallback((taskId, status) => {
    if (!isCurrentDate) return; // Prevent changes on past dates
    
    setLocalChanges(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        status,
        // Auto-fill staff name from logged-in user when status is turned on
        staffName: status ? (prev[taskId]?.staffName || user?.name || '') : (prev[taskId]?.staffName || '')
      }
    }));
    
    // Clear validation error for this task
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[taskId];
      return newErrors;
    });
  }, [isCurrentDate, user?.name]);

  const handleStaffNameChange = useCallback((taskId, staffName) => {
    if (!isCurrentDate) return; // Prevent changes on past dates
    
    setLocalChanges(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        staffName
      }
    }));
    
    // Clear validation error for this task if staff name is now filled
    if (staffName.trim()) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[taskId];
        return newErrors;
      });
    }
  }, [isCurrentDate]);

  const handleManualSave = () => {
    performAutoSave();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportCSV(selectedDate, selectedArea || null, effectiveHospitalId);
    } finally {
      setIsExporting(false);
    }
  };

  // Check if current user can edit/delete a record
  const canEditRecord = (record) => {
    return isAdmin || record.createdBy?._id === user?._id;
  };

  const openEditModal = (record) => {
    setSelectedRecord(record);
    setEditFormData({
      title: record.title,
      category: record.category,
      description: record.description,
      priority: record.priority,
      status: record.status,
      notes: record.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (record) => {
    setSelectedRecord(record);
    setIsDeleteModalOpen(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (selectedRecord) {
      updateRecord({ id: selectedRecord._id, data: editFormData }, {
        onSuccess: () => {
          setIsEditModalOpen(false);
          setSelectedRecord(null);
        }
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedRecord) {
      deleteRecord(selectedRecord._id, {
        onSuccess: () => {
          setIsDeleteModalOpen(false);
          setSelectedRecord(null);
        }
      });
    }
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  // Format timestamp to IST
  const formatTimestampIST = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-800">
            Daily Checklist
          </h1>
          <p className="text-slate-500 mt-1">
            Track and manage daily tasks across all areas
          </p>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="flex gap-3">
            <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium">Completed</p>
              <p className="text-lg font-bold text-emerald-700">{statistics.completed}/{statistics.total}</p>
            </div>
            <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-xs text-amber-600 font-medium">Progress</p>
              <p className="text-lg font-bold text-amber-700">{statistics.completionRate}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Read-only Warning for Past Dates */}
      {!isCurrentDate && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <HiOutlineLockClosed className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Read-Only Mode</p>
            <p className="text-sm text-amber-600">
              You are viewing data from {format(parseISO(selectedDate), 'dd MMMM yyyy')}. Past records cannot be edited.
            </p>
          </div>
        </div>
      )}

      {/* Controls Section */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              max={format(new Date(), 'yyyy-MM-dd')} // Can't select future dates
            />
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
              <HiOutlineFunnel className="w-5 h-5 text-slate-400 hidden sm:block flex-shrink-0" />
              {isAdmin && (
                <Select
                  value={selectedHospital}
                  onChange={(e) => {
                    setSelectedHospital(e.target.value);
                    setSelectedArea(''); // Reset area when hospital changes
                  }}
                  options={hospitalOptions}
                  placeholder="Select Hospital"
                  className="w-full sm:w-auto sm:min-w-[160px]"
                />
              )}
              <Select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                options={areaOptions}
                placeholder="All Areas"
                className="w-full sm:w-auto sm:min-w-[150px]"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-save Status Indicator */}
            {saveStatus !== 'idle' && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${saveStatus === 'saving' ? 'bg-blue-50 text-blue-600' : ''}
                ${saveStatus === 'saved' ? 'bg-green-50 text-green-600' : ''}
                ${saveStatus === 'error' ? 'bg-red-50 text-red-600' : ''}
              `}>
                {saveStatus === 'saving' && (
                  <>
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <HiOutlineCheckCircle className="w-4 h-4" />
                    Saved
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <HiOutlineExclamationCircle className="w-4 h-4" />
                    Error saving
                  </>
                )}
              </div>
            )}

            {isCurrentDate && (
              <Button
                variant="primary"
                icon={HiOutlineBookmarkSquare}
                onClick={handleManualSave}
                isLoading={isSaving}
                disabled={!hasChanges}
              >
                Save
              </Button>
            )}

            {/* Download button - Admin only */}
            {isAdmin && (
              <Button
                variant="secondary"
                icon={HiOutlineArrowDownTray}
                onClick={handleExport}
                isLoading={isExporting}
              >
                Download
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Checklist Table */}
      <div className="card overflow-hidden">
        {checklistLoading || areasLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="large" />
          </div>
        ) : checklistError ? (
          <EmptyState
            title="Error loading checklist"
            description={checklistError.message || "Something went wrong. Please try again."}
          />
        ) : mergedChecklist.length === 0 ? (
          <EmptyState
            title="No tasks found"
            description="There are no tasks configured for this area. Contact an administrator to add tasks."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-24">Task ID</th>
                  <th className="w-40">Area</th>
                  <th className="w-36">Functionality</th>
                  <th className="min-w-[250px]">Description</th>
                  <th className="w-32 text-center">Status</th>
                  <th className="min-w-[150px]">Staff Name</th>
                  <th className="min-w-[120px]">Timestamp (IST)</th>
                </tr>
              </thead>
              <tbody>
                {mergedChecklist.map((item, index) => (
                  <tr 
                    key={item.task._id}
                    className={`animate-fade-in ${!isCurrentDate ? 'opacity-75' : ''}`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td>
                      <span className="font-mono text-sm font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded">
                        {item.task.taskId}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-slate-700">
                        {item.task.area?.name}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-slate-800">
                        {item.task.name}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-slate-600 line-clamp-2">
                        {item.task.description}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-center">
                        <Toggle
                          checked={item.entry.status}
                          onChange={(status) => handleStatusChange(item.task._id, status)}
                          size="small"
                          disabled={!isCurrentDate}
                        />
                      </div>
                    </td>
                    <td>
                      <div>
                        <input
                          type="text"
                          value={item.entry.staffName}
                          onChange={(e) => handleStaffNameChange(item.task._id, e.target.value)}
                          placeholder={isCurrentDate ? "Enter name" : "-"}
                          disabled={!isCurrentDate}
                          className={`w-full text-center px-3 py-2 text-sm rounded-lg border transition-all duration-200
                            ${!isCurrentDate 
                              ? 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed' 
                              : validationErrors[item.task._id]
                                ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                                : 'border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500'
                            }
                          `}
                        />
                        {validationErrors[item.task._id] && (
                          <p className="text-xs text-red-500 mt-1">{validationErrors[item.task._id]}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-slate-500">
                        {formatTimestampIST(item.entry.completedAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Staff Records Section */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <HiOutlineDocumentText className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-800">Staff Records & Observations</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              {staffRecordsData?.records?.length || 0} Records
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            All records visible to everyone - {isAdmin ? 'Admin can edit all' : 'You can only edit your own records'}
          </p>
        </div>

        {recordsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="medium" />
          </div>
        ) : !staffRecordsData?.records?.length ? (
          <div className="py-12 text-center">
            <HiOutlineDocumentText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No active records</p>
            <p className="text-sm text-slate-400">Go to "My Records" to create one</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {staffRecordsData.records.map((record) => {
              const isOwner = record.createdBy?._id === user?._id;
              const canEdit = canEditRecord(record);
              
              return (
                <div key={record._id} className={`p-4 hover:bg-slate-50 transition-colors ${isOwner ? 'bg-primary-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${getPriorityColor(record.priority)}`}>
                          {record.priority}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusColor(record.status)}`}>
                          {record.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">
                          {record.category.replace('_', ' ')}
                        </span>
                        {isOwner && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                            Your Record
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-slate-800 truncate">{record.title}</h3>
                      <p className="text-sm text-slate-600 line-clamp-2 mt-1">{record.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                        <span>By: <span className={`${isOwner ? 'text-primary-600 font-medium' : 'text-slate-600'}`}>{record.createdBy?.name}</span></span>
                        {record.area && <span>Area: <span className="text-slate-600">{record.area.name}</span></span>}
                        <span>{formatTimestampIST(record.createdAt)}</span>
                      </div>
                    </div>
                    
                    {/* Edit/Delete buttons - only show for creator or admin */}
                    <div className="flex items-center gap-1">
                      {canEdit ? (
                        <>
                          <button
                            onClick={() => openEditModal(record)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <HiOutlinePencilSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(record)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="px-2 py-1 text-xs text-slate-400 bg-slate-100 rounded">
                          Read Only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Save Button for Mobile */}
      {hasChanges && isCurrentDate && (
        <div className="fixed bottom-20 left-4 right-4 lg:hidden animate-slide-up">
          <Button
            variant="primary"
            onClick={handleManualSave}
            isLoading={isSaving}
            className="w-full py-4 shadow-lg"
          >
            <HiOutlineBookmarkSquare className="w-5 h-5" />
            Save Changes
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedRecord(null); }}
        title="Edit Record"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Title"
            value={editFormData.title || ''}
            onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={editFormData.category || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                className="input"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={editFormData.priority || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="input"
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={editFormData.status || ''}
              onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
              className="input"
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={editFormData.description || ''}
              onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="input resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={editFormData.notes || ''}
              onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="input resize-none"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" type="button" onClick={() => { setIsEditModalOpen(false); setSelectedRecord(null); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isUpdating}>
              Update
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSelectedRecord(null); }}
        title="Delete Record"
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <HiOutlineExclamationTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">
            Are you sure you want to delete this record?
          </h3>
          <p className="text-slate-500 mb-6">
            "{selectedRecord?.title}" will be permanently deleted.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => { setIsDeleteModalOpen(false); setSelectedRecord(null); }}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              className="!bg-red-600 hover:!bg-red-700" 
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
