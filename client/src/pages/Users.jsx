import React, { useState, useMemo } from 'react';
import { 
  HiOutlinePlus, 
  HiOutlinePencilSquare, 
  HiOutlineTrash,
  HiOutlineMagnifyingGlass,
  HiOutlineUsers,
  HiOutlineShieldCheck,
  HiOutlineUser,
  HiOutlineBuildingOffice2
} from 'react-icons/hi2';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useToggleUserStatus } from '../hooks/useUsers';
import { useActiveHospitals } from '../hooks/useHospitals';
import { Button, Input, Select, Modal, Spinner, EmptyState } from '../components/common';

const UserForm = ({ user, hospitals, onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'staff',
    hospital: user?.hospital?._id || user?.hospital || ''
  });
  const [errors, setErrors] = useState({});

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'staff', label: 'Staff' }
  ];

  const hospitalOptions = useMemo(() => {
    if (!hospitals) return [];
    return hospitals.map(h => ({
      value: h._id,
      label: h.name
    }));
  }, [hospitals]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!user && !formData.password) newErrors.password = 'Password is required';
    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!formData.role) newErrors.role = 'Role is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    const submitData = { ...formData };
    if (!submitData.password) delete submitData.password;
    if (!submitData.hospital) delete submitData.hospital;
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Full Name"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Enter full name"
        error={errors.name}
        icon={HiOutlineUser}
      />
      <Input
        label="Email Address"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        placeholder="Enter email address"
        error={errors.email}
      />
      <Input
        label={user ? "New Password (leave blank to keep current)" : "Password"}
        type="password"
        value={formData.password}
        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
        placeholder={user ? "Enter new password" : "Enter password"}
        error={errors.password}
      />
      <Select
        label="Role"
        value={formData.role}
        onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
        options={roleOptions}
        error={errors.role}
      />
      <Select
        label="Hospital"
        value={formData.hospital}
        onChange={(e) => setFormData(prev => ({ ...prev, hospital: e.target.value }))}
        options={hospitalOptions}
        placeholder="Select Hospital"
        error={errors.hospital}
      />
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading} className="flex-1">
          {user ? 'Update User' : 'Create User'}
        </Button>
      </div>
    </form>
  );
};

const Users = () => {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterHospital, setFilterHospital] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data, isLoading, error } = useUsers({ 
    search, 
    role: filterRole || undefined,
    hospital: filterHospital || undefined 
  });
  const { data: hospitals, isLoading: hospitalsLoading } = useActiveHospitals();
  const { mutate: createUser, isPending: isCreating } = useCreateUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser();
  const { mutate: toggleStatus } = useToggleUserStatus();

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'staff', label: 'Staff' }
  ];

  const hospitalOptions = useMemo(() => {
    if (!hospitals) return [];
    return hospitals.map(h => ({
      value: h._id,
      label: h.name
    }));
  }, [hospitals]);

  const handleCreate = (formData) => {
    createUser(formData, {
      onSuccess: () => {
        setIsModalOpen(false);
      }
    });
  };

  const handleUpdate = (formData) => {
    updateUser(
      { id: selectedUser._id, data: formData },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          setSelectedUser(null);
        }
      }
    );
  };

  const handleDelete = () => {
    deleteUser(deleteConfirm._id, {
      onSuccess: () => {
        setDeleteConfirm(null);
      }
    });
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-800">
            Users Management
          </h1>
          <p className="text-slate-500 mt-1">
            Manage user accounts and roles
          </p>
        </div>
        <Button
          variant="primary"
          icon={HiOutlinePlus}
          onClick={() => setIsModalOpen(true)}
        >
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={HiOutlineMagnifyingGlass}
            />
          </div>
          <Select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            options={roleOptions}
            placeholder="All Roles"
            className="sm:w-48"
          />
          <Select
            value={filterHospital ?? ''}
            onChange={(e) => setFilterHospital(e.target.value || null)}
            options={hospitalOptions}
            placeholder="Select Hospital"
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
            title="Error loading users"
            description="Something went wrong. Please try again."
          />
        ) : !data?.users || data.users.length === 0 ? (
          <EmptyState
            icon={HiOutlineUsers}
            title="No users found"
            description="Create your first user to get started."
            action={
              <Button variant="primary" icon={HiOutlinePlus} onClick={() => setIsModalOpen(true)}>
                Add User
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="text-left">User</th>
                  <th className="text-left">Email</th>
                  <th className="text-left">Hospital</th>
                  <th className="text-center">Role</th>
                  <th className="text-center">Registered On</th> {/* ✅ NEW */}

                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user._id}>
                    <td className="text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-medical-teal flex items-center justify-center text-white font-semibold">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">{user.name}</span>
                      </div>
                    </td>
                    <td className="text-left text-slate-600">{user.email}</td>
                    <td className="text-left">
                      {user.hospital ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                          <HiOutlineBuildingOffice2 className="w-3.5 h-3.5" />
                          {user.hospital.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Not assigned</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className={`
                        inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                        ${user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-blue-100 text-blue-700'
                        }
                      `}>
                        {user.role === 'admin' 
                          ? <HiOutlineShieldCheck className="w-3.5 h-3.5" />
                          : <HiOutlineUser className="w-3.5 h-3.5" />
                        }
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="text-center text-slate-600">
  {user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-GB')
    : '-'}
</td>

                    <td className="text-center">
                      <button
                        onClick={() => toggleStatus(user._id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          user.isActive
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                        >
                          <HiOutlinePencilSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(user)}
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
            Showing {data.users.length} of {data.pagination.total} users
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedUser ? 'Edit User' : 'Create User'}
      >
        <UserForm
          user={selectedUser}
          hospitals={hospitals}
          onSubmit={selectedUser ? handleUpdate : handleCreate}
          onClose={closeModal}
          isLoading={isCreating || isUpdating}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete User"
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

export default Users;

