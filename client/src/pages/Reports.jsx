import React, { useState, useMemo } from 'react';
import { useEffect } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { 
  HiOutlineChartBar,
  HiOutlineCalendarDays,
  HiOutlineArrowDownTray,
  HiOutlineDocumentArrowDown,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineMapPin,
  HiOutlineDocumentText,
  HiOutlineBuildingOffice2
} from 'react-icons/hi2';
import { useReportsByDateRange, useExportChecklist } from '../hooks/useChecklist';
import { useActiveAreas } from '../hooks/useAreas';
import { useActiveHospitals } from '../hooks/useHospitals';
import { Button, Select, DatePicker, Spinner, EmptyState } from '../components/common';

const Reports = () => {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { data: hospitals } = useActiveHospitals();
  const { data: areas, isLoading: areasLoading } = useActiveAreas(selectedHospital || null);
  
  // Use the new reports hook that filters by createdAt date range
  const { data: reportsData, isLoading: reportsLoading } = useReportsByDateRange(
    dateRange.start,
    dateRange.end,
    selectedArea || null, 
    selectedHospital || null
  );
  
  const { exportCSV, exportPDF, exportDOCX, exportDateRange } = useExportChecklist();

  // Filter areas by selected hospital
  const filteredAreas = useMemo(() => {
    if (!areas) return [];
    if (!selectedHospital) return areas;
    return areas.filter(area => 
      area.hospital?._id === selectedHospital || area.hospital === selectedHospital
    );
  }, [areas, selectedHospital]);

  const hospitalOptions = useMemo(() => {
    if (!hospitals) return [];
    return hospitals.map(h => ({
      value: h._id,
      label: h.name
    }));
  }, [hospitals]);

  const areaOptions = useMemo(() => {
    return filteredAreas.map(area => ({
      value: area._id,
      label: area.name
    }));
  }, [filteredAreas]);

  const presetRanges = [
    { label: 'Today', getValue: () => ({ start: new Date(), end: new Date() }) },
    { label: 'Yesterday', getValue: () => ({ start: subDays(new Date(), 1), end: subDays(new Date(), 1) }) },
    { label: 'Last 7 Days', getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
    { label: 'Last 14 Days', getValue: () => ({ start: subDays(new Date(), 14), end: new Date() }) },
    { label: 'Last 30 Days', getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
    { label: 'This Month', getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
    { label: 'Last Month', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  ];

  const handlePresetClick = (preset) => {
    const { start, end } = preset.getValue();
    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    });
  };

  const handleExport = async (type) => {
    setShowExportMenu(false);
    // Always use date range export since we're filtering by createdAt
    await exportDateRange(
      dateRange.start, 
      dateRange.end, 
      type, 
      selectedArea || null,
      selectedHospital || null
    );
  };

  // Get statistics from reports data
  const summaryStats = useMemo(() => {
    if (!reportsData?.statistics) return null;
    return reportsData.statistics;
  }, [reportsData]);

  // Get entries from reports data
  const entries = useMemo(() => {
    return reportsData?.entries || [];
  }, [reportsData]);

  // Get export date label
  const getExportDateLabel = () => {
    return `${format(new Date(dateRange.start + 'T00:00:00'), 'MMM d')} - ${format(new Date(dateRange.end + 'T00:00:00'), 'MMM d, yyyy')}`;
  };


  useEffect(() => {
  if (hospitals && hospitals.length > 0 && !selectedHospital) {
    setSelectedHospital(hospitals[0]._id);
  }
}, [hospitals, selectedHospital]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-800">
            Reports & Analytics
          </h1>
          <p className="text-slate-500 mt-1">
            View checklist completion statistics and export data
          </p>
        </div>

        {/* Export Button */}
        <div className="relative">
          <Button
            variant="secondary"
            icon={HiOutlineArrowDownTray}
            onClick={() => setShowExportMenu(!showExportMenu)}
          >
            Export Data
          </Button>
          
          {showExportMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowExportMenu(false)} 
              />
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-lg ring-1 ring-slate-200 z-50 animate-slide-down">
                <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500">
                  <span className="font-medium">Export for:</span> {getExportDateLabel()}
                  {selectedHospital && hospitals?.find(h => h._id === selectedHospital) && (
                    <span className="block">
                      <span className="font-medium">Hospital:</span> {hospitals.find(h => h._id === selectedHospital)?.name}
                    </span>
                  )}
                  {selectedArea && filteredAreas?.find(a => a._id === selectedArea) && (
                    <span className="block">
                      <span className="font-medium">Area:</span> {filteredAreas.find(a => a._id === selectedArea)?.name}
                    </span>
                  )}
                  <span className="block text-xs text-slate-400 mt-1">
                    (Filters by creation date)
                  </span>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <HiOutlineDocumentArrowDown className="w-4 h-4 mr-3 text-emerald-500" />
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <HiOutlineDocumentArrowDown className="w-4 h-4 mr-3 text-red-500" />
                    Export as PDF
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <HiOutlineDocumentText className="w-4 h-4 mr-3 text-blue-500" />
                    Export as DOCX
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4">
          {/* Date Selection */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Start Date <span className="text-xs text-slate-400">(Created from)</span>
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  End Date <span className="text-xs text-slate-400">(Created until)</span>
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  min={dateRange.start}
                  className="input w-full"
                />
              </div>
              <Select
                label="Hospital"
                value={selectedHospital}
                onChange={(e) => {
                  setSelectedHospital(e.target.value);
                  setSelectedArea(''); // Reset area when hospital changes
                }}
                options={hospitalOptions}
                placeholder="Select Hospital"
                className="flex-1"
              />
              <Select
                label="Area"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                options={areaOptions}
                placeholder="All Areas"
                className="flex-1"
              />
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 self-center mr-2">Quick select:</span>
            {presetRanges.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 
                         text-slate-600 hover:bg-slate-50 hover:border-slate-300 
                         transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {(reportsLoading || areasLoading) && (
        <div className="card p-20">
          <div className="flex items-center justify-center">
            <Spinner size="large" />
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      {summaryStats && !reportsLoading && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <HiOutlineChartBar className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{summaryStats.total}</p>
              <p className="text-sm text-slate-500">Total Tasks</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{summaryStats.completed}</p>
              <p className="text-sm text-slate-500">Completed</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <HiOutlineXCircle className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-amber-600">{summaryStats.pending}</p>
              <p className="text-sm text-slate-500">Pending</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <HiOutlineCalendarDays className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-primary-600">{summaryStats.completionRate}%</p>
              <p className="text-sm text-slate-500">Completion Rate</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="card p-5">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Overall Progress</h3>
            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="absolute h-full bg-gradient-to-r from-primary-500 to-medical-teal rounded-full transition-all duration-500"
                style={{ width: `${summaryStats.completionRate}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-slate-500">
              <span>{summaryStats.completed} completed</span>
              <span>{summaryStats.pending} remaining</span>
            </div>
          </div>

          {/* By Area Breakdown */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <HiOutlineMapPin className="w-5 h-5 text-primary-500" />
                Completion by Area
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {Object.entries(summaryStats.byArea).map(([areaName, stats]) => {
                const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                return (
                  <div key={areaName} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-700">{areaName}</span>
                      <span className="text-sm text-slate-500">
                        {stats.completed}/{stats.total} ({rate}%)
                      </span>
                    </div>
                    <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`absolute h-full rounded-full transition-all duration-500 ${
                          rate === 100 
                            ? 'bg-emerald-500' 
                            : rate >= 50 
                              ? 'bg-amber-500' 
                              : 'bg-red-400'
                        }`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Task List */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">
                Entries created between {format(new Date(dateRange.start + 'T00:00:00'), 'MMM d')} - {format(new Date(dateRange.end + 'T00:00:00'), 'MMM d, yyyy')}
                <span className="text-sm font-normal text-slate-500 ml-2">({entries.length} entries)</span>
              </h3>
            </div>
            {entries && entries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th title="When this entry was saved/created">Created Date</th>
                      <th>Task ID</th>
                      <th>Hospital</th>
                      <th>Area</th>
                      <th>Task Name</th>
                      <th className="text-center">Status</th>
                      <th>Staff</th>
                      <th title="Task date this entry belongs to">Task Date</th>
                      <th title="When the task was marked complete">Completed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((item, index) => (
                      <tr key={`${item.taskId}-${item.date}-${index}`}>
                        <td className="text-sm font-medium text-primary-600">{item.createdAt || '-'}</td>
                        <td>
                          <span className="font-mono text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            {item.taskId}
                          </span>
                        </td>
                        <td>
                          {item.hospital ? (
                            <span className="inline-flex items-center gap-1 text-xs text-cyan-700">
                              <HiOutlineBuildingOffice2 className="w-3.5 h-3.5" />
                              {item.hospital}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="text-slate-600">{item.area}</td>
                        <td className="font-medium text-slate-800">{item.taskName}</td>
                        <td>
                          <div className="flex justify-center">
                            {item.status === 'Yes' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                                Done
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                <HiOutlineXCircle className="w-3.5 h-3.5" />
                                Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-slate-600">{item.staffName || '-'}</td>
                        <td className="text-sm text-slate-500">{item.date}</td>
                        <td className="text-sm text-slate-500">{item.completedAt || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={HiOutlineChartBar}
                title="No entries found"
                description="No checklist entries were created in the selected date range. Try expanding the date range or changing filters."
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
