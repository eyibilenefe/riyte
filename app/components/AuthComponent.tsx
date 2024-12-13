'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { User } from '@supabase/supabase-js'

export default function AuthComponent() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Kullanıcı oturum değişikliği takibi
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) alert(error.message)
  }

  if (user) {
    return (
      <div>
        <p>Signed in as {user.email}</p>
        <button onClick={handleSignOut} className="bg-red-500 text-white px-4 py-2 rounded mt-4">
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2>Sign In to Continue</h2>
      <form onSubmit={handleSignIn}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mr-2 p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mr-2 p-2 border rounded"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Sign In
        </button>
      </form>
      <button onClick={handleSignUp} className="bg-green-500 text-white px-4 py-2 rounded">
        Sign Up
      </button>
    </div>
  )
}
