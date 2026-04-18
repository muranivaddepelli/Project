import React, { useState, useMemo, useEffect } from 'react';
import { 
  HiOutlinePlus, 
  HiOutlinePencilSquare, 
  HiOutlineTrash,
  HiOutlineMagnifyingGlass,
  HiOutlineClipboardDocumentList,
  HiOutlineBuildingOffice2
} from 'react-icons/hi2';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useToggleTaskStatus } from '../hooks/useTasks';
import { useAreas, useActiveAreas } from '../hooks/useAreas';
import { useActiveHospitals } from '../hooks/useHospitals';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Select, Modal, Spinner, EmptyState } from '../components/common';

const TaskForm = ({ task, hospitals, userHospital, onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState({
    taskId: task?.taskId || '',
    name: task?.name || '',
    description: task?.description || '',
    hospital: task?.hospital?._id || task?.hospital || task?.area?.hospital?._id || task?.area?.hospital || userHospital || '',
    area: task?.area?._id || '',
    order: task?.order || 0
  });
  const [errors, setErrors] = useState({});

  // Fetch areas filtered by selected hospital
  const { data: areasData } = useAreas({ hospitalId: formData.hospital || undefined, isActive: true });
  const areas = areasData?.areas || [];

  const hospitalOptions = useMemo(() => {
    if (!hospitals) return [];
    return hospitals.map(h => ({
      value: h._id,
      label: h.name
    }));
  }, [hospitals]);

  const areaOptions = useMemo(() => 
    areas?.map(area => ({ value: area._id, label: `${area.code} - ${area.name}` })) || [],
    [areas]
  );

  // Reset area when hospital changes
  useEffect(() => {
    if (!task && formData.hospital) {
      // Only reset if this is a new task (not editing)
      const currentAreaBelongsToHospital = areas.some(a => a._id === formData.area);
      if (!currentAreaBelongsToHospital) {
        setFormData(prev => ({ ...prev, area: '' }));
      }
    }
  }, [formData.hospital, areas, task, formData.area]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Task name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.hospital) newErrors.hospital = 'Hospital is required';
    if (!formData.area) newErrors.area = 'Area is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const submitData = { ...formData };
    if (!submitData.taskId) delete submitData.taskId;
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Hospital"
        value={formData.hospital}
        onChange={(e) => setFormData(prev => ({ ...prev, hospital: e.target.value, area: '' }))}
        options={hospitalOptions}
        placeholder="Select Hospital"
        error={errors.hospital}
        icon={HiOutlineBuildingOffice2}
      />
      <Select
        label="Area"
        value={formData.area}
        onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
        options={areaOptions}
        placeholder={formData.hospital ? "Select an area" : "Select hospital first"}
        error={errors.area}
        disabled={!formData.hospital}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Task ID (Auto-generated if empty)"
          value={formData.taskId}
          onChange={(e) => setFormData(prev => ({ ...prev, taskId: e.target.value.toUpperCase() }))}
          placeholder="e.g., CC1"
          error={errors.taskId}
        />
        <Input
          label="Display Order"
          type="number"
          value={formData.order}
          onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
          min={0}
        />
      </div>
      <Input
        label="Task Name"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        placeholder="e.g., General Setup"
        error={errors.name}
      />
      <div className="space-y-1">
        <label className="label">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Detailed description of the task..."
          rows={4}
          className={`input resize-none ${errors.description ? 'input-error' : ''}`}
        />
        {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading} className="flex-1">
          {task ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
};

const Tasks = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: hospitals } = useActiveHospitals();
  const { data: areasData } = useAreas({ hospitalId: filterHospital || undefined, isActive: true });
  const areas = areasData?.areas || [];
  
  const { data, isLoading, error } = useTasks({ 
    search, 
    areaId: filterArea || undefined,
    hospitalId: filterHospital || undefined
  });
  const { mutate: createTask, isPending: isCreating } = useCreateTask();
  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask();
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask();
  const { mutate: toggleStatus } = useToggleTaskStatus();

  const hospitalOptions = useMemo(() => {
    if (!hospitals) return [];
    return hospitals.map(h => ({
      value: h._id,
      label: h.name
    }));
  }, [hospitals]);

  const areaOptions = useMemo(() => 
    areas?.map(area => ({ value: area._id, label: area.name })) || [],
    [areas]
  );

  // Reset area filter when hospital filter changes
  useEffect(() => {
    if (filterHospital) {
      const currentAreaBelongsToHospital = areas.some(a => a._id === filterArea);
      if (!currentAreaBelongsToHospital) {
        setFilterArea('');
      }
    }
  }, [filterHospital, areas, filterArea]);

  const handleCreate = (formData) => {
    createTask(formData, {
      onSuccess: () => {
        setIsModalOpen(false);
      }
    });
  };

  const handleUpdate = (formData) => {
    updateTask(
      { id: selectedTask._id, data: formData },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          setSelectedTask(null);
        }
      }
    );
  };

  const handleDelete = () => {
    deleteTask(deleteConfirm._id, {
      onSuccess: () => {
        setDeleteConfirm(null);
      }
    });
  };

  const openEditModal = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-800">
            Tasks Management
          </h1>
          <p className="text-slate-500 mt-1">
            Configure checklist tasks for each area
          </p>
        </div>
        <Button
          variant="primary"
          icon={HiOutlinePlus}
          onClick={() => setIsModalOpen(true)}
        >
          Add Task
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={HiOutlineMagnifyingGlass}
            />
          </div>
          <Select
            value={filterHospital}
            onChange={(e) => setFilterHospital(e.target.value)}
            options={hospitalOptions}
            placeholder="Select Hospital"
            className="sm:w-48"
          />
          <Select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            options={areaOptions}
            placeholder="All Areas"
            className="sm:w-48"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="large" />
          </div>
        ) : error ? (
          <EmptyState
            title="Error loading tasks"
            description="Something went wrong. Please try again."
          />
        ) : !data?.tasks || data.tasks.length === 0 ? (
          <EmptyState
            icon={HiOutlineClipboardDocumentList}
            title="No tasks found"
            description="Create your first task to start building checklists."
            action={
              <Button variant="primary" icon={HiOutlinePlus} onClick={() => setIsModalOpen(true)}>
                Add Task
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="text-center">Task ID</th>
                  <th className="text-left">Hospital</th>
                  <th className="text-left">Area</th>
                  <th className="text-left">Name</th>
                  <th className="text-left min-w-[200px]">Description</th>
                  <th className="text-center">Order</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((task) => (
                  <tr key={task._id}>
                    <td className="text-center">
                      <span className="font-mono text-sm font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded">
                        {task.taskId}
                      </span>
                    </td>
                    <td className="text-left">
                      {task.area?.hospital ? (
                        <span className="inline-flex items-center gap-1 text-xs text-cyan-700">
                          <HiOutlineBuildingOffice2 className="w-3.5 h-3.5" />
                          {task.area.hospital.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="text-left">
                      <span className="text-sm text-slate-600">
                        {task.area?.name}
                      </span>
                    </td>
                    <td className="text-left font-medium text-slate-800">{task.name}</td>
                    <td className="text-left text-sm text-slate-600 max-w-xs">
                      <span className="line-clamp-2">{task.description}</span>
                    </td>
                    <td className="text-center">
                      <span className="text-sm text-slate-500">{task.order}</span>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => toggleStatus(task._id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          task.isActive
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {task.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(task)}
                          className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                        >
                          <HiOutlinePencilSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(task)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination info */}
        {data?.pagination && (
          <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            Showing {data.tasks.length} of {data.pagination.total} tasks
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedTask ? 'Edit Task' : 'Create Task'}
        size="large"
      >
        <TaskForm
          task={selectedTask}
          hospitals={hospitals}
          userHospital={user?.hospital?._id || user?.hospital}
          onSubmit={selectedTask ? handleUpdate : handleCreate}
          onClose={closeModal}
          isLoading={isCreating || isUpdating}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Task"
        size="small"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? 
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting} className="flex-1">
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Tasks;
