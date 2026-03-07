import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getAllProducts, addProduct, updateProduct, deleteProduct } from '../lib/db';
import { Product } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    price: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const allProducts = await getAllProducts();
      setProducts(allProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, query]);

  const openAddForm = () => {
    setEditingProduct(null);
    setFormData({ name: '', cost: '', price: '', description: '' });
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      cost: product.cost.toString(),
      price: product.price.toString(),
      description: product.description || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const record: Product = {
        id: editingProduct?.id || generateId(),
        name: formData.name.trim(),
        cost: parseFloat(formData.cost) || 0,
        price: parseFloat(formData.price) || 0,
        description: formData.description.trim() || undefined,
        createdAt: editingProduct?.createdAt || now,
        updatedAt: now,
      };

      if (editingProduct) {
        await updateProduct(record);
      } else {
        await addProduct(record);
      }

      await loadData();
      setShowForm(false);
      setEditingProduct(null);
      setFormData({ name: '', cost: '', price: '', description: '' });
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete product "${product.name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct(product.id);
      await loadData();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Products</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">Manage your product catalog</p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 bg-gf-lime text-white rounded-lg font-medium hover:bg-gf-dark-green transition-colors text-sm"
        >
          <Plus size={16} />
          Add Product
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Products</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{filteredProducts.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <p className="text-xs text-slate-500">Avg Margin</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">
            {filteredProducts.length > 0
              ? (
                  (filteredProducts.reduce((sum, p) => sum + (p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0), 0) /
                    filteredProducts.length)
                ).toFixed(0) + '%'
              : '-'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          className="w-full sm:max-w-sm px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
        />
      </div>

      {/* Product table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4 sm:mb-6">
        {loading ? (
          <div className="p-8 text-center text-slate-600">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            {products.length === 0
              ? 'No products yet. Click "Add Product" to create one.'
              : 'No products match the current search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 lg:px-6 py-3 text-left text-sm font-semibold text-slate-700">
                    Product
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Cost
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Price
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Margin
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const margin = product.price - product.cost;
                  const marginPct = product.price > 0 ? (margin / product.price) * 100 : 0;

                  return (
                    <tr
                      key={product.id}
                      className="border-b border-slate-200 hover:bg-slate-50"
                    >
                      <td className="px-4 lg:px-6 py-4 text-sm">
                        <div className="font-medium text-slate-900">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-slate-500">{product.description}</div>
                        )}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">
                        {formatCurrency(product.cost)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-700">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-right">
                        <span className={margin >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {formatCurrency(margin)} ({marginPct.toFixed(0)}%)
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditForm(product)}
                            className="p-1.5 rounded text-slate-400 hover:text-gf-dark-green hover:bg-green-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Wall Panel 4x8"
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cost <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-gf-lime rounded-lg hover:bg-gf-dark-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
