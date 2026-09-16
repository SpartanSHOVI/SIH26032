import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Shield, Save, Edit2, Eye, EyeOff } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { api, authApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().length(10, 'Phone must be 10 digits'),
  preferredLanguage: z.string().min(1, 'Select language'),
  centerPreferenceId: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const languages = [
  { code: 'hi', name: 'Hindi (हिंदी)' },
  { code: 'en', name: 'English' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
];

export default function Profile() {
  const { farmer, refreshAuth } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const { data: centers = [] } = useQuery({
    queryKey: ['centers', farmer?.state, farmer?.district],
    queryFn: () => api.get('/centers', { params: { state: farmer?.state, district: farmer?.district } }).then(res => res.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: farmer?.name || '',
      phone: farmer?.phoneMasked?.replace(/X/g, '') || '',
      preferredLanguage: farmer?.preferredLanguage || 'hi',
      centerPreferenceId: farmer?.centerPreferenceId || '',
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile(data),
    onSuccess: async () => {
      toast.success('Profile updated successfully');
      setEditing(false);
      await refreshAuth();
      queryClient.invalidateQueries({ queryKey: ['myBookings'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    },
  });

  const onSubmit = (data: ProfileForm) => {
    updateProfileMutation.mutate(data);
  };

  const handleCancel = () => {
    setEditing(false);
    reset({
      name: farmer?.name || '',
      phone: farmer?.phoneMasked?.replace(/X/g, '') || '',
      preferredLanguage: farmer?.preferredLanguage || 'hi',
      centerPreferenceId: farmer?.centerPreferenceId || '',
    });
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '';
    if (phone.length !== 10) return phone;
    return 'XXXXXX' + phone.slice(-2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Profile</h1>
        <p className="text-primary-600">Manage your account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardContent className="py-6 text-center">
              <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-12 h-12 text-primary-600" />
              </div>
              <h2 className="text-xl font-semibold text-primary-900">{farmer?.name || 'Farmer'}</h2>
              <p className="text-primary-600 mt-1">Farmer ID: {farmer?.farmerId}</p>
              <p className="text-sm text-primary-500 mt-2">
                Registered: {farmer?.createdAt ? new Date(farmer.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-600" />
                Data Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-primary-600">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Consent given: {farmer?.consentGiven ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-2 text-primary-600">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>DPDP Act 2023 compliant</span>
              </div>
              <div className="flex items-center gap-2 text-primary-600">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Data minimization applied</span>
              </div>
              <div className="flex items-center gap-2 text-primary-600">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Right to erasure available</span>
              </div>
              <p className="text-primary-500 mt-2">
                Your Aadhaar is stored as a hash. Only masked versions are displayed.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary-600" />
                Personal Information
              </CardTitle>
              {editing ? (
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {!editing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Farmer ID</p>
                        <p className="font-medium text-primary-900 text-lg">{farmer?.farmerId}</p>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Aadhaar (Masked)</p>
                        <p className="font-medium text-primary-900">{farmer?.aadhaarMasked}</p>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Name</p>
                        <p className="font-medium text-primary-900">{farmer?.name}</p>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Phone</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-primary-900 font-mono">
                            {showPhone ? (farmer?.mobile || farmer?.phone || '—') : maskPhone(farmer?.mobile || farmer?.phone || '')}
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowPhone(!showPhone)}
                            className="text-primary-600 hover:text-primary-700 text-sm"
                          >
                            {showPhone ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Location</p>
                        <p className="font-medium text-primary-900">{farmer?.district ? `${farmer.district}, ` : ''}{farmer?.state || farmer?.stateCode || 'India'}</p>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Registered Crop & Volume</p>
                        <p className="font-medium text-primary-900">{farmer?.crop || 'Produce'} ({farmer?.quantity ? `${farmer.quantity} Qtl` : '—'})</p>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">DBT Bank Account</p>
                        <p className="font-medium text-primary-900 font-mono">{farmer?.bank_account || farmer?.bankAccount || 'Not linked'}</p>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Bank IFSC</p>
                        <p className="font-medium text-primary-900 font-mono uppercase">{farmer?.ifsc || '—'}</p>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Preferred Language</p>
                        <p className="font-medium text-primary-900">
                          {farmer?.language || farmer?.preferredLanguage || 'English'}
                        </p>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Preferred Center</p>
                        <p className="font-medium text-primary-900">
                          {centers.find((c: any) => c.id === (farmer?.preferredCenterId || farmer?.centerPreferenceId))?.name || 'Assigned by District'}
                        </p>
                      </div>
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-primary-600">Consent Given</p>
                        <p className="font-medium text-primary-900">{farmer?.consentGiven ? 'Yes (DPDP 2023)' : 'Yes'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-primary-700 mb-2">
                          Full Name
                        </label>
                        <input
                          {...register('name')}
                          id="name"
                          type="text"
                          className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-primary-700 mb-2">
                          Mobile Number
                        </label>
                        <input
                          {...register('phone')}
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="preferredLanguage" className="block text-sm font-medium text-primary-700 mb-2">
                          Preferred Language
                        </label>
                        <select
                          {...register('preferredLanguage')}
                          id="preferredLanguage"
                          className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          {languages.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="centerPreferenceId" className="block text-sm font-medium text-primary-700 mb-2">
                          Preferred Procurement Center
                        </label>
                        <select
                          {...register('centerPreferenceId')}
                          id="centerPreferenceId"
                          className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">Select Center</option>
                          {centers.map((center: any) => (
                            <option key={center.id} value={center.id}>{center.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-primary-200">
                      <Button type="button" variant="outline" onClick={handleCancel}>
                        Cancel
                      </Button>
                      <Button type="submit" loading={isSubmitting}>
                        <Save className="w-4 h-4" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-600" />
                Security & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-primary-50 rounded-lg">
                <h4 className="font-medium text-primary-900 mb-2">Data Protection (DPDP Act 2023)</h4>
                <ul className="text-sm text-primary-600 space-y-1 list-disc list-inside">
                  <li>Your Aadhaar number is never stored in plain text</li>
                  <li>Only SHA-256 hash of last 4 digits is stored</li>
                  <li>Phone number is masked (XXXXXX12) in all displays</li>
                  <li>Consent is required for data processing</li>
                  <li>You can request data deletion anytime</li>
                </ul>
              </div>

              <div className="p-4 bg-primary-50 rounded-lg">
                <h4 className="font-medium text-primary-900 mb-2">Account Security</h4>
                <ul className="text-sm text-primary-600 space-y-1 list-disc list-inside">
                  <li>JWT tokens expire in 1 hour (refresh token: 7 days)</li>
                  <li>Rate limiting: 5 requests/minute per IP</li>
                  <li>CAPTCHA required for booking</li>
                  <li>All API calls over HTTPS/TLS</li>
                </ul>
              </div>

              <div className="p-4 bg-primary-50 rounded-lg">
                <h4 className="font-medium text-primary-900 mb-2">Your Rights</h4>
                <ul className="text-sm text-primary-600 space-y-1 list-disc list-inside">
                  <li>Access your personal data</li>
                  <li>Request correction of inaccurate data</li>
                  <li>Request deletion of your data</li>
                  <li>Withdraw consent anytime</li>
                  <li>Lodge complaint with Data Protection Board</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-primary-200">
                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download My Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function Download({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}