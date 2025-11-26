import { useState } from 'react';
import { GoogleMap, useJsApiLoader, Circle, Marker, InfoWindow, Polygon } from '@react-google-maps/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

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
  apiKey: string;
}

export const DeliveryZoneMap = ({
  center,
  zones = [],
  deliveryAddress,
  height = '400px',
  apiKey
}: DeliveryZoneMapProps) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  
  const mapCenter = { lat: center[0], lng: center[1] };

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar o mapa. Verifique se a API Key está configurada corretamente.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isLoaded) {
    return <Skeleton style={{ width: '100%', height }} className="rounded-lg" />;
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height }}
      center={mapCenter}
      zoom={13}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        zoomControl: true,
      }}
    >
      {/* Restaurant Marker */}
      <Marker
        position={mapCenter}
        icon={{
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new google.maps.Size(40, 40),
        }}
        title="Restaurante"
      />

      {/* Delivery Address Marker */}
      {deliveryAddress && (
        <Marker
          position={{ lat: deliveryAddress.lat, lng: deliveryAddress.lng }}
          icon={{
            url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new google.maps.Size(32, 32),
          }}
          title="Endereço de Entrega"
        />
      )}

      {/* Delivery Zones */}
      {zones.map((zone) => {
        const coords = zone.coordinates;
        
        // Circle zones
        if (coords.type === 'circle' && coords.center && coords.radius) {
          return (
            <Circle
              key={zone.id}
              center={{ lat: coords.center.lat, lng: coords.center.lng }}
              radius={coords.radius * 1000} // km to meters
              options={{
                strokeColor: zone.is_active ? '#4ECDC4' : '#ccc',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: zone.is_active ? '#4ECDC4' : '#ccc',
                fillOpacity: 0.2,
                clickable: true,
              }}
              onClick={() => setSelectedZone(zone)}
            />
          );
        }

        // Polygon zones
        if (coords.type === 'polygon' && coords.points) {
          const paths = coords.points.map((p: any) => ({ lat: p.lat, lng: p.lng }));
          return (
            <Polygon
              key={zone.id}
              paths={paths}
              options={{
                strokeColor: zone.is_active ? '#FF6B35' : '#ccc',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: zone.is_active ? '#FF6B35' : '#ccc',
                fillOpacity: 0.2,
                clickable: true,
              }}
              onClick={() => setSelectedZone(zone)}
            />
          );
        }
        
        return null;
      })}

      {/* InfoWindow for selected zone */}
      {selectedZone && (
        <InfoWindow
          position={{
            lat: selectedZone.coordinates.center?.lat || center[0],
            lng: selectedZone.coordinates.center?.lng || center[1],
          }}
          onCloseClick={() => setSelectedZone(null)}
        >
          <div className="p-2">
            <strong className="text-sm font-semibold">{selectedZone.name}</strong><br />
            <span className="text-xs text-muted-foreground">Taxa: €{selectedZone.fee_amount.toFixed(2)}</span><br />
            {selectedZone.coordinates.radius && (
              <span className="text-xs text-muted-foreground">Raio: {selectedZone.coordinates.radius}km</span>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};
