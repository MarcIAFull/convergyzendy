import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, Upload, FileText, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface RestaurantForm {
  name: string;
  phone: string;
  address: string;
  delivery_fee: number;
}

interface ExtractedMenu {
  categories: Array<{
    name: string;
    sort_order: number;
    products: Array<{
      name: string;
      description: string;
      price: number;
      is_featured: boolean;
      addons?: Array<{
        name: string;
        price: number;
      }>;
    }>;
  }>;
  ai_settings?: {
    greeting_message?: string;
    closing_message?: string;
    business_rules?: string;
    faq_responses?: string;
    special_offers_info?: string;
    custom_instructions?: string;
  };
}

export default function ImportRestaurant() {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedMenu, setExtractedMenu] = useState<ExtractedMenu | null>(null);
  
  const [form, setForm] = useState<RestaurantForm>({
    name: '',
    phone: '',
    address: '',
    delivery_fee: 3.00,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createRestaurant, restaurant } = useRestaurantStore();
  const navigate = useNavigate();

  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      const pdfType = 'application/pdf';
      
      if (imageTypes.includes(file.type)) {
        setSelectedFile(file);
        setFileType('image');
        setExtractedMenu(null);
      } else if (file.type === pdfType) {
        setSelectedFile(file);
        setFileType('pdf');
        setExtractedMenu(null);
      } else {
        toast.error('Formato inválido. Use PNG, JPG, WEBP ou PDF.');
        return;
      }
    }
  };

  const extractMenuFromImage = async () => {
    if (!selectedFile) {
      toast.error('Selecione uma imagem primeiro');
      return;
    }

    setExtracting(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(selectedFile);
      const base64Content = await base64Promise;

      const { data, error: fnError } = await supabase.functions.invoke('extract-menu-from-document', {
        body: {
          document_base64: base64Content,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          restaurant_name: form.name || 'Restaurante',
        },
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error || 'Falha ao extrair menu');

      setExtractedMenu(data.menu);
      toast.success('Menu extraído com sucesso!');
    } catch (err: any) {
      console.error('Erro ao extrair menu:', err);
      setError(err.message || 'Erro ao extrair menu da imagem');
      toast.error('Erro ao extrair menu da imagem');
    } finally {
      setExtracting(false);
    }
  };

  const importRestaurant = async () => {
    if (!form.name || !form.phone || !form.address) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!extractedMenu) {
      toast.error('Extraia o menu da imagem primeiro');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    try {
      setStatus('Criando restaurante...');
      await createRestaurant({
        name: form.name,
        phone: form.phone,
        address: form.address,
        delivery_fee: form.delivery_fee,
        is_open: true,
        latitude: null,
        longitude: null,
        opening_hours: {
          monday: { open: '09:00', close: '22:00' },
          tuesday: { open: '09:00', close: '22:00' },
          wednesday: { open: '09:00', close: '22:00' },
          thursday: { open: '09:00', close: '22:00' },
          friday: { open: '09:00', close: '22:00' },
          saturday: { open: '09:00', close: '22:00' },
          sunday: { open: '09:00', close: '22:00' },
        },
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!restaurant) throw new Error('Falha ao criar restaurante');
      const restaurantId = restaurant.id;
      setProgress(10);

      setStatus('Configurando menu público...');
      const slug = form.name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      await supabase.from('restaurant_settings').insert({
        restaurant_id: restaurantId,
        slug: slug,
        menu_enabled: true,
        checkout_web_enabled: true,
        checkout_whatsapp_enabled: true,
      });
      setProgress(20);

      setStatus('Criando categorias...');
      const categoriesData = extractedMenu.categories.map((cat, index) => ({
        name: cat.name,
        sort_order: cat.sort_order || (index + 1) * 10,
        restaurant_id: restaurantId,
      }));

      const { data: createdCategories } = await supabase
        .from('categories')
        .insert(categoriesData)
        .select();

      if (!createdCategories) throw new Error('Falha ao criar categorias');
      setProgress(40);

      setStatus('Criando produtos...');
      const categoryMap = Object.fromEntries(createdCategories.map(c => [c.name, c.id]));
      
      const allProducts: any[] = [];
      const productAddonsMap: Map<string, Array<{ name: string; price: number }>> = new Map();

      extractedMenu.categories.forEach(cat => {
        cat.products.forEach(prod => {
          const productKey = `${cat.name}:${prod.name}`;
          allProducts.push({
            category_id: categoryMap[cat.name],
            restaurant_id: restaurantId,
            name: prod.name,
            description: prod.description,
            price: prod.price,
            is_featured: prod.is_featured || false,
            is_available: true,
          });
          if (prod.addons && prod.addons.length > 0) {
            productAddonsMap.set(productKey, prod.addons);
          }
        });
      });

      const { data: createdProducts } = await supabase
        .from('products')
        .insert(allProducts)
        .select();

      if (!createdProducts) throw new Error('Falha ao criar produtos');
      setProgress(60);

      setStatus('Criando addons...');
      const addonsToInsert: any[] = [];
      
      createdProducts.forEach(prod => {
        const category = createdCategories.find(c => c.id === prod.category_id);
        if (category) {
          const productKey = `${category.name}:${prod.name}`;
          const addons = productAddonsMap.get(productKey);
          if (addons) {
            addons.forEach(addon => {
              addonsToInsert.push({
                product_id: prod.id,
                name: addon.name,
                price: addon.price,
              });
            });
          }
        }
      });

      if (addonsToInsert.length > 0) {
        await supabase.from('addons').insert(addonsToInsert);
      }
      setProgress(80);

      setStatus('Configurando IA...');
      await supabase.from('restaurant_ai_settings').insert({
        restaurant_id: restaurantId,
        tone: 'friendly',
        greeting_message: extractedMenu.ai_settings?.greeting_message || 
          `Olá! 👋 Bem-vindo ao ${form.name}! Como posso ajudar?`,
        closing_message: extractedMenu.ai_settings?.closing_message || 
          'Obrigado pela preferência! Bom apetite e até à próxima!',
        upsell_aggressiveness: 'medium',
        max_additional_questions_before_checkout: 2,
        language: 'pt-PT',
        business_rules: extractedMenu.ai_settings?.business_rules || '',
        faq_responses: extractedMenu.ai_settings?.faq_responses || '',
        special_offers_info: extractedMenu.ai_settings?.special_offers_info || '',
        custom_instructions: extractedMenu.ai_settings?.custom_instructions || '',
      });
      setProgress(100);

      setStatus('Importação concluída com sucesso! 🎉');
      setSuccess(true);

      setTimeout(() => {
        navigate('/menu-management');
      }, 2000);
    } catch (err: any) {
      console.error('Erro na importação:', err);
      setError(err.message || 'Erro desconhecido');
      setLoading(false);
    }
  };

  const isFormValid = form.name && form.phone && form.address && extractedMenu;

  return (
    <div className="container max-w-3xl mx-auto py-10 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Store className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Importar Restaurante</CardTitle>
              <CardDescription>
                Preencha as informações básicas e faça upload de uma imagem do menu
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!loading && !success && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Restaurante *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Pizzaria Da Família"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    placeholder="Ex: 915817565"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Endereço *</Label>
                  <Input
                    id="address"
                    placeholder="Ex: Rua Principal 123, Lisboa"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery_fee">Taxa de Entrega (€)</Label>
                  <Input
                    id="delivery_fee"
                    type="number"
                    step="0.50"
                    min="0"
                    value={form.delivery_fee}
                    onChange={(e) => setForm({ ...form, delivery_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div>
                  <Label>Documento do Menu *</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Faça upload de uma imagem (PNG, JPG, WEBP) ou PDF do cardápio
                  </p>
                </div>
                <div 
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {fileType === 'pdf' ? 'PDF' : 'Imagem'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Clique para selecionar imagem ou PDF do menu
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Formatos aceites: PNG, JPG, WEBP, PDF
                      </p>
                    </div>
                  )}
                </div>

                {selectedFile && !extractedMenu && (
                  <Button 
                    onClick={extractMenuFromImage} 
                    disabled={extracting}
                    className="w-full"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Extraindo menu com IA...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Extrair Menu do {fileType === 'pdf' ? 'PDF' : 'Documento'}
                      </>
                    )}
                  </Button>
                )}

                {extractedMenu && (
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      Menu extraído: {extractedMenu.categories.length} categorias, {' '}
                      {extractedMenu.categories.reduce((acc, cat) => acc + cat.products.length, 0)} produtos
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="border-t pt-6">
                <Button 
                  onClick={importRestaurant} 
                  disabled={!isFormValid}
                  className="w-full"
                  size="lg"
                >
                  Criar Restaurante e Importar Menu
                </Button>
              </div>
            </>
          )}

          {loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">{status}</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground text-center">
                {progress}% concluído
              </p>
            </div>
          )}

          {success && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                {status}
                <br />
                <span className="text-xs">Redirecionando para gestão de menu...</span>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Erro: {error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
