import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { loginWithEmail, loginWithGoogle } from '@/lib/auth';
import { getErrorMessage } from '@/utils/errorMessages';

export function useLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.email) {
      newErrors.email = 'Email wajib diisi';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Format email tidak valid';
    }

    if (!formData.password) {
      newErrors.password = 'Password wajib diisi';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    
    try {
      const { data, error } = await loginWithEmail({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setErrors({ email: getErrorMessage(error) });
        return;
      }

      if (data.user) {
        // Fetch role to determine redirect
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if ((profile as any)?.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (error) {
      setErrors({ email: 'Terjadi kesalahan. Silakan coba lagi.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setErrors({});
      const { error } = await loginWithGoogle();

      if (error) {
        setErrors({ email: getErrorMessage(error) });
      }
      // If successful, user will be redirected by Supabase to the callback URL
    } catch (error) {
      setErrors({ email: 'Terjadi kesalahan. Silakan coba lagi.' });
    }
  };

  return {
    formData,
    errors,
    loading,
    rememberMe,
    setRememberMe,
    handleInputChange,
    handleSubmit,
    handleGoogleLogin,
  };
}
