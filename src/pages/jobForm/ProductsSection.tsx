import { ChevronDown, ChevronUp, X, Plus, Package } from 'lucide-react';
import type { JobFormModel } from './useJobForm';

export default function ProductsSection({ form }: { form: JobFormModel }) {
  const {
    jobProducts,
    setJobProducts,
    allProducts,
    showProductsSection,
    setShowProductsSection,
    selectedProductId,
    setSelectedProductId,
    productsTotalPrice,
    productsTotalCost,
    formatCurrency,
  } = form;

  return (
    <div className="rounded-xl border-2 border-green-300 bg-green-50 mb-4 sm:mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setShowProductsSection(open => !open)}
        aria-expanded={showProductsSection}
        aria-controls="job-products-panel"
        className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-4 text-left hover:bg-green-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-700"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Package size={24} className="shrink-0 text-green-700" aria-hidden="true" />
          <div>
            <span className="text-base font-bold text-green-900">Products</span>
            <span className="block text-xs sm:text-sm text-green-800 mt-1">
              {jobProducts.length > 0
                ? `${formatCurrency(productsTotalPrice)} in products · ${formatCurrency(productsTotalPrice - productsTotalCost)} product profit`
                : 'Add products to this job and include their profit in your margin.'}
            </span>
          </div>
          {jobProducts.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-green-200 text-green-900 rounded-full">
              {jobProducts.length}
            </span>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-green-800">
          <span className="hidden sm:inline">{showProductsSection ? 'Collapse' : 'Add / edit products'}</span>
          {showProductsSection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>

      {showProductsSection && (
        <div id="job-products-panel" className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-green-200 bg-white">
          {/* Product selector */}
          <div className="flex items-center gap-2 mt-3 mb-3">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
            >
              <option value="">Select a product...</option>
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(p.price)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!selectedProductId) return;
                const product = allProducts.find((p) => p.id === selectedProductId);
                if (!product) return;
                const existing = jobProducts.find((jp) => jp.productId === product.id);
                if (existing) {
                  setJobProducts(jobProducts.map((jp) =>
                    jp.productId === product.id ? { ...jp, quantity: jp.quantity + 1 } : jp
                  ));
                } else {
                  setJobProducts([...jobProducts, {
                    productId: product.id,
                    productName: product.name,
                    quantity: 1,
                    unitCost: product.cost,
                    unitPrice: product.price,
                  }]);
                }
                setSelectedProductId('');
              }}
              disabled={!selectedProductId}
              className="flex items-center gap-1 px-3 py-2 bg-gf-lime text-white text-sm rounded-lg hover:bg-gf-dark-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          {allProducts.length === 0 && (
            <p className="text-sm text-slate-500 py-2">No products in catalog. Add products from the Products page first.</p>
          )}

          {/* Products table */}
          {jobProducts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="text-left py-2 font-medium">Product</th>
                    <th className="text-right py-2 font-medium w-20">Qty</th>
                    <th className="text-right py-2 font-medium">Unit Cost</th>
                    <th className="text-right py-2 font-medium w-28">Unit Price</th>
                    <th className="text-right py-2 font-medium">Line Total</th>
                    <th className="text-right py-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {jobProducts.map((jp, idx) => (
                    <tr key={jp.productId} className="border-b border-slate-100">
                      <td className="py-2 text-slate-900">{jp.productName}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={jp.quantity}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 1;
                            setJobProducts(jobProducts.map((p, i) =>
                              i === idx ? { ...p, quantity: qty } : p
                            ));
                          }}
                          className="w-16 text-right text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-gf-lime p-0"
                        />
                      </td>
                      <td className="py-2 text-right text-slate-500">{formatCurrency(jp.unitCost)}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={jp.unitPrice}
                          onChange={(e) => {
                            const price = parseFloat(e.target.value) || 0;
                            setJobProducts(jobProducts.map((p, i) =>
                              i === idx ? { ...p, unitPrice: price } : p
                            ));
                          }}
                          className="w-24 text-right text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-gf-lime p-0"
                        />
                      </td>
                      <td className="py-2 text-right text-slate-900 font-medium">
                        {formatCurrency(jp.quantity * jp.unitPrice)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setJobProducts(jobProducts.filter((_, i) => i !== idx))}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={2} className="py-2 text-xs text-slate-500 font-medium">Totals</td>
                    <td className="py-2 text-right text-xs text-slate-500 font-medium">{formatCurrency(productsTotalCost)}</td>
                    <td></td>
                    <td className="py-2 text-right text-sm text-slate-900 font-semibold">{formatCurrency(productsTotalPrice)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
