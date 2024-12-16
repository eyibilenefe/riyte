import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

const GRID_SIZE = 50;  // Fixed grid size
const COOLDOWN_TIME = 1 * 60 * 1000;  // 5 minutes

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
  '#4B0082', '#8A2BE2', '#FF1493', '#FFD700', '#32CD32'
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
    // Center the grid initially
    const initialOffsetX = (window.innerWidth - GRID_SIZE * 15) / 2;
    const initialOffsetY = (window.innerHeight - GRID_SIZE * 15) / 2;
    setOffset({ x: initialOffsetX, y: initialOffsetY });
  }, []);

  const placePixel = async () => {
    if (!selectedPixel || !user) {
      alert('Please select a pixel and sign in to place pixels');
      return;
    }

    const { x, y } = selectedPixel;
    const now = Date.now();

    // Query the last pixel placed or updated by the user
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
      alert(`Please wait ${remainingTime} seconds before placing another pixel.`);
      return;
    }

    // Upsert pixel (with conflict handling)
    const { error: upsertError } = await supabase
    .from('pixels')
    .upsert(
      [
        { x, y, color: selectedColor, user_id: user.id }
      ],
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

  // Handle zoom with mouse wheel and touch events (mobile support)
  const handleZoom = (event: React.WheelEvent | React.TouchEvent) => {
    event.preventDefault();
    let zoomFactor = 1;
    if (event.type === 'wheel') {
      zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    } else if (event.type === 'touchmove') {
      const touch = event.touches[0];
      const touchStart = event.changedTouches[0];
      zoomFactor = touch.clientY < touchStart.clientY ? 1.1 : 0.9;
    }
    setScale((prevScale) => {
      let newScale = prevScale * zoomFactor;
      newScale = Math.max(0.5, Math.min(2, newScale));
      return newScale;
    });
  };

  // Handle grid panning with mouse movement (mouse or touch)
  const handleMouseMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isPanning.current) return;

    const deltaX = 'movementX' in event ? event.movementX : event.changedTouches[0].clientX;
    const deltaY = 'movementY' in event ? event.movementY : event.changedTouches[0].clientY;

    setOffset((prevOffset) => ({
      x: prevOffset.x + deltaX,
      y: prevOffset.y + deltaY,
    }));
  };

  // Handle pixel selection on hover (same for mouse and touch)
  const handleMouseHover = (event: React.MouseEvent | React.TouchEvent) => {
    if (selectedPixel) return;

    const container = gridContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = event instanceof TouchEvent
      ? event.changedTouches[0].clientX - rect.left
      : event.clientX - rect.left;
    const mouseY = event instanceof TouchEvent
      ? event.changedTouches[0].clientY - rect.top
      : event.clientY - rect.top;

    const pixelSize = 15 * scale;
    const x = Math.floor(mouseX / pixelSize);
    const y = Math.floor(mouseY / pixelSize);

    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      setSelectedPixel({ x, y });
    }
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
      onTouchMove={handleZoom} // Added touch support
      onMouseMove={(e) => {
        handleMouseMove(e);
        handleMouseHover(e);
      }}
      onTouchStart={startPanning}  // Added touch support for panning
      onTouchEnd={stopPanning}    // Added touch support for panning
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
      {/* Rest of the component code remains unchanged */}
    </div>
  );
}
