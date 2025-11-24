import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicMenuStore } from '@/stores/publicMenuStore';
import { usePublicCartStore } from '@/stores/publicCartStore';
import { MenuHeader } from '@/components/public/MenuHeader';
import { ProductCard } from '@/components/public/ProductCard';
import { ProductModal } from '@/components/public/ProductModal';
import { CartFloatingButton } from '@/components/public/CartFloatingButton';
import { Product, Addon } from '@/types/database';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Helmet } from 'react-helmet-async';

export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>();
  const { menuData, loading, error, fetchMenuBySlug } = usePublicMenuStore();
  const { addItem, setSlug } = usePublicCartStore();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    console.log('[PublicMenu] Slug from params:', slug);
    if (slug) {
      console.log('[PublicMenu] Fetching menu for slug:', slug);
      fetchMenuBySlug(slug);
      setSlug(slug);
    }
  }, [slug]);

  console.log('[PublicMenu] Render state:', { slug, loading, error, hasMenuData: !!menuData });

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCart = (
    product: Product,
    quantity: number,
    selectedAddons: Addon[],
    notes: string
  ) => {
    addItem(product, quantity, selectedAddons, notes);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-32 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !menuData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Menu não encontrado'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { restaurant, settings, categories, products, addons } = menuData;

  // Agrupar produtos por categoria
  const productsByCategory = categories.map((category) => ({
    category,
    products: products.filter((p) => p.category_id === category.id),
  }));

  // Aplicar cores customizadas
  useEffect(() => {
    if (settings.primary_color) {
      document.documentElement.style.setProperty('--public-primary', settings.primary_color);
    }
    if (settings.accent_color) {
      document.documentElement.style.setProperty('--public-accent', settings.accent_color);
    }
    
    return () => {
      document.documentElement.style.removeProperty('--public-primary');
      document.documentElement.style.removeProperty('--public-accent');
    };
  }, [settings.primary_color, settings.accent_color]);

  return (
    <>
      <Helmet>
        <title>{settings.meta_title || `${restaurant.name} - Cardápio Online`}</title>
        <meta
          name="description"
          content={
            settings.meta_description ||
            `Peça delivery de ${restaurant.name}. Cardápio completo, entrega rápida.`
          }
        />
        {settings.meta_keywords && (
          <meta name="keywords" content={settings.meta_keywords.join(', ')} />
        )}
        
        {/* Open Graph */}
        <meta property="og:type" content="restaurant" />
        <meta property="og:title" content={restaurant.name} />
        <meta property="og:description" content={settings.meta_description || ''} />
        {settings.banner_url && <meta property="og:image" content={settings.banner_url} />}
        <meta property="og:url" content={`https://zendy.app/menu/${settings.slug}`} />
        
        {/* Canonical */}
        <link rel="canonical" href={`https://zendy.app/menu/${settings.slug}`} />
      </Helmet>

      <div className="min-h-screen bg-background pb-24">
        <MenuHeader restaurant={restaurant} settings={settings} />

        {settings.banner_url && (
          <div className="relative h-48 md:h-64 overflow-hidden">
            <img
              src={settings.banner_url}
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        )}

        <div className="container mx-auto px-4 py-8">
          <Tabs defaultValue={categories[0]?.id} className="w-full">
            <TabsList className="w-full justify-start mb-8 overflow-x-auto flex-nowrap">
              {categories.map((category) => (
                <TabsTrigger key={category.id} value={category.id} className="whitespace-nowrap">
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {productsByCategory.map(({ category, products: categoryProducts }) => (
              <TabsContent key={category.id} value={category.id}>
                {categoryProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhum produto disponível nesta categoria
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoryProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onClick={() => handleProductClick(product)}
                        accentColor={settings.accent_color || undefined}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <ProductModal
          product={selectedProduct}
          addons={addons}
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={handleAddToCart}
        />

        {slug && <CartFloatingButton slug={slug} />}
      </div>
    </>
  );
}
