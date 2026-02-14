import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  HiOutlineEnvelope, 
  HiOutlineLockClosed, 
  HiOutlineEye, 
  HiOutlineEyeSlash,
  HiOutlineUser,
  HiOutlineBuildingOffice2
} from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { Logo, Button, Input, Select } from '../components/common';
import { authService } from '../services';
import { useActiveHospitals } from '../hooks/useHospitals';
import toast from 'react-hot-toast';
import logo from '../../src/assets/Logo.png';

const Signup = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: hospitals, isLoading: hospitalsLoading } = useActiveHospitals();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    hospital: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Set default hospital when hospitals load
  useEffect(() => {
    if (hospitals && hospitals.length > 0 && !formData.hospital) {
      const defaultHospital = hospitals.find(h => h.isDefault) || hospitals[0];
      setFormData(prev => ({ ...prev, hospital: defaultHospital._id }));
    }
  }, [hospitals, formData.hospital]);

  const hospitalOptions = useMemo(() => {
    if (!hospitals) return [];
    return hospitals.map(h => ({
      value: h._id,
      label: h.name
    }));
  }, [hospitals]);

  const selectedHospital = useMemo(() => {
    if (!hospitals || !formData.hospital) return null;
    return hospitals.find(h => h._id === formData.hospital);
  }, [hospitals, formData.hospital]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const validate = () => {
    const newErrors = {};
    
    if (!formData.name) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const registerData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      };
      if (formData.hospital) {
        registerData.hospital = formData.hospital;
      }
      await authService.register(registerData);
      
      toast.success('Account created successfully! Please sign in.');
      navigate('/login');
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-medical-teal to-primary-700 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-white blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-12">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mb-8">
  <img
    src={logo}
    alt="Sugar & Heart Clinic"
    className="w-14 h-14 object-contain"
  />
</div>

            <h1 className="text-4xl font-display font-bold mb-4">
              Sugar & Heart Clinic
            </h1>
            <p className="text-xl text-white/80 leading-relaxed">
              Daily Checklist Management System
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Create Your Account</h3>
                <p className="text-sm text-white/70">Join our healthcare management system</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Secure & Private</h3>
                <p className="text-sm text-white/70">Your data is encrypted and protected</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Get Started Quickly</h3>
                <p className="text-sm text-white/70">Simple signup process</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10 flex justify-center">
            <Logo size="large" />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-slate-800 mb-2">
              Create Account
            </h2>
            <p className="text-slate-500">
              Sign up to get started with the system
            </p>
          </div>

          {/* Hospital Selection Info */}
          {selectedHospital && (
            <div className="mb-6 p-4 bg-gradient-to-r from-cyan-50 to-teal-50 rounded-xl border border-cyan-100">
              <div className="flex items-center gap-4">
                {selectedHospital.logoUrl ? (
                  <img 
                    src={selectedHospital.logoUrl} 
                    alt={selectedHospital.name}
                    className="w-14 h-14 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <HiOutlineBuildingOffice2 className="w-7 h-7 text-cyan-600" />
                  </div>
                )}
                <div>
                  <p className="text-xs text-cyan-600 font-medium uppercase tracking-wider">Registering for</p>
                  <p className="text-lg font-semibold text-slate-800">{selectedHospital.name}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Hospital Selection */}
            {hospitals && hospitals.length > 1 && (
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Select Hospital
                </label>
                <div className="relative">
                  <HiOutlineBuildingOffice2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    name="hospital"
                    value={formData.hospital}
                    onChange={handleChange}
                    className="input pl-10 w-full"
                  >
                    {hospitalOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <Input
              label="Full Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              icon={HiOutlineUser}
              error={errors.name}
              autoComplete="name"
            />

            <Input
              label="Email Address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              icon={HiOutlineEnvelope}
              error={errors.email}
              autoComplete="email"
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password"
                icon={HiOutlineLockClosed}
                error={errors.password}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? (
                  // <HiOutlineEyeSlash className="w-5 h-5" />
                <HiOutlineEye className="w-5 h-5" />

                ) : (
                  <HiOutlineEyeSlash className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                icon={HiOutlineLockClosed}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirmPassword ? (
                  <HiOutlineEye className="w-5 h-5" />
                ) : (
                  <HiOutlineEyeSlash className="w-5 h-5" />

                )}
              </button>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                className="w-full py-3"
              >
                Create Account
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;

