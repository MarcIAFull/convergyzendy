import { RestaurantSettings } from '@/types/public-menu';
import { Tables } from '@/integrations/supabase/types';
import { Clock, MapPin, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MenuHeaderProps {
  restaurant: Tables<'restaurants'>;
  settings: RestaurantSettings;
}

export const MenuHeader = ({ restaurant, settings }: MenuHeaderProps) => {
  const isOpen = restaurant.is_open;
  
  const headerStyle = settings.primary_color ? {
    backgroundColor: settings.primary_color,
    color: '#ffffff'
  } : undefined;
  
  return (
    <div 
      className="border-b border-border/20 sticky top-0 z-40"
      style={headerStyle}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          {settings.logo_url && (
            <img
              src={settings.logo_url}
              alt={restaurant.name}
              className="w-16 h-16 rounded-lg object-cover ring-2 ring-white/20"
            />
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold" style={{ color: headerStyle ? '#ffffff' : undefined }}>
                {restaurant.name}
              </h1>
              <Badge 
                variant={isOpen ? 'default' : 'secondary'}
                style={isOpen && settings.accent_color ? { 
                  backgroundColor: settings.accent_color,
                  color: '#ffffff'
                } : undefined}
              >
                {isOpen ? 'Aberto' : 'Fechado'}
              </Badge>
            </div>
            
            <div 
              className="flex flex-wrap gap-4 text-sm"
              style={headerStyle ? { color: 'rgba(255, 255, 255, 0.9)' } : undefined}
            >
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{restaurant.address}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                <span>{restaurant.phone}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{settings.estimated_prep_time_minutes} min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
