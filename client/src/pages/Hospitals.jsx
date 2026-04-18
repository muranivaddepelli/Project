import React, { useState } from 'react';
import { 
  HiOutlinePlus, 
  HiOutlinePencilSquare, 
  HiOutlineTrash,
  HiOutlineMagnifyingGlass,
  HiOutlineBuildingOffice2,
  HiOutlinePhoto,
  HiOutlineStar,
  HiOutlineCheckCircle
} from 'react-icons/hi2';
import { 
  useHospitals, 
  useCreateHospital, 
  useUpdateHospital, 
  useDeleteHospital, 
  useToggleHospitalStatus,
  useSetDefaultHospital,
  useUploadHospitalLogo
} from '../hooks/useHospitals';
import { Button, Input, Modal, Spinner, EmptyState } from '../components/common';

const HospitalForm = ({ hospital, onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState({
    name: hospital?.name || '',
    code: hospital?.code || '',
    address: hospital?.address || '',
    phone: hospital?.phone || '',
    email: hospital?.email || '',
    logoUrl: hospital?.logoUrl || ''
  });
  const [logoPreview, setLogoPreview] = useState(hospital?.logoUrl || '');
  const [errors, setErrors] = useState({});

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, logoUrl: 'Image size must be less than 5MB' }));
        return;
      }
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, logoUrl: 'Please select an image file' }));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
        setFormData(prev => ({ ...prev, logoUrl: reader.result }));
        setErrors(prev => ({ ...prev, logoUrl: '' }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Hospital name is required';
    if (!formData.code.trim()) newErrors.code = 'Hospital code is required';
    else if (formData.code.length > 20) newErrors.code = 'Code cannot exceed 20 characters';
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    const submitData = { ...formData };
    // Clean empty fields
    Object.keys(submitData).forEach(key => {
      if (!submitData[key]) delete submitData[key];
    });
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Hospital Name *"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Enter hospital name"
        error={errors.name}
        icon={HiOutlineBuildingOffice2}
      />
      <Input
        label="Hospital Code *"
        value={formData.code}
        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
        placeholder="e.g., HOSP1, CLINIC_A"
        error={errors.code}
        disabled={!!hospital}
        className={hospital ? 'bg-slate-100' : ''}
      />
      <Input
        label="Address"
        value={formData.address}
        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
        placeholder="Enter hospital address"
        error={errors.address}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Phone"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          placeholder="Enter phone number"
          error={errors.phone}
        />
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder="Enter email"
          error={errors.email}
        />
      </div>
      
      {/* Logo Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Hospital Logo</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300">
            {logoPreview ? (
              <img 
                src={logoPreview} 
                alt="Logo preview" 
                className="w-full h-full object-contain"
              />
            ) : (
              <HiOutlinePhoto className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div className="flex-1">
            <label className="btn btn-secondary cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm">
              <HiOutlinePhoto className="w-4 h-4" />
              Choose Image
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB</p>
            {errors.logoUrl && <p className="text-xs text-red-500 mt-1">{errors.logoUrl}</p>}
          </div>
        </div>
        {logoPreview && (
          <button
            type="button"
            onClick={() => {
              setLogoPreview('');
              setFormData(prev => ({ ...prev, logoUrl: '' }));
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove logo
          </button>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading} className="flex-1">
          {hospital ? 'Update Hospital' : 'Create Hospital'}
        </Button>
      </div>
    </form>
  );
};

const LogoUploadModal = ({ hospital, onClose, onSubmit, isLoading }) => {
  const [logoData, setLogoData] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
        setLogoData(reader.result);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!logoData) {
      setError('Please select an image');
      return;
    }
    onSubmit(logoData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <div className="flex justify-center gap-4 items-end">
          {/* Current Logo */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Current</p>
            <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
              {hospital?.logoUrl ? (
                <img 
                  src={hospital.logoUrl} 
                  alt={hospital.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <HiOutlineBuildingOffice2 className="w-10 h-10 text-slate-400" />
              )}
            </div>
          </div>
          
          {logoPreview && (
            <>
              <div className="text-slate-400">→</div>
              {/* New Logo Preview */}
              <div>
                <p className="text-xs text-emerald-600 mb-1">New</p>
                <div className="w-20 h-20 rounded-xl bg-emerald-50 flex items-center justify-center overflow-hidden border-2 border-emerald-300">
                  <img 
                    src={logoPreview} 
                    alt="New logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">{hospital?.name}</p>
      </div>
      
      {/* File Upload */}
      <div className="space-y-2">
        <label className="w-full btn btn-secondary cursor-pointer flex items-center justify-center gap-2 py-3">
          <HiOutlinePhoto className="w-5 h-5" />
          {logoPreview ? 'Choose Different Image' : 'Select Image from Device'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        <p className="text-xs text-slate-500 text-center">PNG, JPG, GIF up to 5MB</p>
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary" 
          isLoading={isLoading} 
          className="flex-1"
          disabled={!logoData}
        >
          Update Logo
        </Button>
      </div>
    </form>
  );
};

const Hospitals = () => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data, isLoading, error } = useHospitals({ search, includeInactive: true });
  const { mutate: createHospital, isPending: isCreating } = useCreateHospital();
  const { mutate: updateHospital, isPending: isUpdating } = useUpdateHospital();
  const { mutate: deleteHospital, isPending: isDeleting } = useDeleteHospital();
  const { mutate: toggleStatus } = useToggleHospitalStatus();
  const { mutate: setDefault } = useSetDefaultHospital();
  const { mutate: uploadLogo, isPending: isUploadingLogo } = useUploadHospitalLogo();

  const handleCreate = (formData) => {
    createHospital(formData, {
      onSuccess: () => {
        setIsModalOpen(false);
      }
    });
  };

  const handleUpdate = (formData) => {
    updateHospital(
      { id: selectedHospital._id, data: formData },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          setSelectedHospital(null);
        }
      }
    );
  };

  const handleDelete = () => {
    deleteHospital(deleteConfirm._id, {
      onSuccess: () => {
        setDeleteConfirm(null);
      }
    });
  };

  const handleLogoUpload = (logoUrl) => {
    uploadLogo(
      { id: selectedHospital._id, logoUrl },
      {
        onSuccess: () => {
          setIsLogoModalOpen(false);
          setSelectedHospital(null);
        }
      }
    );
  };

  const openEditModal = (hospital) => {
    setSelectedHospital(hospital);
    setIsModalOpen(true);
  };

  const openLogoModal = (hospital) => {
    setSelectedHospital(hospital);
    setIsLogoModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedHospital(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-800">
            Hospital Management
          </h1>
          <p className="text-slate-500 mt-1">
            Manage hospitals, logos, and settings
          </p>
        </div>
        <Button
          variant="primary"
          icon={HiOutlinePlus}
          onClick={() => setIsModalOpen(true)}
        >
          Add Hospital
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <Input
          placeholder="Search hospitals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={HiOutlineMagnifyingGlass}
        />
      </div>

      {/* Hospitals Grid */}
      {isLoading ? (
        <div className="card p-20">
          <div className="flex items-center justify-center">
            <Spinner size="large" />
          </div>
        </div>
      ) : error ? (
        <EmptyState
          title="Error loading hospitals"
          description="Something went wrong. Please try again."
        />
      ) : !data?.hospitals || data.hospitals.length === 0 ? (
        <EmptyState
          icon={HiOutlineBuildingOffice2}
          title="No hospitals found"
          description="Create your first hospital to get started."
          action={
            <Button variant="primary" icon={HiOutlinePlus} onClick={() => setIsModalOpen(true)}>
              Add Hospital
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.hospitals.map((hospital) => (
            <div 
              key={hospital._id} 
              className={`card p-5 relative ${!hospital.isActive ? 'opacity-60' : ''}`}
            >
              {/* Default Badge */}
              {hospital.isDefault && (
                <div className="absolute bottom-12 right-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    <HiOutlineStar className="w-3 h-3" />
                    Default
                  </span>
                </div>
              )}

              {/* Logo & Name */}
              <div className="flex items-start gap-4 mb-4">
                <div 
                  className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all"
                  onClick={() => openLogoModal(hospital)}
                >
                  {hospital.logoUrl ? (
                    <img 
                      src={hospital.logoUrl} 
                      alt={hospital.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <HiOutlineBuildingOffice2 className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{hospital.name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{hospital.code}</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1 text-sm text-slate-600 mb-4">
                {hospital.address && (
                  <p className="truncate">{hospital.address}</p>
                )}
                {hospital.phone && (
                  <p>📞 {hospital.phone}</p>
                )}
                {hospital.email && (
                  <p>✉️ {hospital.email}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  onClick={() => toggleStatus(hospital._id)}
                  disabled={hospital.isDefault && hospital.isActive}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    hospital.isActive
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  } ${hospital.isDefault && hospital.isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {hospital.isActive ? 'Active' : 'Inactive'}
                </button>

                <div className="flex items-center gap-1">
                  {!hospital.isDefault && hospital.isActive && (
                    <button
                      onClick={() => setDefault(hospital._id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      title="Set as default"
                    >
                      <HiOutlineStar className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openLogoModal(hospital)}
                    className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Change logo"
                  >
                    <HiOutlinePhoto className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(hospital)}
                    className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Edit hospital"
                  >
                    <HiOutlinePencilSquare className="w-4 h-4" />
                  </button>
                  {!hospital.isDefault && (
                    <button
                      onClick={() => setDeleteConfirm(hospital)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete hospital"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination info */}
      {data?.pagination && (
        <div className="text-sm text-slate-500 text-center">
          Showing {data.hospitals.length} of {data.pagination.total} hospitals
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedHospital ? 'Edit Hospital' : 'Create Hospital'}
      >
        <HospitalForm
          hospital={selectedHospital}
          onSubmit={selectedHospital ? handleUpdate : handleCreate}
          onClose={closeModal}
          isLoading={isCreating || isUpdating}
        />
      </Modal>

      {/* Logo Upload Modal */}
      <Modal
        isOpen={isLogoModalOpen}
        onClose={() => {
          setIsLogoModalOpen(false);
          setSelectedHospital(null);
        }}
        title="Update Hospital Logo"
        size="small"
      >
        <LogoUploadModal
          hospital={selectedHospital}
          onClose={() => {
            setIsLogoModalOpen(false);
            setSelectedHospital(null);
          }}
          onSubmit={handleLogoUpload}
          isLoading={isUploadingLogo}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Hospital"
        size="small"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? 
            This will affect all users and data associated with this hospital.
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

export default Hospitals;

