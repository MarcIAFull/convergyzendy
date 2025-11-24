import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface DeliveryZone {
  id: string;
  name: string;
  coordinates: any;
  fee_amount: number;
  is_active: boolean;
}

interface DeliveryZoneMapProps {
  center: [number, number];
  zones?: DeliveryZone[];
  deliveryAddress?: { lat: number; lng: number };
  height?: string;
  editable?: boolean;
  onZoneDrawn?: (coordinates: any) => void;
}

export const DeliveryZoneMap = ({
  center,
  zones = [],
  deliveryAddress,
  height = '400px',
  editable = false,
  onZoneDrawn
}: DeliveryZoneMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map
    const map = L.map(containerRef.current).setView(center, 13);
    mapRef.current = map;

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add restaurant marker
    L.marker(center, {
      icon: L.icon({
        iconUrl: icon,
        shadowUrl: iconShadow,
        iconSize: [32, 52],
        iconAnchor: [16, 52]
      })
    }).addTo(map).bindPopup('Restaurante');

    // Add delivery address marker if provided
    if (deliveryAddress) {
      L.marker([deliveryAddress.lat, deliveryAddress.lng], {
        icon: L.icon({
          iconUrl: icon,
          shadowUrl: iconShadow,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          className: 'delivery-marker'
        })
      }).addTo(map).bindPopup('Endereço de Entrega');
    }

    // Draw zones
    zones.forEach(zone => {
      const coords = zone.coordinates;
      
      if (coords.type === 'circle' && coords.center && coords.radius) {
        const circle = L.circle([coords.center.lat, coords.center.lng], {
          radius: coords.radius * 1000, // Convert km to meters
          color: zone.is_active ? '#4ECDC4' : '#ccc',
          fillColor: zone.is_active ? '#4ECDC4' : '#ccc',
          fillOpacity: 0.2
        }).addTo(map);

        circle.bindPopup(`
          <strong>${zone.name}</strong><br/>
          Taxa: €${zone.fee_amount.toFixed(2)}<br/>
          Raio: ${coords.radius}km
        `);
      }

      if (coords.type === 'polygon' && coords.points && Array.isArray(coords.points)) {
        const latLngs: [number, number][] = coords.points.map((p: any) => [p.lat, p.lng]);
        
        const polygon = L.polygon(latLngs, {
          color: zone.is_active ? '#FF6B35' : '#ccc',
          fillColor: zone.is_active ? '#FF6B35' : '#ccc',
          fillOpacity: 0.2
        }).addTo(map);

        polygon.bindPopup(`
          <strong>${zone.name}</strong><br/>
          Taxa: €${zone.fee_amount.toFixed(2)}
        `);
      }
    });

    // Cleanup
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zones, deliveryAddress]);

  return (
    <div 
      ref={containerRef} 
      style={{ height, width: '100%', zIndex: 1 }} 
      className="rounded-lg border border-border"
    />
  );
};
