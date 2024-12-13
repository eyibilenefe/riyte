'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { User } from '@supabase/supabase-js'

const GRID_SIZE = 50
const COOLDOWN_TIME = 5  // 5 minutes in milliseconds

interface Pixel {
  x: number
  y: number
  color: string
  user_id: string
}

export default function PixelGrid() {
  const [grid, setGrid] = useState<string[][]>(Array(GRID_SIZE).fill(Array(GRID_SIZE).fill('#FFFFFF')))
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [lastPlacedTime, setLastPlacedTime] = useState(0)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const fetchGrid = async () => {
      const { data, error } = await supabase
        .from('pixels')
        .select('*')
        .order('id', { ascending: true })

      if (error) {
        console.error('Error fetching grid:', error)
      } else if (data) {
        const newGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('#FFFFFF'))
        data.forEach((pixel: Pixel) => {
          newGrid[pixel.y][pixel.x] = pixel.color
        })
        setGrid(newGrid)
      }
    }

    fetchGrid()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    const subscription = supabase
      .channel('pixel_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pixels' }, (payload) => {
        setGrid((prevGrid) => {
          const newGrid = [...prevGrid.map(row => [...row])];
          const { x, y, color } = payload.new as Pixel;
          newGrid[y][x] = color;
          return newGrid;
        })
      })
      .subscribe()

    return () => {
      authListener.subscription.unsubscribe()
      subscription.unsubscribe()
    }
  }, [])

  const placePixel = useCallback(async (x: number, y: number) => {
    if (!user) {
      alert('Please sign in to place pixels')
      return
    }

    const now = Date.now()

    // Eğer soğuma süresi bitmemişse, kullanıcıyı bilgilendir
    if (now - lastPlacedTime < COOLDOWN_TIME) {
      const remainingTime = Math.ceil((COOLDOWN_TIME - (now - lastPlacedTime)) / 1000)
      alert(`Please wait ${remainingTime} seconds before placing another pixel.`)
      return
    }

    // Pixeli veritabanına ekle
    const { data, error } = await supabase
      .from('pixels')
      .upsert({ x, y, color: selectedColor, user_id: user.id })

    if (error) {
      // Hata nesnesinin daha ayrıntılı loglanması
      console.error('Error placing pixel:', error.message || error.details || error)
    } else {
      // Pixel yerleştirildikten sonra zaman bilgisini güncelle
      setLastPlacedTime(now)
    }
  }, [selectedColor, lastPlacedTime, user])

  return (
    <div>
      <div className="mb-4">
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="mr-2"
        />
        <span>Selected Color: {selectedColor}</span>
      </div>
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
        {grid.map((row, y) =>
          row.map((color, x) => (
            <div
              key={`${x}-${y}`}
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: color,
                border: '1px solid #ccc',
              }}
              onClick={() => placePixel(x, y)}
            />
          ))
        )}
      </div>
    </div>
  )
}
