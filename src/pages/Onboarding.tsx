import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Check, Loader2 } from 'lucide-react';
import RestaurantInfoStep from '@/components/onboarding/RestaurantInfoStep';
import MenuSetupStep from '@/components/onboarding/MenuSetupStep';
import WhatsAppSetupStep from '@/components/onboarding/WhatsAppSetupStep';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Step = 'restaurant' | 'menu' | 'whatsapp';

const Onboarding = () => {
  const { user } = useAuth();
  const { fetchRestaurant } = useRestaurantStore();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState<Step>('restaurant');
  const [completedSteps, setCompletedSteps] = useState<Step[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [checkingOrphanRestaurants, setCheckingOrphanRestaurants] = useState(true);
  const [orphanRestaurant, setOrphanRestaurant] = useState<any>(null);

  // Check for orphan restaurants on mount
  useEffect(() => {
    checkForOrphanRestaurants();
  }, []);

  const checkForOrphanRestaurants = async () => {
    if (!user) return;

    try {
      // Check if user already has a restaurant
      const { data: existingOwnership } = await supabase
        .from('restaurant_owners')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingOwnership) {
        // User already has a restaurant, redirect to dashboard
        await fetchRestaurant();
        navigate('/');
        return;
      }

      // Check for orphan restaurants (restaurants without owners)
      const { data: allRestaurants } = await supabase
        .from('restaurants')
        .select('id, name, phone, address')
        .limit(10);

      if (allRestaurants && allRestaurants.length > 0) {
        // Check which ones don't have owners
        const { data: allOwnerships } = await supabase
          .from('restaurant_owners')
          .select('restaurant_id');

        const ownedRestaurantIds = new Set(allOwnerships?.map(o => o.restaurant_id) || []);
        const orphans = allRestaurants.filter(r => !ownedRestaurantIds.has(r.id));

        if (orphans.length > 0) {
          // Found orphan restaurant, offer to associate
          setOrphanRestaurant(orphans[0]);
        }
      }
    } catch (error) {
      console.error('Error checking for orphan restaurants:', error);
    } finally {
      setCheckingOrphanRestaurants(false);
    }
  };

  const handleClaimOrphanRestaurant = async () => {
    if (!user || !orphanRestaurant) return;

    try {
      setCheckingOrphanRestaurants(true);

      // Create owner association
      const { error } = await supabase
        .from('restaurant_owners')
        .insert({
          user_id: user.id,
          restaurant_id: orphanRestaurant.id,
          role: 'owner',
        });

      if (error) throw error;

      toast.success(`Restaurante "${orphanRestaurant.name}" associado com sucesso!`);
      await fetchRestaurant();
      navigate('/');
    } catch (error: any) {
      console.error('Error claiming orphan restaurant:', error);
      toast.error(error.message || 'Erro ao associar restaurante');
      setCheckingOrphanRestaurants(false);
    }
  };

  const steps = [
    { id: 'restaurant' as Step, title: 'Restaurante', required: true },
    { id: 'menu' as Step, title: 'Cardápio', required: false },
    { id: 'whatsapp' as Step, title: 'WhatsApp', required: false },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((completedSteps.length + 1) / steps.length) * 100;

  const handleRestaurantComplete = async (data: {
    name: string;
    phone: string;
    address: string;
    deliveryFee: number;
    openingHours?: any;
  }) => {
    if (!user) {
      toast.error('Você precisa estar autenticado');
      navigate('/login');
      return;
    }

    try {
      // Create restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: data.name,
          phone: data.phone,
          address: data.address,
          delivery_fee: data.deliveryFee,
          opening_hours: data.openingHours,
          is_open: true,
        })
        .select()
        .single();

      if (restaurantError) throw restaurantError;

      // Create restaurant owner mapping
      const { error: ownerError } = await supabase
        .from('restaurant_owners')
        .insert({
          user_id: user.id,
          restaurant_id: restaurant.id,
          role: 'owner',
        });

      if (ownerError) throw ownerError;

      setRestaurantId(restaurant.id);
      setCompletedSteps([...completedSteps, 'restaurant']);
      setCurrentStep('menu');
      
      toast.success('Restaurante criado com sucesso!');
    } catch (error: any) {
      console.error('Restaurant creation error:', error);
      toast.error(error.message || 'Erro ao criar restaurante');
      throw error;
    }
  };

  const handleMenuComplete = async (templateId?: string) => {
    if (!restaurantId) return;

    try {
      if (templateId) {
        // Apply menu template
        await applyMenuTemplate(restaurantId, templateId);
        toast.success('Template de cardápio aplicado!');
      } else {
        toast.success('Você pode adicionar produtos depois!');
      }

      setCompletedSteps([...completedSteps, 'menu']);
      setCurrentStep('whatsapp');
    } catch (error: any) {
      console.error('Menu setup error:', error);
      toast.error(error.message || 'Erro ao configurar cardápio');
      throw error;
    }
  };

  const handleWhatsAppComplete = () => {
    setCompletedSteps([...completedSteps, 'whatsapp']);
    finishOnboarding();
  };

  const handleSkipStep = () => {
    if (currentStep === 'menu') {
      setCurrentStep('whatsapp');
    } else if (currentStep === 'whatsapp') {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    await fetchRestaurant();
    toast.success('Configuração concluída! Bem-vindo ao Zendy! 🎉');
    navigate('/');
  };

  const applyMenuTemplate = async (restaurantId: string, templateId: string) => {
    // Simple hardcoded templates for MVP
    const templates: Record<string, { categories: { name: string; products: { name: string; price: number; description: string }[] }[] }> = {
      pizzeria: {
        categories: [
          {
            name: 'Pizzas',
            products: [
              { name: 'Pizza Margherita', price: 35.00, description: 'Molho de tomate, mussarela e manjericão' },
              { name: 'Pizza Calabresa', price: 38.00, description: 'Molho de tomate, mussarela e calabresa' },
              { name: 'Pizza Portuguesa', price: 42.00, description: 'Presunto, ovos, cebola, azeitona e ervilha' },
            ],
          },
          {
            name: 'Bebidas',
            products: [
              { name: 'Refrigerante 2L', price: 8.00, description: 'Coca-Cola, Guaraná ou Fanta' },
              { name: 'Suco Natural', price: 10.00, description: 'Laranja, limão ou abacaxi' },
            ],
          },
        ],
      },
      hamburger: {
        categories: [
          {
            name: 'Hambúrgueres',
            products: [
              { name: 'Classic Burger', price: 28.00, description: 'Pão, hambúrguer, queijo, alface e tomate' },
              { name: 'Bacon Burger', price: 32.00, description: 'Pão, hambúrguer, queijo, bacon e cebola' },
              { name: 'Double Burger', price: 38.00, description: 'Dois hambúrgueres, queijo e molho especial' },
            ],
          },
          {
            name: 'Acompanhamentos',
            products: [
              { name: 'Batata Frita', price: 12.00, description: 'Batata frita crocante' },
              { name: 'Onion Rings', price: 15.00, description: 'Anéis de cebola empanados' },
            ],
          },
        ],
      },
    };

    const template = templates[templateId];
    if (!template) return;

    // Create categories and products
    for (const categoryData of template.categories) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .insert({
          name: categoryData.name,
          restaurant_id: restaurantId,
        })
        .select()
        .single();

      if (categoryError) throw categoryError;

      // Create products for this category
      const productsToInsert = categoryData.products.map(product => ({
        name: product.name,
        price: product.price,
        description: product.description,
        category_id: category.id,
        restaurant_id: restaurantId,
        is_available: true,
      }));

      const { error: productsError } = await supabase
        .from('products')
        .insert(productsToInsert);

      if (productsError) throw productsError;
    }
  };

  // Show loading while checking for orphan restaurants
  if (checkingOrphanRestaurants) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div>
                <h3 className="text-lg font-semibold">Verificando configuração...</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Aguarde enquanto verificamos seu perfil
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show orphan restaurant claim option
  if (orphanRestaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Restaurante Encontrado!</CardTitle>
            <CardDescription>
              Encontramos um restaurante já cadastrado no sistema. Gostaria de gerenciá-lo?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-base">{orphanRestaurant.name}</p>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Telefone:</span> {orphanRestaurant.phone}</p>
                    <p><span className="text-muted-foreground">Endereço:</span> {orphanRestaurant.address}</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setOrphanRestaurant(null);
                  setCheckingOrphanRestaurants(false);
                }}
                className="flex-1"
              >
                Criar Novo Restaurante
              </Button>
              <Button
                onClick={handleClaimOrphanRestaurant}
                className="flex-1"
              >
                Usar Este Restaurante
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>Configuração do Zendy</CardTitle>
              <CardDescription>
                Vamos configurar seu restaurante em {steps.length} etapas simples
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                    completedSteps.includes(step.id)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : currentStep === step.id
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {completedSteps.includes(step.id) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            {steps.map((step) => (
              <span
                key={step.id}
                className={currentStep === step.id ? 'text-foreground font-medium' : ''}
              >
                {step.title}
                {!step.required && ' (opcional)'}
              </span>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {currentStep === 'restaurant' && (
            <RestaurantInfoStep onComplete={handleRestaurantComplete} />
          )}

          {currentStep === 'menu' && (
            <MenuSetupStep
              onComplete={handleMenuComplete}
              onSkip={handleSkipStep}
            />
          )}

          {currentStep === 'whatsapp' && (
            <WhatsAppSetupStep
              onComplete={handleWhatsAppComplete}
              onSkip={handleSkipStep}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
