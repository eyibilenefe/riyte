'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Auth listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        // If the user is logged in, redirect to the grid page
        router.push('/grid')
      }
    })

    // Clean up auth listener on component unmount
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 p-6">
      <h1 className="text-5xl font-extrabold text-center text-white mb-12">r/place Clone</h1>

      {user === null ? (
        <div className="text-center text-white">
          <p className="text-xl mb-6">Please sign in to continue</p>
          {/* Redirect button to the login page */}
          <button
            onClick={() => router.push('/auth')}
            className="bg-indigo-600 text-white py-3 px-6 rounded-lg text-lg hover:bg-indigo-700 transition ease-in-out transform hover:scale-105"
          >
            Go to Login
          </button>
        </div>
      ) : user === false ? (
        <p className="text-white text-xl">Loading...</p>
      ) : (
        <p className="text-white text-xl">Redirecting to grid...</p>
      )}
    </main>
  )
}
