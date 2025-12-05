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
} from 'lucide-react';
import type { CategoryWithProducts, Product, Addon } from '@/types/database';
import { uploadImage, deleteImage, validateImageFile, extractPathFromUrl } from '@/lib/imageUpload';

const MenuManagement = () => {
  const { restaurant } = useRestaurantGuard();
  const { categories, loading, fetchMenu, addCategory, updateCategory, deleteCategory, addProduct, updateProduct, deleteProduct, addAddon, updateAddon, deleteAddon } = useMenuStore();
  const { toast } = useToast();

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [addonDialog, setAddonDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'category' | 'product' | 'addon' | null; id: string | null }>({ open: false, type: null, id: null });
  const [editingCategory, setEditingCategory] = useState<CategoryWithProducts | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [categoryName, setCategoryName] = useState('');
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', image_url: '', is_available: true });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addonForm, setAddonForm] = useState({ name: '', price: '' });


  useEffect(() => {
    if (restaurant?.id) {
      fetchMenu(restaurant.id);
    }
  }, [restaurant?.id, fetchMenu]);

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
      console.error('[MenuManagement] Cannot save category - no restaurant ID');
      toast({ title: 'Error', description: 'No restaurant found. Please create a restaurant in Settings first.', variant: 'destructive' });
      return;
    }
    
    console.log('[MenuManagement] Saving category:', { editing: !!editingCategory, name: categoryName, restaurantId: restaurant.id });
    
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { name: categoryName });
        console.log('[MenuManagement] Category updated successfully');
        toast({ title: 'Category updated successfully' });
      } else {
        await addCategory(categoryName, restaurant.id);
        console.log('[MenuManagement] Category added successfully');
        toast({ title: 'Category added successfully' });
      }
      setCategoryDialog(false);
      setCategoryName('');
    } catch (error) {
      console.error('[MenuManagement] Failed to save category:', error);
      toast({ title: 'Error', description: 'Failed to save category', variant: 'destructive' });
    }
  };

  const handleAddProduct = (categoryId: string) => {
    setEditingProduct(null);
    setSelectedCategoryId(categoryId);
    setProductForm({ name: '', description: '', price: '', image_url: '', is_available: true });
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
    });
    setProductImageFile(null);
    setProductImagePreview(product.image_url || '');
    setProductDialog(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validationError = validateImageFile(file);
    if (validationError) {
      toast({
        title: 'Invalid image',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProductImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    setProductImageFile(file);
  };

  const handleRemoveImage = () => {
    setProductImageFile(null);
    setProductImagePreview('');
    setProductForm({ ...productForm, image_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveProduct = async () => {
    if (!restaurant?.id) {
      console.error('[MenuManagement] Cannot save product - no restaurant ID');
      toast({ title: 'Error', description: 'No restaurant found. Please create a restaurant in Settings first.', variant: 'destructive' });
      return;
    }
    
    console.log('[MenuManagement] Saving product:', { editing: !!editingProduct, form: productForm, hasImage: !!productImageFile, restaurantId: restaurant.id });
    
    setUploadingImage(true);
    try {
      let imageUrl = productForm.image_url;

      // Upload new image if file selected
      if (productImageFile) {
        console.log('[MenuManagement] Uploading product image...');
        const uploadResult = await uploadImage(productImageFile);
        imageUrl = uploadResult.url;
        console.log('[MenuManagement] Image uploaded:', imageUrl);

        // Delete old image if updating product
        if (editingProduct?.image_url) {
          const oldImagePath = extractPathFromUrl(editingProduct.image_url);
          if (oldImagePath) {
            console.log('[MenuManagement] Deleting old image:', oldImagePath);
            await deleteImage(oldImagePath).catch(console.error);
          }
        }
      }

      const productData = {
        name: productForm.name,
        description: productForm.description || null,
        price: parseFloat(productForm.price),
        image_url: imageUrl || null,
        is_available: productForm.is_available,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        console.log('[MenuManagement] Product updated successfully');
        toast({ title: 'Product updated successfully' });
      } else {
        await addProduct({ ...productData, category_id: selectedCategoryId, restaurant_id: restaurant.id });
        console.log('[MenuManagement] Product added successfully');
        toast({ title: 'Product added successfully' });
      }
      
      setProductDialog(false);
      setProductImageFile(null);
      setProductImagePreview('');
    } catch (error) {
      console.error('[MenuManagement] Failed to save product:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save product', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddAddon = (productId: string) => {
    setEditingAddon(null);
    setSelectedProductId(productId);
    setAddonForm({ name: '', price: '' });
    setAddonDialog(true);
  };

  const handleEditAddon = (addon: Addon) => {
    setEditingAddon(addon);
    setSelectedProductId(addon.product_id);
    setAddonForm({ name: addon.name, price: String(addon.price) });
    setAddonDialog(true);
  };

  const handleSaveAddon = async () => {
    console.log('[MenuManagement] Saving addon:', { editing: !!editingAddon, form: addonForm, productId: selectedProductId });
    
    try {
      const addonData = { name: addonForm.name, price: parseFloat(addonForm.price) };
      if (editingAddon) {
        await updateAddon(editingAddon.id, addonData);
        console.log('[MenuManagement] Addon updated successfully');
        toast({ title: 'Add-on updated successfully' });
      } else {
        await addAddon({ ...addonData, product_id: selectedProductId });
        console.log('[MenuManagement] Addon added successfully');
        toast({ title: 'Add-on added successfully' });
      }
      setAddonDialog(false);
    } catch (error) {
      console.error('[MenuManagement] Failed to save addon:', error);
      toast({ title: 'Error', description: 'Failed to save add-on', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id || !deleteDialog.type) return;
    
    // Get product count before deleting category for proper feedback
    const category = categories.find(c => c.id === deleteDialog.id);
    const productCount = category?.products.length || 0;

    try {
      switch (deleteDialog.type) {
        case 'category':
          await deleteCategory(deleteDialog.id);
          toast({ 
            title: 'Category deleted successfully',
            description: productCount > 0 
              ? `${productCount} ${productCount === 1 ? 'product' : 'products'} also deleted`
              : undefined
          });
          break;
        case 'product':
          await deleteProduct(deleteDialog.id);
          toast({ title: 'Product deleted successfully' });
          break;
        case 'addon':
          await deleteAddon(deleteDialog.id);
          toast({ title: 'Add-on deleted successfully' });
          break;
      }
      setDeleteDialog({ open: false, type: null, id: null });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete item', variant: 'destructive' });
    }
  };

  if (loading && categories.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Menu Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your restaurant's categories, products, and add-ons
          </p>
        </div>
        <Button onClick={handleAddCategory}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by creating your first category
            </p>
            <Button onClick={handleAddCategory}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {categories.map((category) => (
            <AccordionItem key={category.id} value={category.id} className="border rounded-lg bg-card">
              <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50 rounded-t-lg">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{category.name}</h3>
                    <Badge variant="secondary">
                      {category.products.length} {category.products.length === 1 ? 'product' : 'products'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, type: 'category', id: category.id })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-4">
                <div className="space-y-4">
                  <Button variant="outline" size="sm" onClick={() => handleAddProduct(category.id)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                  {category.products.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No products in this category yet</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {category.products.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg flex items-center gap-2">
                                  {product.name}
                                  {!product.is_available && <Badge variant="destructive" className="text-xs">Unavailable</Badge>}
                                </CardTitle>
                                {product.description && <CardDescription className="mt-1">{product.description}</CardDescription>}
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
                            {product.addons.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Add-ons:</p>
                                <div className="space-y-1">
                                  {product.addons.map((addon) => (
                                    <div key={addon.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                                      <span>{addon.name}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">+€{Number(addon.price).toFixed(2)}</span>
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
                            <div className="flex gap-2 pt-2">
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => handleAddAddon(product.id)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Add-on
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

      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>{editingCategory ? 'Update category information' : 'Create a new category for your menu'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input id="category-name" placeholder="e.g., Pizzas, Burgers, Drinks" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={!categoryName.trim()}>{editingCategory ? 'Update' : 'Add'} Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>{editingProduct ? 'Update product information' : 'Create a new product in your menu'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input id="product-name" placeholder="e.g., Margherita Pizza" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <Textarea id="product-description" placeholder="Describe your product..." value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-price">Price (€)</Label>
                <Input id="product-price" type="number" step="0.01" min="0" placeholder="9.99" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-available">Availability</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch id="product-available" checked={productForm.is_available} onCheckedChange={(checked) => setProductForm({ ...productForm, is_available: checked })} />
                  <Label htmlFor="product-available" className="font-normal">{productForm.is_available ? 'Available' : 'Unavailable'}</Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-image" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Product Image
              </Label>
              <div className="space-y-3">
                {productImagePreview ? (
                  <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={productImagePreview}
                      alt="Product preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full aspect-video border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">No image selected</p>
                    </div>
                  </div>
                )}
                <Input
                  ref={fileInputRef}
                  id="product-image"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Supported formats: JPEG, PNG, WebP. Max size: 5MB
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveProduct} 
              disabled={!productForm.name.trim() || !productForm.price || parseFloat(productForm.price) < 0 || uploadingImage}
            >
              {uploadingImage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? 'Update' : 'Add'} Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addonDialog} onOpenChange={setAddonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddon ? 'Edit Add-on' : 'Add Add-on'}</DialogTitle>
            <DialogDescription>{editingAddon ? 'Update add-on information' : 'Create a new add-on for this product'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="addon-name">Add-on Name</Label>
              <Input id="addon-name" placeholder="e.g., Extra Cheese, Bacon" value={addonForm.name} onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addon-price">Price (€)</Label>
              <Input id="addon-price" type="number" step="0.01" min="0" placeholder="1.50" value={addonForm.price} onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddonDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAddon} disabled={!addonForm.name.trim() || !addonForm.price || parseFloat(addonForm.price) < 0}>{editingAddon ? 'Update' : 'Add'} Add-on</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
              {deleteDialog.type === 'category' && (
                <>
                  {' '}This will permanently delete this category
                  {(() => {
                    const category = categories.find(c => c.id === deleteDialog.id);
                    const productCount = category?.products.length || 0;
                    if (productCount > 0) {
                      return ` and all ${productCount} ${productCount === 1 ? 'product' : 'products'} in it (including their add-ons)`;
                    }
                    return '';
                  })()}.
                </>
              )}
              {deleteDialog.type === 'product' && ' This will permanently delete this product and all its add-ons.'}
              {deleteDialog.type === 'addon' && ' This will permanently delete this add-on.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MenuManagement;
