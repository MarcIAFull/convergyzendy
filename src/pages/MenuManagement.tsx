import { useEffect, useState, useRef } from 'react';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { useMenuStore } from '@/stores/menuStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Edit2,
  Trash2,
  Package,
  Loader2,
  DollarSign,
  Image as ImageIcon,
  Upload,
  X,
  Copy,
  Layers,
} from 'lucide-react';
import type { CategoryWithProducts, Product, Addon, AddonGroup } from '@/types/database';
import { uploadImage, deleteImage, validateImageFile, extractPathFromUrl } from '@/lib/imageUpload';
import { TagsInput } from '@/components/menu/TagsInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MenuManagement = () => {
  const { restaurant } = useRestaurantGuard();
  const { 
    categories, loading, fetchMenu, 
    addCategory, updateCategory, deleteCategory, 
    addProduct, updateProduct, deleteProduct, duplicateProduct,
    addAddon, updateAddon, deleteAddon,
    addAddonGroup, updateAddonGroup, deleteAddonGroup,
  } = useMenuStore();
  const { toast } = useToast();

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [addonDialog, setAddonDialog] = useState(false);
  const [addonGroupDialog, setAddonGroupDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'category' | 'product' | 'addon' | 'addon_group' | null; id: string | null }>({ open: false, type: null, id: null });
  const [editingCategory, setEditingCategory] = useState<CategoryWithProducts | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [editingAddonGroup, setEditingAddonGroup] = useState<AddonGroup | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [categoryName, setCategoryName] = useState('');
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', image_url: '', is_available: true, search_keywords: [] as string[], ingredients: [] as string[], max_addons: '', free_addons_count: '' });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addonForm, setAddonForm] = useState({ name: '', price: '', group_id: '' });
  const [addonGroupForm, setAddonGroupForm] = useState({ name: '', min_selections: '0', max_selections: '', free_selections: '0' });

  useEffect(() => {
    if (restaurant?.id) {
      fetchMenu(restaurant.id);
    }
  }, [restaurant?.id, fetchMenu]);

  // ============================================================
  // CATEGORY HANDLERS
  // ============================================================
  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDialog(true);
  };

  const handleEditCategory = (category: CategoryWithProducts) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDialog(true);
  };

  const handleSaveCategory = async () => {
    if (!restaurant?.id) {
      toast({ title: 'Erro', description: 'Nenhum restaurante encontrado.', variant: 'destructive' });
      return;
    }
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { name: categoryName });
        toast({ title: 'Categoria atualizada com sucesso' });
      } else {
        await addCategory(categoryName, restaurant.id);
        toast({ title: 'Categoria adicionada com sucesso' });
      }
      setCategoryDialog(false);
      setCategoryName('');
    } catch {
      toast({ title: 'Erro', description: 'Falha ao guardar categoria', variant: 'destructive' });
    }
  };

  // ============================================================
  // PRODUCT HANDLERS
  // ============================================================
  const handleAddProduct = (categoryId: string) => {
    setEditingProduct(null);
    setSelectedCategoryId(categoryId);
    setProductForm({ name: '', description: '', price: '', image_url: '', is_available: true, search_keywords: [], ingredients: [], max_addons: '', free_addons_count: '' });
    setProductImageFile(null);
    setProductImagePreview('');
    setProductDialog(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setSelectedCategoryId(product.category_id);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      image_url: product.image_url || '',
      is_available: product.is_available,
      search_keywords: product.search_keywords || [],
      ingredients: product.ingredients || [],
      max_addons: product.max_addons != null ? String(product.max_addons) : '',
      free_addons_count: product.free_addons_count != null ? String(product.free_addons_count) : '',
    });
    setProductImageFile(null);
    setProductImagePreview(product.image_url || '');
    setProductDialog(true);
  };

  const handleDuplicateProduct = async (productId: string) => {
    if (!restaurant?.id) return;
    try {
      await duplicateProduct(productId, restaurant.id);
      toast({ title: 'Produto duplicado com sucesso' });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao duplicar produto', variant: 'destructive' });
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      toast({ title: 'Imagem inválida', description: validationError, variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setProductImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setProductImageFile(file);
  };

  const handleRemoveImage = () => {
    setProductImageFile(null);
    setProductImagePreview('');
    setProductForm({ ...productForm, image_url: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveProduct = async () => {
    if (!restaurant?.id) {
      toast({ title: 'Erro', description: 'Nenhum restaurante encontrado.', variant: 'destructive' });
      return;
    }
    setUploadingImage(true);
    try {
      let imageUrl = productForm.image_url;
      if (productImageFile) {
        const uploadResult = await uploadImage(productImageFile);
        imageUrl = uploadResult.url;
        if (editingProduct?.image_url) {
          const oldImagePath = extractPathFromUrl(editingProduct.image_url);
          if (oldImagePath) await deleteImage(oldImagePath).catch(console.error);
        }
      }
      const productData = {
        name: productForm.name,
        description: productForm.description || null,
        price: parseFloat(productForm.price),
        image_url: imageUrl || null,
        is_available: productForm.is_available,
        search_keywords: productForm.search_keywords,
        ingredients: productForm.ingredients,
        max_addons: productForm.max_addons ? parseInt(productForm.max_addons, 10) : null,
        free_addons_count: productForm.free_addons_count ? parseInt(productForm.free_addons_count, 10) : null,
      };
      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        toast({ title: 'Produto atualizado com sucesso' });
      } else {
        await addProduct({ ...productData, category_id: selectedCategoryId, restaurant_id: restaurant.id });
        toast({ title: 'Produto adicionado com sucesso' });
      }
      setProductDialog(false);
      setProductImageFile(null);
      setProductImagePreview('');
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Falha ao guardar produto', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  // ============================================================
  // ADDON HANDLERS
  // ============================================================
  const handleAddAddon = (productId: string) => {
    setEditingAddon(null);
    setSelectedProductId(productId);
    setAddonForm({ name: '', price: '', group_id: '' });
    setAddonDialog(true);
  };

  const handleEditAddon = (addon: Addon) => {
    setEditingAddon(addon);
    setSelectedProductId(addon.product_id);
    setAddonForm({ name: addon.name, price: String(addon.price), group_id: addon.group_id || '' });
    setAddonDialog(true);
  };

  const handleSaveAddon = async () => {
    try {
      const addonData = { 
        name: addonForm.name, 
        price: parseFloat(addonForm.price),
        group_id: addonForm.group_id || null,
      };
      if (editingAddon) {
        await updateAddon(editingAddon.id, addonData);
        toast({ title: 'Adicional atualizado com sucesso' });
      } else {
        await addAddon({ ...addonData, product_id: selectedProductId });
        toast({ title: 'Adicional adicionado com sucesso' });
      }
      setAddonDialog(false);
      // Refresh to get updated data
      if (restaurant?.id) await fetchMenu(restaurant.id);
    } catch {
      toast({ title: 'Erro', description: 'Falha ao guardar adicional', variant: 'destructive' });
    }
  };

  // ============================================================
  // ADDON GROUP HANDLERS
  // ============================================================
  const handleAddAddonGroup = (productId: string) => {
    setEditingAddonGroup(null);
    setSelectedProductId(productId);
    setAddonGroupForm({ name: '', min_selections: '0', max_selections: '', free_selections: '0' });
    setAddonGroupDialog(true);
  };

  const handleEditAddonGroup = (group: AddonGroup) => {
    setEditingAddonGroup(group);
    setSelectedProductId(group.product_id);
    setAddonGroupForm({
      name: group.name,
      min_selections: String(group.min_selections),
      max_selections: group.max_selections != null ? String(group.max_selections) : '',
      free_selections: String(group.free_selections),
    });
    setAddonGroupDialog(true);
  };

  const handleSaveAddonGroup = async () => {
    try {
      const groupData = {
        name: addonGroupForm.name,
        min_selections: parseInt(addonGroupForm.min_selections, 10) || 0,
        max_selections: addonGroupForm.max_selections ? parseInt(addonGroupForm.max_selections, 10) : null,
        free_selections: parseInt(addonGroupForm.free_selections, 10) || 0,
      };
      if (editingAddonGroup) {
        await updateAddonGroup(editingAddonGroup.id, groupData);
        toast({ title: 'Etapa atualizada com sucesso' });
      } else {
        await addAddonGroup({ ...groupData, product_id: selectedProductId });
        toast({ title: 'Etapa adicionada com sucesso' });
      }
      setAddonGroupDialog(false);
    } catch {
      toast({ title: 'Erro', description: 'Falha ao guardar etapa', variant: 'destructive' });
    }
  };

  // ============================================================
  // DELETE HANDLER
  // ============================================================
  const handleDelete = async () => {
    if (!deleteDialog.id || !deleteDialog.type) return;
    const category = categories.find(c => c.id === deleteDialog.id);
    const productCount = category?.products.length || 0;
    try {
      switch (deleteDialog.type) {
        case 'category':
          await deleteCategory(deleteDialog.id);
          toast({ title: 'Categoria eliminada com sucesso', description: productCount > 0 ? `${productCount} produto(s) também eliminado(s)` : undefined });
          break;
        case 'product':
          await deleteProduct(deleteDialog.id);
          toast({ title: 'Produto eliminado com sucesso' });
          break;
        case 'addon':
          await deleteAddon(deleteDialog.id);
          toast({ title: 'Adicional eliminado com sucesso' });
          break;
        case 'addon_group':
          await deleteAddonGroup(deleteDialog.id);
          toast({ title: 'Etapa eliminada com sucesso' });
          break;
      }
      setDeleteDialog({ open: false, type: null, id: null });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao eliminar item', variant: 'destructive' });
    }
  };

  // Get addon groups for the currently selected product in addon dialog
  const getProductAddonGroups = (productId: string): AddonGroup[] => {
    const product = categories.flatMap(c => c.products).find(p => p.id === productId);
    return product?.addon_groups || [];
  };

  if (loading && categories.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <Card key={j}>
                    <CardHeader>
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-full mt-1" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-40 w-full" />
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-foreground">Gestão de Menu</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Gerencie as categorias, produtos e adicionais do seu restaurante
          </p>
        </div>
        <Button onClick={handleAddCategory} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ainda não há categorias</h3>
            <p className="text-muted-foreground text-center mb-4">Comece criando a sua primeira categoria</p>
            <Button onClick={handleAddCategory}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Categoria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {categories.map((category) => (
            <AccordionItem key={category.id} value={category.id} className="border rounded-lg bg-card">
              <AccordionTrigger className="px-4 md:px-6 hover:no-underline hover:bg-muted/50 rounded-t-lg">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                    <h3 className="text-lg md:text-xl font-semibold">{category.name}</h3>
                    <Badge variant="secondary">
                      {category.products.length} {category.products.length === 1 ? 'produto' : 'produtos'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, type: 'category', id: category.id })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 md:px-6 pb-6 pt-4">
                <div className="space-y-4">
                  <Button variant="outline" size="sm" onClick={() => handleAddProduct(category.id)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Produto
                  </Button>
                  {category.products.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Ainda não há produtos nesta categoria</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {category.products.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                                  <span className="truncate">{product.name}</span>
                                  {!product.is_available && <Badge variant="destructive" className="text-xs">Indisponível</Badge>}
                                </CardTitle>
                                {product.description && <CardDescription className="mt-1 line-clamp-2">{product.description}</CardDescription>}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {product.image_url && (
                              <div className="aspect-video w-full bg-muted rounded-md overflow-hidden">
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-lg font-bold text-primary">
                                <DollarSign className="h-4 w-4" />
                                €{Number(product.price).toFixed(2)}
                              </div>
                            </div>

                            {/* Addon Groups */}
                            {(product.addon_groups || []).length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium flex items-center gap-1">
                                  <Layers className="h-3 w-3" />
                                  Etapas:
                                </p>
                                {(product.addon_groups || []).map((group) => {
                                  const groupAddons = product.addons.filter(a => a.group_id === group.id);
                                  return (
                                    <div key={group.id} className="bg-muted/30 rounded-md p-2 space-y-1">
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">{group.name}</span>
                                        <div className="flex items-center gap-1">
                                          <Badge variant="outline" className="text-xs">
                                            {group.min_selections > 0 ? `Mín: ${group.min_selections}` : 'Opcional'}
                                            {group.max_selections != null ? ` · Máx: ${group.max_selections}` : ''}
                                            {group.free_selections > 0 ? ` · ${group.free_selections} grátis` : ''}
                                          </Badge>
                                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleEditAddonGroup(group)}>
                                            <Edit2 className="h-3 w-3" />
                                          </Button>
                                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setDeleteDialog({ open: true, type: 'addon_group', id: group.id })}>
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                      {groupAddons.length > 0 && (
                                        <div className="pl-2 space-y-0.5">
                                          {groupAddons.map((addon) => (
                                            <div key={addon.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                              <span>{addon.name}</span>
                                              <div className="flex items-center gap-1">
                                                <span>+€{Number(addon.price).toFixed(2)}</span>
                                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => handleEditAddon(addon)}>
                                                  <Edit2 className="h-2.5 w-2.5" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => setDeleteDialog({ open: true, type: 'addon', id: addon.id })}>
                                                  <Trash2 className="h-2.5 w-2.5" />
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Ungrouped addons */}
                            {product.addons.filter(a => !a.group_id).length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Adicionais:</p>
                                <div className="space-y-1">
                                  {product.addons.filter(a => !a.group_id).map((addon) => (
                                    <div key={addon.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                                      <span className="truncate">{addon.name}</span>
                                      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                                        <span className="text-muted-foreground text-xs md:text-sm">+€{Number(addon.price).toFixed(2)}</span>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEditAddon(addon)}>
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDeleteDialog({ open: true, type: 'addon', id: addon.id })}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2 flex-wrap">
                              <Button variant="outline" size="sm" className="text-xs" onClick={() => handleAddAddonGroup(product.id)}>
                                <Layers className="h-3 w-3 mr-1" />
                                Etapa
                              </Button>
                              <Button variant="outline" size="sm" className="text-xs" onClick={() => handleAddAddon(product.id)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Adicional
                              </Button>
                              <div className="flex-1" />
                              <Button variant="outline" size="sm" onClick={() => handleDuplicateProduct(product.id)} title="Duplicar produto">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleEditProduct(product)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDeleteDialog({ open: true, type: 'product', id: product.id })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Category Dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Adicionar Categoria'}</DialogTitle>
            <DialogDescription>{editingCategory ? 'Atualize as informações da categoria' : 'Crie uma nova categoria para o seu menu'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome da Categoria</Label>
              <Input id="category-name" placeholder="Ex: Pizzas, Hambúrgueres, Bebidas" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCategoryDialog(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleSaveCategory} disabled={!categoryName.trim()} className="w-full sm:w-auto">{editingCategory ? 'Atualizar' : 'Adicionar'} Categoria</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Adicionar Produto'}</DialogTitle>
            <DialogDescription>{editingProduct ? 'Atualize as informações do produto' : 'Crie um novo produto no seu menu'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Nome do Produto</Label>
              <Input id="product-name" placeholder="Ex: Pizza Margherita" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Descrição</Label>
              <Textarea id="product-description" placeholder="Descreva o seu produto..." value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-price">Preço (€)</Label>
                <Input id="product-price" type="number" step="0.01" min="0" placeholder="9.99" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-available">Disponibilidade</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch id="product-available" checked={productForm.is_available} onCheckedChange={(checked) => setProductForm({ ...productForm, is_available: checked })} />
                  <Label htmlFor="product-available" className="font-normal">{productForm.is_available ? 'Disponível' : 'Indisponível'}</Label>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-max-addons">Limite de Adicionais</Label>
                <Input id="product-max-addons" type="number" min="0" step="1" placeholder="Sem limite" value={productForm.max_addons} onChange={(e) => setProductForm({ ...productForm, max_addons: e.target.value })} />
                <p className="text-xs text-muted-foreground">Máximo de adicionais permitidos</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-free-addons">Complementos Grátis</Label>
                <Input id="product-free-addons" type="number" min="0" step="1" placeholder="Nenhum" value={productForm.free_addons_count} onChange={(e) => setProductForm({ ...productForm, free_addons_count: e.target.value })} />
                <p className="text-xs text-muted-foreground">Número de adicionais inclusos no preço</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-image" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Imagem do Produto
              </Label>
              <div className="space-y-3">
                {productImagePreview ? (
                  <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                    <img src={productImagePreview} alt="Pré-visualização" className="w-full h-full object-cover" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={handleRemoveImage}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full aspect-video border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">Nenhuma imagem selecionada</p>
                    </div>
                  </div>
                )}
                <Input ref={fileInputRef} id="product-image" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageFileChange} className="cursor-pointer" />
                <p className="text-xs text-muted-foreground">Formatos: JPEG, PNG, WebP • Tamanho máximo: 5MB</p>
              </div>
            </div>
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium text-muted-foreground">Otimização de Busca (Opcional)</h4>
              <TagsInput label="Palavras-chave de Busca" value={productForm.search_keywords} onChange={(tags) => setProductForm({ ...productForm, search_keywords: tags })} placeholder="Ex: marg, pizza basica..." suggestions={['pizza', 'hamburguer', 'bebida', 'combo', 'promoção']} />
              <TagsInput label="Ingredientes" value={productForm.ingredients} onChange={(tags) => setProductForm({ ...productForm, ingredients: tags })} placeholder="Ex: queijo, tomate, bacon..." suggestions={['queijo', 'presunto', 'bacon', 'cebola', 'tomate', 'alface']} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setProductDialog(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleSaveProduct} disabled={!productForm.name.trim() || !productForm.price || parseFloat(productForm.price) < 0 || uploadingImage} className="w-full sm:w-auto">
              {uploadingImage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? 'Atualizar' : 'Adicionar'} Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Addon Dialog */}
      <Dialog open={addonDialog} onOpenChange={setAddonDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAddon ? 'Editar Adicional' : 'Adicionar Adicional'}</DialogTitle>
            <DialogDescription>{editingAddon ? 'Atualize as informações do adicional' : 'Crie um novo adicional para este produto'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="addon-name">Nome do Adicional</Label>
              <Input id="addon-name" placeholder="Ex: Queijo Extra, Bacon" value={addonForm.name} onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addon-price">Preço (€)</Label>
              <Input id="addon-price" type="number" step="0.01" min="0" placeholder="1.50" value={addonForm.price} onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value })} />
            </div>
            {/* Group selection */}
            {getProductAddonGroups(selectedProductId).length > 0 && (
              <div className="space-y-2">
                <Label>Etapa (opcional)</Label>
                <Select value={addonForm.group_id} onValueChange={(val) => setAddonForm({ ...addonForm, group_id: val === '__none__' ? '' : val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem etapa (adicional solto)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem etapa</SelectItem>
                    {getProductAddonGroups(selectedProductId).map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Associe este adicional a uma etapa do combo</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setAddonDialog(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleSaveAddon} disabled={!addonForm.name.trim() || !addonForm.price || parseFloat(addonForm.price) < 0} className="w-full sm:w-auto">{editingAddon ? 'Atualizar' : 'Adicionar'} Adicional</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Addon Group Dialog */}
      <Dialog open={addonGroupDialog} onOpenChange={setAddonGroupDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAddonGroup ? 'Editar Etapa' : 'Adicionar Etapa'}</DialogTitle>
            <DialogDescription>
              {editingAddonGroup ? 'Atualize as informações da etapa' : 'Crie uma nova etapa para este produto (ex: Bebida, Sobremesa, Adicionais)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Nome da Etapa</Label>
              <Input id="group-name" placeholder="Ex: Escolha a Bebida" value={addonGroupForm.name} onChange={(e) => setAddonGroupForm({ ...addonGroupForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="group-min">Mínimo</Label>
                <Input id="group-min" type="number" min="0" step="1" placeholder="0" value={addonGroupForm.min_selections} onChange={(e) => setAddonGroupForm({ ...addonGroupForm, min_selections: e.target.value })} />
                <p className="text-xs text-muted-foreground">0 = opcional</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-max">Máximo</Label>
                <Input id="group-max" type="number" min="0" step="1" placeholder="Sem limite" value={addonGroupForm.max_selections} onChange={(e) => setAddonGroupForm({ ...addonGroupForm, max_selections: e.target.value })} />
                <p className="text-xs text-muted-foreground">Vazio = sem limite</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-free">Grátis</Label>
                <Input id="group-free" type="number" min="0" step="1" placeholder="0" value={addonGroupForm.free_selections} onChange={(e) => setAddonGroupForm({ ...addonGroupForm, free_selections: e.target.value })} />
                <p className="text-xs text-muted-foreground">Itens inclusos</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setAddonGroupDialog(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleSaveAddonGroup} disabled={!addonGroupForm.name.trim()} className="w-full sm:w-auto">{editingAddonGroup ? 'Atualizar' : 'Adicionar'} Etapa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Tem a certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
              {deleteDialog.type === 'category' && (
                <>
                  {' '}Isto irá eliminar permanentemente esta categoria
                  {(() => {
                    const category = categories.find(c => c.id === deleteDialog.id);
                    const productCount = category?.products.length || 0;
                    if (productCount > 0) return ` e todos os ${productCount} produto(s)`;
                    return '';
                  })()}.
                </>
              )}
              {deleteDialog.type === 'product' && ' Isto irá eliminar permanentemente este produto e todos os seus adicionais.'}
              {deleteDialog.type === 'addon' && ' Isto irá eliminar permanentemente este adicional.'}
              {deleteDialog.type === 'addon_group' && ' Isto irá eliminar esta etapa. Os adicionais associados ficarão sem etapa.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MenuManagement;
