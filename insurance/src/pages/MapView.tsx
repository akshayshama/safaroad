import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Mock pothole data for demonstration
const mockPotholes = [
  { id: '1', lat: 19.076, lng: 72.8777, severity: 4, road: 'MG Road' },
  { id: '2', lat: 19.078, lng: 72.879, severity: 3, road: 'Nehru Road' },
  { id: '3', lat: 19.072, lng: 72.875, severity: 5, road: ' Linking Road' },
  { id: '4', lat: 19.080, lng: 72.882, severity: 2, road: 'SV Road' },
  { id: '5', lat: 19.074, lng: 72.878, severity: 4, road: 'Juhu Beach Road' },
]

const severityColors: Record<number, string> = {
  1: '#4ade80',
  2: '#a3e635',
  3: '#facc15',
  4: '#f97316',
  5: '#ef4444',
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [selectedPothole, setSelectedPothole] = useState<typeof mockPotholes[0] | null>(null)
  const [filter, setFilter] = useState<number>(0)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [72.8777, 19.0760], // Mumbai
      zoom: 13,
    })

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.current.on('load', () => {
      // Add pothole markers
      mockPotholes.forEach((pothole) => {
        const el = document.createElement('div')
        el.className = 'pothole-marker'
        el.style.cssText = `
          width: 32px;
          height: 32px;
          background-color: ${severityColors[pothole.severity]};
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transition: transform 0.2s;
        `
        el.innerHTML = `<span style="font-size: 16px;">⚠️</span>`

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.2)'
        })
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)'
        })
        el.addEventListener('click', () => {
          setSelectedPothole(pothole)
        })

        new maplibregl.Marker({ element: el })
          .setLngLat([pothole.lng, pothole.lat])
          .addTo(map.current!)
      })
    })

    return () => {
      map.current?.remove()
    }
  }, [])

  const filteredPotholes = filter 
    ? mockPotholes.filter(p => p.severity === filter)
    : mockPotholes

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between bg-surface rounded-xl p-4 border border-surface-light">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400">Filter by severity:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter(0)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                filter === 0 
                  ? 'bg-primary text-white' 
                  : 'bg-surface-light text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            {[1, 2, 3, 4, 5].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center ${
                  filter === sev 
                    ? 'text-white' 
                    : 'bg-surface-light text-gray-400 hover:text-white'
                }`}
                style={{ 
                  backgroundColor: filter === sev ? severityColors[sev] : undefined 
                }}
              >
                <span 
                  className="w-2 h-2 rounded-full mr-1.5" 
                  style={{ backgroundColor: severityColors[sev] }}
                />
                {sev}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {filteredPotholes.length} potholes on map
        </div>
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-surface-light">
        <div ref={mapContainer} className="h-[500px]" />

        {/* Selected Pothole Info */}
        {selectedPothole && (
          <div className="absolute bottom-4 left-4 right-4 bg-surface/95 backdrop-blur-lg rounded-xl p-4 border border-surface-light">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span 
                    className="px-2 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: severityColors[selectedPothole.severity] }}
                  >
                    Severity {selectedPothole.severity}
                  </span>
                  <span className="text-xs text-gray-500">ID: #{selectedPothole.id}</span>
                </div>
                <h3 className="font-semibold">{selectedPothole.road}</h3>
                <p className="text-sm text-gray-400 font-mono mt-1">
                  {selectedPothole.lat.toFixed(6)}, {selectedPothole.lng.toFixed(6)}
                </p>
              </div>
              <button
                onClick={() => setSelectedPothole(null)}
                className="text-gray-500 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            <div className="flex space-x-3 mt-4">
              <button className="flex-1 bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary-light transition">
                View Details
              </button>
              <button className="px-4 py-2 bg-surface-light rounded-lg font-medium hover:bg-gray-700 transition">
                Navigate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-surface rounded-xl p-4 border border-surface-light">
        <h4 className="text-sm font-medium mb-3">Severity Legend</h4>
        <div className="flex flex-wrap gap-4">
          {Object.entries(severityColors).map(([sev, color]) => (
            <div key={sev} className="flex items-center text-sm">
              <div 
                className="w-4 h-4 rounded-full mr-2" 
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-400">
                {sev === '1' ? 'Minor' : sev === '2' ? 'Low' : sev === '3' ? 'Moderate' : sev === '4' ? 'High' : 'Critical'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
