  'use client';
  import { useState, useEffect, useRef } from 'react';
  import { supabase } from '../../lib/supabaseClient';
  import { User } from '@supabase/supabase-js';

  const GRID_SIZE = 50;  // Sabit grid boyutu
  const COOLDOWN_TIME = 5 * 60 * 1000;  // 5 dakika

  interface Pixel {
    x: number;
    y: number;
    color: string;
    user_id: string;
  }

  const colorPalette = [
    '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF',
    '#4B0082', '#8A2BE2', '#FF1493', '#FFD700', '#32CD32'
  ];

  function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout;
    return function(...args: any[]) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  export default function PixelGrid() {
    const [grid, setGrid] = useState<string[][]>(Array(GRID_SIZE).fill(Array(GRID_SIZE).fill('#FFFFFF')));
    const [selectedColor, setSelectedColor] = useState('#000000');
    const [lastPlacedTime, setLastPlacedTime] = useState(0);
    const [user, setUser] = useState<User | null>(null);
    const [selectedPixel, setSelectedPixel] = useState<{ x: number, y: number } | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [scale, setScale] = useState(1);  // Zoom seviye durumu
    const [offset, setOffset] = useState({ x: 0, y: 0 }); // Grid kaydırma durumu
    const gridRef = useRef<HTMLDivElement | null>(null);
    const gridContainerRef = useRef<HTMLDivElement | null>(null);
    const isPanning = useRef(false); // Kaydırma işlemi aktif mi?

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

      const intervalId = setInterval(fetchGrid, 1000); // Her saniye grid verilerini yenile

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
        clearInterval(intervalId); // Bileşen unmount olduğunda interval'i temizle
        authListener.subscription.unsubscribe();
        subscription.unsubscribe();
      };
    }, []);

    useEffect(() => {
      // Gridin başlangıçta ortalanmasını sağla
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

      if (now - lastPlacedTime < COOLDOWN_TIME) {
        const remainingTime = Math.ceil((COOLDOWN_TIME - (now - lastPlacedTime)) / 1000);
        alert(`Please wait ${remainingTime} seconds before placing another pixel.`);
        return;
      }

      // Upsert işlemi için onConflict parametresini doğru ayarlayın
      const { data, error } = await supabase
        .from('pixels')
        .upsert(
          { x, y, color: selectedColor, user_id: user.id },
          {
            onConflict: ['x', 'y'],  // Çakışma kontrolü için x ve y sütunlarını kullan
            returning: 'representation' // İsteğe bağlı: ekleme sonrası satırı döndür
          }
        );

      if (error) {
        console.error('Error placing pixel:', error.message || error.details || error);
        alert("There was an error placing the pixel, please try again.");
      } else {
        setLastPlacedTime(now);
        setSelectedPixel(null);
        setShowColorPicker(false);
      }
    };

    const debouncedPlacePixel = debounce(placePixel, 300);

    // Fare ile zoom işlemi
    const handleZoom = (event: React.WheelEvent) => {
      event.preventDefault();
      const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
      setScale((prevScale) => {
        let newScale = prevScale * zoomFactor;
        newScale = Math.max(0.5, Math.min(2, newScale)); // Zoom sınırları
        return newScale;
      });
    };

    // Fare hareketi ile grid kaydırma
    const handleMouseMove = (event: React.MouseEvent) => {
      if (!isPanning.current) return; // Sadece panning aktifken kaydır

      const deltaX = event.movementX;
      const deltaY = event.movementY;

      setOffset((prevOffset) => ({
        x: prevOffset.x + deltaX,
        y: prevOffset.y + deltaY,
      }));
    };

    // Fare hareketi ile piksel seçimi
    const handleMouseHover = (event: React.MouseEvent) => {
      if (selectedPixel) return; // Eğer bir piksel zaten seçiliyse, başka bir piksel seçme

      const container = gridContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const pixelSize = 15 * scale; // Piksel boyutu, ölçekle çarpılır
      const x = Math.floor(mouseX / pixelSize);
      const y = Math.floor(mouseY / pixelSize);

      if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        setSelectedPixel({ x, y });
      }
    };

    // Panning başlatma 
    const startPanning = (event: React.MouseEvent) => {
      isPanning.current = true;
    };

    // Panning durdurma
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
        onMouseMove={(e) => {
          handleMouseMove(e);
          handleMouseHover(e);
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
          cursor: isPanning.current ? 'grabbing' : 'grab', // İmleç durumu
        }}
      >
        <div
          ref={gridContainerRef}
          className="grid-container"
          style={{
            width: `${GRID_SIZE * 15}px`,  // Sabit genişlik
            height: `${GRID_SIZE * 15}px`, // Sabit yükseklik
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, // Kaydırma ve zoom
            transformOrigin: 'center', // Zoom merkezden yapılır
            overflow: 'hidden',
          }}
        >
          <div
            ref={gridRef}
            className="grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_SIZE}, 15px)`, // Piksel boyutları sabit
              gridTemplateRows: `repeat(${GRID_SIZE}, 15px)`,    // Piksel boyutları sabit
              width: '100%',  // Genişlik %100 olarak ayarlandı
              height: '100%', // Yükseklik %100 olarak ayarlandı
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
                    transition: 'background-color 0.2s ease', // Animasyon ekleniyor
                  }}
                  onClick={() => handlePixelSelect(x, y)}
                />
              ))
            )}
          </div>
        </div>

        {selectedPixel && showColorPicker && (
          <div
            style={{
              position: 'absolute',
              bottom: '20px',  // Paletin biraz üstüne yerleştirildi
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'auto',
              backgroundColor: '#fff',
              padding: '20px',
              zIndex: 100,
              borderRadius: '10px',
              boxShadow: '0px 4px 15px rgba(0, 0, 0, 0.15)',
            }}
          >
            <span style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>Select Color:</span>
            <div className="color-palette" style={{ display: 'flex', marginBottom: '15px' }}>
              {colorPalette.map((color) => (
                <div
                  key={color}
                  style={{
                    backgroundColor: color,
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    margin: '5px',
                    cursor: 'pointer',
                    border: selectedColor === color ? '3px solid #000' : 'none',
                    boxShadow: selectedColor === color ? '0px 0px 10px rgba(0, 0, 0, 0.2)' : 'none', // Seçili renk için gölge
                  }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
            <button
              onClick={debouncedPlacePixel}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '5px',
                zIndex: 101,  // Buton z-index'i artırıldı
                fontSize: '16px',
                transition: 'background-color 0.3s ease',
              }}
            >
              Pixeli Yerleştir
            </button>
          </div>
        )}
      </div>
    );
  }
