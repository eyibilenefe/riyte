'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Email validation
  const validateEmail = (email: string) => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return regex.test(email)
  }

  // Password validation
  const validatePassword = (password: string) => {
    return password.length >= 6 // You can add more complex password checks if needed
  }

  // Test kullanıcı için otomatik giriş mekanizması
  useEffect(() => {
    /* TEST KULLANICI İÇİN OTOMATİK GİRİŞ */
    const testEmail = 'deneme@gmail.com'
    const testPassword = 'efeoyunda31'

    const autoLogin = async () => {
      setLoading(true)
      const { error, user } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      })
      setLoading(false)

      if (error) {
        console.error('Test kullanıcısı için giriş başarısız:', error.message)
        alert(`Test kullanıcısı için giriş başarısız: ${error.message}`)
      } else {
        console.log('Test kullanıcısı için giriş başarılı:', user)
        router.push('/grid')
      }
    }

    autoLogin()
  }, [router]) // Router bağımlılığı eklenmiştir

  // Giriş işlemi
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateEmail(email)) {
      alert('Invalid email format')
      return
    }

    if (!validatePassword(password)) {
      alert('Password should be at least 6 characters long')
      return
    }

    setLoading(true)

    const { error, user } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      router.push('/grid')
    }
  }

  // Kayıt işlemi
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateEmail(email)) {
      alert('Invalid email format')
      return
    }

    if (!validatePassword(password)) {
      alert('Password should be at least 6 characters long')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      alert('Sign up successful! Please log in.')
      setIsLogin(true) // Kayıt başarılı olduğunda login formunu göster
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-md">
        <h1 className="text-3xl font-bold text-center">{isLogin ? 'Sign In' : 'Sign Up'}</h1>
        
        <form onSubmit={isLogin ? handleSignIn : handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="mt-2 block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-2 block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-1 text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
