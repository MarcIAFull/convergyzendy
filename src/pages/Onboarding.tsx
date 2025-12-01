import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useUserRestaurantsStore } from '@/stores/userRestaurantsStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase, ensureValidSession, verifyAuthUid, forceTokenReload } from '@/integrations/supabase/client';
import { Check, Loader2, LogOut } from 'lucide-react';
import RestaurantInfoStep from '@/components/onboarding/RestaurantInfoStep';
import MenuSetupStep from '@/components/onboarding/MenuSetupStep';
import WhatsAppSetupStep from '@/components/onboarding/WhatsAppSetupStep';

type Step = 'restaurant' | 'menu' | 'whatsapp';

const Onboarding = () => {
  const { user, signOut } = useAuth();
  const { fetchRestaurant, setRestaurant } = useRestaurantStore();
  const { addRestaurant } = useUserRestaurantsStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isCreateMode = searchParams.get('mode') === 'create';
  
  const [currentStep, setCurrentStep] = useState<Step>('restaurant');
  const [completedSteps, setCompletedSteps] = useState<Step[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

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
      console.log('[Onboarding] 🚀 Iniciando criação de restaurante via RPC...');
      
      // Validar que temos um usuário autenticado
      if (!user?.id) {
        console.error('[Onboarding] ❌ Usuário não autenticado');
        toast.error('Você precisa estar autenticado. Faça login novamente.');
        navigate('/login');
        return;
      }

      // Chamar função RPC que cria restaurante + owner em uma transação atômica
      console.log('[Onboarding] 📞 Chamando create_restaurant_with_owner...');
      const { data: result, error: rpcError } = await supabase
        .rpc('create_restaurant_with_owner', {
          p_name: data.name,
          p_phone: data.phone,
          p_address: data.address,
          p_delivery_fee: data.deliveryFee,
          p_opening_hours: data.openingHours || null
        });

      if (rpcError) {
        console.error('[Onboarding] ❌ Erro ao criar restaurante:', {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
        });
        toast.error(`Erro ao criar restaurante: ${rpcError.message}`);
        return;
      }

      // Type guard para o resultado
      const restaurantResult = result as { id: string; user_id: string; name: string; success: boolean } | null;
      
      if (!restaurantResult || !restaurantResult.id) {
        console.error('[Onboarding] ❌ Resultado inválido da RPC:', result);
        toast.error('Erro ao criar restaurante. Tente novamente.');
        return;
      }

      console.log('[Onboarding] ✅ Restaurante criado via RPC:', restaurantResult);

      setRestaurantId(restaurantResult.id);
      setCompletedSteps([...completedSteps, 'restaurant']);
      setCurrentStep('menu');
      
      toast.success('Restaurante criado com sucesso!');
    } catch (error: any) {
      console.error('[Onboarding] 💥 Erro fatal:', error);
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
    console.log('[Onboarding] Finishing onboarding, fetching restaurant...');
    
    // If we have a restaurantId, fetch the newly created restaurant
    if (restaurantId) {
      const { data: newRestaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();
      
      if (newRestaurant) {
        // Add to restaurants list
        addRestaurant(newRestaurant as any);
        // Set as active restaurant
        setRestaurant(newRestaurant as any);
      }
    } else {
      await fetchRestaurant();
    }
    
    toast.success('Configuração concluída! Bem-vindo ao Zendy! 🎉');
    navigate('/dashboard');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Você saiu com sucesso');
      navigate('/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
      toast.error('Erro ao sair');
    }
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
            <Button
              onClick={handleSignOut}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
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
          <Progress value={progress} className="h-2 mt-4" />
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
