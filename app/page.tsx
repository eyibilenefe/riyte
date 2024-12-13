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
        // Eğer kullanıcı giriş yaptıysa, grid sayfasına yönlendir
        router.push('/grid')
      }
    })

    // Component unmount olduğunda auth listener'ı temizle
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">r/place Clone</h1>

      {user === null ? (
        <div>
          <p>Please sign in to continue</p>
          {/* Giriş yapmak için yönlendirecek buton */}
          <button
            onClick={() => router.push('/auth')}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Go to Login
          </button>
        </div>
      ) : user === false ? (
        <p>Loading...</p>
      ) : (
        // Eğer kullanıcı giriş yaptıysa, grid'e yönlendirildikten sonra başka bir şey gösterebilirsiniz
        <p>Redirecting to grid...</p>
      )}
    </main>
  )
}
