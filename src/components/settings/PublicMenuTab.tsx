import { useEffect, useState } from 'react';
import { usePublicMenuSettingsStore } from '@/stores/publicMenuSettingsStore';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, ExternalLink, Upload, Check, X, Globe } from 'lucide-react';

export function PublicMenuTab() {
  const { restaurant } = useRestaurantStore();
  const { settings, loading, fetchSettings, createSettings, updateSettings, uploadImage, checkSlugAvailability } = usePublicMenuSettingsStore();
  
  const [formData, setFormData] = useState({
    menu_enabled: false,
    slug: '',
    logo_url: '',
    banner_url: '',
    primary_color: '#3b82f6',
    accent_color: '#10b981',
    min_order_amount: 10,
    max_delivery_distance_km: 10,
    estimated_prep_time_minutes: 30,
    checkout_whatsapp_enabled: true,
    checkout_web_enabled: false,
    meta_title: '',
    meta_description: '',
    meta_keywords: [] as string[],
    instagram_url: '',
    facebook_url: ''
  });

  const [slugValidation, setSlugValidation] = useState<{ checking: boolean; available: boolean | null; message: string }>({
    checking: false,
    available: null,
    message: ''
  });

  const [uploading, setUploading] = useState<{ logo: boolean; banner: boolean }>({
    logo: false,
    banner: false
  });

  const [newKeyword, setNewKeyword] = useState('');

  // Debounce slug validation
  useEffect(() => {
    if (!formData.slug || !restaurant) return;
    
    const timer = setTimeout(() => {
      validateSlug(formData.slug);
    }, 800);
    
    return () => clearTimeout(timer);
  }, [formData.slug, restaurant]);

  // Reset form when restaurant changes and fetch new settings
  useEffect(() => {
    if (restaurant?.id) {
      // Reset form to defaults when restaurant changes
      setFormData({
        menu_enabled: false,
        slug: '',
        logo_url: '',
        banner_url: '',
        primary_color: '#3b82f6',
        accent_color: '#10b981',
        min_order_amount: 10,
        max_delivery_distance_km: 10,
        estimated_prep_time_minutes: 30,
        checkout_whatsapp_enabled: true,
        checkout_web_enabled: false,
        meta_title: '',
        meta_description: '',
        meta_keywords: [],
        instagram_url: '',
        facebook_url: ''
      });
      setSlugValidation({ checking: false, available: null, message: '' });
      fetchSettings(restaurant.id);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    if (settings) {
      setFormData({
        menu_enabled: settings.menu_enabled ?? false,
        slug: settings.slug || '',
        logo_url: settings.logo_url || '',
        banner_url: settings.banner_url || '',
        primary_color: settings.primary_color || '#3b82f6',
        accent_color: settings.accent_color || '#10b981',
        min_order_amount: settings.min_order_amount || 10,
        max_delivery_distance_km: settings.max_delivery_distance_km || 10,
        estimated_prep_time_minutes: settings.estimated_prep_time_minutes || 30,
        checkout_whatsapp_enabled: settings.checkout_whatsapp_enabled ?? true,
        checkout_web_enabled: settings.checkout_web_enabled ?? false,
        meta_title: settings.meta_title || '',
        meta_description: settings.meta_description || '',
        meta_keywords: settings.meta_keywords || [],
        instagram_url: settings.instagram_url || '',
        facebook_url: settings.facebook_url || ''
      });
    }
  }, [settings]);

  const validateSlug = async (slug: string) => {
    if (!slug || !restaurant) return;

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      setSlugValidation({
        checking: false,
        available: false,
        message: 'Slug inválido. Use apenas letras minúsculas, números e hífens.'
      });
      return;
    }

    setSlugValidation({ checking: true, available: null, message: 'Verificando...' });

    try {
      const result = await checkSlugAvailability(slug, restaurant.id);
      setSlugValidation({
        checking: false,
        available: result.available,
        message: result.available 
          ? '✓ Slug disponível' 
          : `✗ Slug já em uso. ${result.suggestion ? `Sugestão: ${result.suggestion}` : ''}`
      });
    } catch (error) {
      setSlugValidation({
        checking: false,
        available: null,
        message: 'Erro ao verificar disponibilidade'
      });
    }
  };

  const handleSlugChange = (value: string) => {
    const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, slug: formatted });
  };

  const handleImageUpload = async (file: File, type: 'logo' | 'banner') => {
    if (!restaurant) return;

    // Validação de tamanho
    const maxSize = type === 'logo' ? 500 * 1024 : 2 * 1024 * 1024; // 500KB para logo, 2MB para banner
    if (file.size > maxSize) {
      toast.error(`Imagem muito grande. Máximo: ${type === 'logo' ? '500KB' : '2MB'}`);
      return;
    }

    setUploading({ ...uploading, [type]: true });

    try {
      const url = await uploadImage(file, restaurant.id, type);
      setFormData({ ...formData, [`${type}_url`]: url });
      toast.success(`${type === 'logo' ? 'Logo' : 'Banner'} enviado com sucesso!`);
    } catch (error: any) {
      toast.error(`Erro ao enviar ${type}: ${error.message}`);
    } finally {
      setUploading({ ...uploading, [type]: false });
    }
  };

  const handleSave = async () => {
    if (!restaurant) return;

    // Validate slug if menu is being enabled
    if (formData.menu_enabled && formData.slug && slugValidation.available === false) {
      toast.error('Corrija o slug antes de ativar o menu');
      return;
    }

    try {
      if (settings) {
        // Update existing settings
        await updateSettings(settings.id, formData);
      } else {
        // Create new settings - generate slug from restaurant name if not provided
        const slug = formData.slug || restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        await createSettings(restaurant.id, slug);
        // After creation, update with full formData
        const newSettings = usePublicMenuSettingsStore.getState().settings;
        if (newSettings) {
          await updateSettings(newSettings.id, formData);
        }
      }
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.meta_keywords.includes(newKeyword.trim())) {
      setFormData({
        ...formData,
        meta_keywords: [...formData.meta_keywords, newKeyword.trim()]
      });
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      meta_keywords: formData.meta_keywords.filter(k => k !== keyword)
    });
  };

  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const menuUrl = formData.slug ? `${window.location.origin}/menu/${formData.slug}` : '';

  return (
    <div className="space-y-6">
      {/* Ativação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Ativação do Menu Público
          </CardTitle>
          <CardDescription>
            Publique seu cardápio online e receba pedidos diretamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Menu Público Ativo</Label>
              <p className="text-sm text-muted-foreground">
                Permite que clientes visualizem seu cardápio e façam pedidos
              </p>
            </div>
            <Switch
              checked={formData.menu_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, menu_enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug do Menu *</Label>
            <div className="flex gap-2">
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="meu-restaurante"
              />
              {slugValidation.checking && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
              {slugValidation.available === true && <Check className="h-4 w-4 text-green-500 mt-2" />}
              {slugValidation.available === false && <X className="h-4 w-4 text-red-500 mt-2" />}
            </div>
            {slugValidation.message && (
              <p className={`text-sm ${slugValidation.available ? 'text-green-600' : 'text-red-600'}`}>
                {slugValidation.message}
              </p>
            )}
          </div>

          {formData.menu_enabled && menuUrl && (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span className="font-mono text-sm">{menuUrl}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(menuUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle>Identidade Visual</CardTitle>
          <CardDescription>Logo, banner e cores da sua marca</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')}
                  disabled={uploading.logo}
                />
                {uploading.logo && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {formData.logo_url && (
                <img src={formData.logo_url} alt="Logo" className="h-20 w-20 object-cover rounded border" />
              )}
              <p className="text-xs text-muted-foreground">Máx: 500KB | Recomendado: 512x512px</p>
            </div>

            <div className="space-y-2">
              <Label>Banner</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')}
                  disabled={uploading.banner}
                />
                {uploading.banner && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {formData.banner_url && (
                <img src={formData.banner_url} alt="Banner" className="h-20 w-full object-cover rounded border" />
              )}
              <p className="text-xs text-muted-foreground">Máx: 2MB | Recomendado: 1920x600px</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="w-20"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  placeholder="#3b82f6"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent_color">Cor de Destaque</Label>
              <div className="flex gap-2">
                <Input
                  id="accent_color"
                  type="color"
                  value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                  className="w-20"
                />
                <Input
                  value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                  placeholder="#10b981"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Pedido */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Pedido</CardTitle>
          <CardDescription>Valores mínimos, raio de entrega e tempo de preparo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_order">Valor Mínimo (€)</Label>
              <Input
                id="min_order"
                type="number"
                min="0"
                step="0.01"
                value={formData.min_order_amount}
                onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_distance">Raio Máximo (km)</Label>
              <Input
                id="max_distance"
                type="number"
                min="0"
                step="1"
                value={formData.max_delivery_distance_km}
                onChange={(e) => setFormData({ ...formData, max_delivery_distance_km: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prep_time">Tempo de Preparo (min)</Label>
              <Input
                id="prep_time"
                type="number"
                min="0"
                step="5"
                value={formData.estimated_prep_time_minutes}
                onChange={(e) => setFormData({ ...formData, estimated_prep_time_minutes: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métodos de Finalização */}
      <Card>
        <CardHeader>
          <CardTitle>Métodos de Finalização</CardTitle>
          <CardDescription>Como os clientes podem finalizar seus pedidos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Finalizar via WhatsApp</Label>
              <p className="text-sm text-muted-foreground">Pedido é enviado diretamente para seu WhatsApp</p>
            </div>
            <Switch
              checked={formData.checkout_whatsapp_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, checkout_whatsapp_enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Checkout Web Completo</Label>
              <p className="text-sm text-muted-foreground">Cliente preenche todos os dados no site</p>
            </div>
            <Switch
              checked={formData.checkout_web_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, checkout_web_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* SEO & Marketing */}
      <Card>
        <CardHeader>
          <CardTitle>SEO & Marketing</CardTitle>
          <CardDescription>Otimize seu menu para buscadores e redes sociais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta_title">Meta Title</Label>
            <Input
              id="meta_title"
              value={formData.meta_title}
              onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
              placeholder={`${restaurant?.name} - Cardápio Online`}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">{formData.meta_title.length}/60 caracteres</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_description">Meta Description</Label>
            <Textarea
              id="meta_description"
              value={formData.meta_description}
              onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
              placeholder="Peça agora do nosso cardápio com delivery rápido..."
              maxLength={160}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{formData.meta_description.length}/160 caracteres</p>
          </div>

          <div className="space-y-2">
            <Label>Keywords</Label>
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                placeholder="pizza, delivery, restaurante..."
              />
              <Button onClick={addKeyword} variant="outline">Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.meta_keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="cursor-pointer" onClick={() => removeKeyword(keyword)}>
                  {keyword} <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={formData.instagram_url}
                onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                placeholder="@meurestaurante"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                value={formData.facebook_url}
                onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                placeholder="facebook.com/meurestaurante"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => fetchSettings(restaurant!.id)}>
          Cancelar
        </Button>
        {formData.menu_enabled && menuUrl && (
          <Button variant="outline" onClick={() => window.open(menuUrl, '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Visualizar Menu
          </Button>
        )}
        <Button onClick={handleSave} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
