'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 1. Authenticate the user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. Check the user's role in the profiles table
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', authData.user.id)
        .single()

      // 3. Route them to the correct dashboard
      if (profile?.is_admin) {
        router.push('/admin')
      } else {
        router.push('/dashboard/client')
      }
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md border border-white/10">
        <h1 className="text-2xl font-bold text-white mb-6">Login to YourResearchWriter</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-white/20 rounded-xl p-3 text-white"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black border border-white/20 rounded-xl p-3 text-white"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl hover:bg-emerald-400 transition"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400 mt-4">
          Don’t have an account?{' '}
          <a href="/register" className="text-emerald-500">Register</a>
        </p>
      </div>
    </div>
  )
}