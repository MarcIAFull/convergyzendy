import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUserRestaurantsStore } from "@/stores/userRestaurantsStore";
import { useRestaurantStore } from "@/stores/restaurantStore";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function RestaurantSwitcher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  
  const { restaurants } = useUserRestaurantsStore();
  const { restaurant: currentRestaurant, setRestaurant } = useRestaurantStore();

  const handleSelect = (restaurantId: string) => {
    const selected = restaurants.find(r => r.id === restaurantId);
    if (selected) {
      setRestaurant(selected as any);
      setOpen(false);
    }
  };

  const handleCreateNew = () => {
    navigate('/onboarding');
    setOpen(false);
  };

  if (restaurants.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Selecionar restaurante"
          className="w-[200px] justify-between"
        >
          <span className="truncate">
            {currentRestaurant?.name || "Selecione..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Buscar restaurante..." />
          <CommandList>
            <CommandEmpty>Nenhum restaurante encontrado.</CommandEmpty>
            <CommandGroup heading="Seus Restaurantes">
              {restaurants.map((restaurant) => (
                <CommandItem
                  key={restaurant.id}
                  onSelect={() => handleSelect(restaurant.id)}
                  className="text-sm"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentRestaurant?.id === restaurant.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {restaurant.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleCreateNew} className="text-sm">
                <Plus className="mr-2 h-4 w-4" />
                Criar novo restaurante
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}