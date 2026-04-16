// ✅ FIXED VERSION: No toggle flicker + stable autosave

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const Dashboard = () => {
  const [localChanges, setLocalChanges] = useState({});
  const autoSaveTimerRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: checklist } = useChecklist();
  const { mutateAsync: saveChecklistAsync } = useSaveChecklist();

  // ✅ Merge server + local (stable UI)
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

  // ✅ Toggle handler (instant UI update)
  const handleStatusChange = useCallback((taskId, status) => {
    setLocalChanges(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        status
      }
    }));
  }, []);

  // ✅ Auto-save with debounce
  const performAutoSave = useCallback(async () => {
    if (Object.keys(localChanges).length === 0) return;

    const snapshot = { ...localChanges };

    const entries = Object.keys(snapshot).map(taskId => ({
      taskId,
      status: snapshot[taskId].status,
      staffName: snapshot[taskId].staffName || ''
    }));

    try {
      // ✅ Optimistic update (no flicker)
      queryClient.setQueryData(['checklist'], old => {
        if (!old) return old;
        return old.map(item => {
          const change = snapshot[item.task._id];
          if (!change) return item;

          return {
            ...item,
            entry: {
              ...item.entry,
              status: change.status,
              staffName: change.staffName
            }
          };
        });
      });

      await saveChecklistAsync({ entries });

      // ❌ DO NOT clear immediately → prevents flicker
      // setLocalChanges({});

      // ✅ Delay refetch
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['checklist'] });
      }, 1500);

    } catch (e) {
      console.error('Save failed', e);
    }
  }, [localChanges, saveChecklistAsync, queryClient]);

  useEffect(() => {
    if (Object.keys(localChanges).length === 0) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 800);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [localChanges, performAutoSave]);

  return (
    <div>
      {mergedChecklist.map(item => (
        <div key={item.task._id}>
          <span>{item.task.name}</span>

          {/* ✅ Ensure Toggle sends boolean */}
          <Toggle
            checked={item.entry.status}
            onChange={(checked) => handleStatusChange(item.task._id, checked)}
          />
        </div>
      ))}
    </div>
  );
};

export default Dashboard;

// ✅ IMPORTANT: Fix Toggle component also
// inside Toggle.jsx

/*
<input
  type="checkbox"
  checked={checked}
  onChange={(e) => onChange(e.target.checked)}
/>
*/
