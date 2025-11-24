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
  
  return (
    <div className="bg-card border-b border-border sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          {settings.logo_url && (
            <img
              src={settings.logo_url}
              alt={restaurant.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{restaurant.name}</h1>
              <Badge variant={isOpen ? 'default' : 'secondary'}>
                {isOpen ? 'Aberto' : 'Fechado'}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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
