'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

const GRID_SIZE = 50;  // Fixed grid size
const COOLDOWN_TIME = 1 * 60 * 1000;  // 1 minute cooldown time

interface Pixel {
  x: number;
  y: number;
  color: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const colorPalette = [
  '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF',
  '#4B0082', '#000000','#FFFFFF','#8A2BE2', '#FF1493', '#FFD700', '#32CD32'
];

function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export default function PixelGrid() {
  const [grid, setGrid] = useState<string[][]>(Array(GRID_SIZE).fill(Array(GRID_SIZE).fill('#FFFFFF')));
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [user, setUser] = useState<User | null>(null);
  const [selectedPixel, setSelectedPixel] = useState<{ x: number, y: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [scale, setScale] = useState(1);  // Zoom level
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // Grid offset
  const [remainingCooldown, setRemainingCooldown] = useState(0); // Track remaining cooldown time
  const gridRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const isPanning = useRef(false); // Is panning active?
  
  useEffect(() => {
    const fetchGrid = async () => {
      const { data, error } = await supabase
        .from('pixels')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching grid:', error);
      } else if (data) {
        const newGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('#FFFFFF'));
        data.forEach((pixel: Pixel) => {
          if (pixel.y < GRID_SIZE && pixel.x < GRID_SIZE) {
            newGrid[pixel.y][pixel.x] = pixel.color;
          }
        });
        setGrid(newGrid);
      }
    };

    fetchGrid();

    const intervalId = setInterval(fetchGrid, 1000); // Update grid every second

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    const subscription = supabase
      .channel('pixel_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pixels' }, (payload) => {
        setGrid((prevGrid) => {
          const newGrid = [...prevGrid.map(row => [...row])];
          const { x, y, color } = payload.new as Pixel;
          if (y < GRID_SIZE && x < GRID_SIZE) {
            newGrid[y][x] = color;
          }
          return newGrid;
        });
      })
      .subscribe();

    return () => {
      clearInterval(intervalId); // Cleanup interval on unmount
      authListener.subscription.unsubscribe();
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Center the grid initially only on the client side (window is available only in the browser)
    if (typeof window !== 'undefined') {
      const initialOffsetX = (window.innerWidth - GRID_SIZE * 15) / 2;
      const initialOffsetY = (window.innerHeight - GRID_SIZE * 15) / 2;
      setOffset({ x: initialOffsetX, y: initialOffsetY });
    }
  }, []);

  useEffect(() => {
    // Cooldown timer
    let interval: NodeJS.Timeout;
    if (remainingCooldown > 0) {
      interval = setInterval(() => {
        setRemainingCooldown((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      clearInterval(interval);
    };
  }, [remainingCooldown]);

  const placePixel = async () => {
    if (!selectedPixel || !user) {
      alert('Please select a pixel and sign in to place pixels');
      return;
    }

    const { x, y } = selectedPixel;
    const now = Date.now();

    const { data, error } = await supabase
      .from('pixels')
      .select('created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching last placed or updated pixel:', error.message);
      return;
    }

    const lastPixelTime = data?.[0]?.updated_at ? new Date(data[0].updated_at).getTime() : 0;
    const createdPixelTime = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : 0;

    const latestPixelTime = Math.max(lastPixelTime, createdPixelTime);

    if (latestPixelTime && now - latestPixelTime < COOLDOWN_TIME) {
      const remainingTime = Math.ceil((COOLDOWN_TIME - (now - latestPixelTime)) / 1000);
      setRemainingCooldown(remainingTime);  // Set the remaining cooldown time
      alert(`Please wait ${remainingTime} seconds before placing another pixel.`);
      return;
    }

    const { error: upsertError } = await supabase
      .from('pixels')
      .upsert(
        [
          { x, y, color: selectedColor, user_id: user.id }
        ],
        { onConflict: 'x,y' } // Composite key as a single string
      );

    if (upsertError) {
      console.error('Error placing pixel:', upsertError.message || upsertError.details || upsertError);
      alert("There was an error placing the pixel, please try again.");
    } else {
      setSelectedPixel(null);
      setShowColorPicker(false);
    }
  };

  const debouncedPlacePixel = debounce(placePixel, 300);

  const handleZoom = (event: React.WheelEvent) => {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    setScale((prevScale) => {
      let newScale = prevScale * zoomFactor;
      newScale = Math.max(0.5, Math.min(2, newScale));
      return newScale;
    });
  };

  const handleTouchZoom = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      setScale((prevScale) => {
        let newScale = prevScale * distance / 200;
        newScale = Math.max(0.5, Math.min(2, newScale));
        return newScale;
      });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isPanning.current) return;

    const deltaX = event.movementX;
    const deltaY = event.movementY;

    setOffset((prevOffset) => ({
      x: prevOffset.x + deltaX,
      y: prevOffset.y + deltaY,
    }));
  };

  const startPanning = () => {
    isPanning.current = true;
  };

  const stopPanning = () => {
    isPanning.current = false;
  };

  const handlePixelSelect = (x: number, y: number) => {
    setSelectedPixel({ x, y });
    setShowColorPicker(true);
  };

  return (
    <div
      onWheel={handleZoom}
      onTouchMove={handleTouchZoom}
      onMouseMove={(e) => {
        handleMouseMove(e);
      }}
      onMouseDown={startPanning}
      onMouseUp={stopPanning}
      onMouseLeave={stopPanning}
      style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        cursor: isPanning.current ? 'grabbing' : 'grab',
      }}
    >
      <div
        ref={gridContainerRef}
        className="grid-container"
        style={{
          width: `${GRID_SIZE * 15}px`,
          height: `${GRID_SIZE * 15}px`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          ref={gridRef}
          className="grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, 15px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 15px)`,
            width: '100%',
            height: '100%',
          }}
        >
          {grid.map((row, y) =>
            row.map((color, x) => (
              <div
                key={`${x}-${y}`}
                data-x={x} data-y={y}
                style={{
                  width: '15px',
                  height: '15px',
                  backgroundColor: color,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  outline: selectedPixel?.x === x && selectedPixel?.y === y ? '2px solid black' : 'none',
                  transition: 'background-color 0.2s ease',
                  boxShadow: selectedPixel?.x === x && selectedPixel?.y === y ? '0px 0px 10px rgba(0, 0, 0, 0.3)' : 'none',
                }}
                onClick={() => handlePixelSelect(x, y)}
              />
            ))
          )}
        </div>
      </div>

      {/* Color Picker, Timer, and Place Pixel Button */}
      {showColorPicker && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'row',  // Ensure items are aligned in a row
            flexWrap: 'wrap',
            gap: '10px',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '10px',
            borderRadius: '10px',
            boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Color palette */}
          {colorPalette.map((color) => (
            <div
              key={color}
              onClick={() => setSelectedColor(color)}
              style={{
                width: '30px',
                height: '30px',
                backgroundColor: color,
                borderRadius: '50%',
                border: color === selectedColor ? '2px solid black' : 'none',
                cursor: 'pointer',
                transition: 'border 0.3s ease',
              }}
            />
          ))}

          {/* Timer & Button */}
          {remainingCooldown > 0 && (
            <div style={{ fontSize: '14px', color: 'red', marginLeft: '10px' }}>
              Time left: {remainingCooldown}s
            </div>
          )}

          {/* Tick Button */}
          <button
            onClick={debouncedPlacePixel}
            style={{
              width: '30px',              // Make it the same size as the color swatches
              height: '30px',             // Same height
              padding: '0',
              backgroundColor: selectedColor,  // Button background is the selected color
              color: 'white',
              border: 'none',
              borderRadius: '50%',        // Circle shape
              cursor: 'pointer',
              transition: 'transform 0.3s ease',
              transform: 'scale(1.1)',
            }}
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
}
