'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ensureProfileExists } from '@/lib/expService';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code from URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken) {
          // Set the session
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            router.push('/login?error=auth_failed');
            return;
          }

          // Ensure profile exists for the authenticated user
          if (data.session?.user) {
            await ensureProfileExists(data.session.user.id);
            
            // Check role
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', data.session.user.id)
              .single();

            if ((profile as any)?.role === 'admin') {
              router.push('/admin');
            } else {
              router.push('/dashboard');
            }
          } else {
            // Redirect to dashboard as fallback
            router.push('/dashboard');
          }
        } else {
          // No token found, redirect to login
          router.push('/login');
        }
      } catch (error) {
        router.push('/login?error=auth_failed');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#16a34a] mx-auto"></div>
        <p className="mt-4 text-gray-600 font-['CircularStd']">
          Memproses login...
        </p>
      </div>
    </div>
  );
}
