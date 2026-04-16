import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checklistService } from '../services';
import toast from 'react-hot-toast';

export const useChecklist = (date, areaId = null, hospitalId = null) => {
  return useQuery({
    queryKey: ['checklist', date, areaId, hospitalId],
    queryFn: () => checklistService.getByDate(date, areaId, hospitalId),
    enabled: !!date,
    select: (data) => data.data.checklist,
  });
};

export const useChecklistStatistics = (date, hospitalId = null) => {
  return useQuery({
    queryKey: ['checklist-stats', date, hospitalId],
    queryFn: () => checklistService.getStatistics(date, hospitalId),
    enabled: !!date,
    select: (data) => data.data.statistics,
  });
};

// Reports by createdAt date range
export const useReportsByDateRange = (startDate, endDate, areaId = null, hospitalId = null) => {
  return useQuery({
    queryKey: ['reports', startDate, endDate, areaId, hospitalId],
    queryFn: () => checklistService.getReportsByDateRange(startDate, endDate, areaId, hospitalId),
    enabled: !!startDate && !!endDate,
    select: (data) => data.data,
  });
};

export const useUpdateEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, data }) => checklistService.updateEntry(taskId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-stats'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update entry');
    },
  });
};

export const useSaveChecklist = () => {
  return useMutation({
    mutationFn: ({ date, entries }) => checklistService.saveChecklist(date, entries),
    onSuccess: () => {
      toast.success('Checklist saved successfully!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to save checklist');
    },
  });
};

export const useExportChecklist = () => {
  const exportCSV = async (date, areaId = null, hospitalId = null) => {
    try {
      const response = await checklistService.exportCSV(date, areaId, hospitalId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `checklist_${date}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported successfully!');
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Access denied. Admin privileges required.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to export CSV');
      }
    }
  };

  const exportPDF = async (date, areaId = null, hospitalId = null) => {
    try {
      const response = await checklistService.exportPDF(date, areaId, hospitalId);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `checklist_${date}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF exported successfully!');
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Access denied. Admin privileges required.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to export PDF');
      }
    }
  };

  const exportDOCX = async (date, areaId = null, hospitalId = null) => {
    try {
      const response = await checklistService.exportDOCX(date, areaId, hospitalId);
      const url = window.URL.createObjectURL(new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `checklist_${date}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('DOCX exported successfully!');
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Access denied. Admin privileges required.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to export DOCX');
      }
    }
  };

  // Export with date range (for filtering by creation date)
  const exportDateRange = async (startDate, endDate, format = 'csv', areaId = null, hospitalId = null) => {
    try {
      let response;
      let mimeType = '';
      let extension = format;
      
      if (format === 'csv') {
        response = await checklistService.exportRangeCSV(startDate, endDate, areaId, hospitalId);
        mimeType = 'text/csv';
      } else if (format === 'pdf') {
        response = await checklistService.exportRangePDF(startDate, endDate, areaId, hospitalId);
        mimeType = 'application/pdf';
      } else if (format === 'docx') {
        response = await checklistService.exportRangeDOCX(startDate, endDate, areaId, hospitalId);
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }

      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `checklist_${startDate}_to_${endDate}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} exported successfully!`);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Access denied. Admin privileges required.');
      } else {
        toast.error(error.response?.data?.message || `Failed to export ${format.toUpperCase()}`);
      }
    }
  };

  return { exportCSV, exportPDF, exportDOCX, exportDateRange };
};

