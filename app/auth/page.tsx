'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('') // New state for the confirm password
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Email validation - only @iyte.edu.tr is valid
  const validateEmail = (email: string) => {
    const regex = /^[a-zA-Z0-9._%+-]+@std.\iyte\.edu\.tr$/; // Only emails with @iyte.edu.tr are valid
    return regex.test(email)
  }

  // Password validation
  const validatePassword = (password: string) => {
    return password.length >= 6 // Password should be at least 6 characters long
  }

  // Check if the user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/grid') // If the user is logged in, redirect them to the grid page
      }
    }
    checkSession()
  }, [router])

  // Giriş işlemi
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateEmail(email)) {
      alert('Geçersiz email formatı. Sadece @iyte.edu.tr ile biten e-postalar geçerlidir.')
      return
    }

    if (!validatePassword(password)) {
      alert('Şifre en az 6 karakter uzunluğunda olmalıdır.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      router.push('/grid') // Başarılı giriş sonrası kullanıcıyı grid sayfasına yönlendir
    }
  }

  // Kayıt işlemi
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateEmail(email)) {
      alert('Geçersiz email formatı. Sadece @iyte.edu.tr ile biten e-postalar geçerlidir.')
      return
    }

    if (!validatePassword(password)) {
      alert('Şifre en az 6 karakter uzunluğunda olmalıdır.')
      return
    }

    if (password !== confirmPassword) { // Check if passwords match
      alert('Şifreler uyuşmuyor!')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      alert('Kayıt başarılı! Lütfen giriş yapın.')
      setIsLogin(true) // Kayıt başarılı olduğunda login formunu göster
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-r from-blue-500 via-teal-500 to-purple-600">
      <div className="w-full max-w-lg p-8 space-y-6 bg-black rounded-xl shadow-xl border-4 border-pink-500">
        <h1 className="text-5xl font-bold text-center text-white pixel-font">{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</h1>
        
        <form onSubmit={isLogin ? handleSignIn : handleSignUp} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-white">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-posta adresinizi girin"
              className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-md focus:outline-none pixel-input"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-white">Şifre</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifrenizi girin"
              className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-md focus:outline-none pixel-input"
            />
          </div>

          {!isLogin && ( // Only show this field on the registration form
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white">Şifreyi Tekrar Girin</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Şifrenizi tekrar girin"
                className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-md focus:outline-none pixel-input"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 bg-pink-500 text-white rounded-md hover:bg-pink-600 focus:ring-2 focus:ring-pink-500 disabled:opacity-50 transition ease-in-out pixel-button"
            disabled={loading}
          >
            {loading ? 'İşlem yapılıyor...' : isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-300">
            {isLogin ? "Hesabınız yok mu?" : 'Hesabınız var mı?'}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-1 text-pink-500 hover:text-pink-700 font-semibold transition ease-in-out"
            >
              {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
