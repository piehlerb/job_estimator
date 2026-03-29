import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ShoppingCart, CheckSquare } from 'lucide-react';
import { getAllShoppingItems, addShoppingItem, updateShoppingItem, deleteShoppingItem } from '../lib/db';
import { ShoppingItem } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function ShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const all = await getAllShoppingItems();
      // Sort: uncompleted first (by createdAt desc), then completed (by createdAt desc)
      all.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      setItems(all);
    } catch (err) {
      console.error('Error loading shopping items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const name = newItemName.trim();
    if (!name) return;

    const now = new Date().toISOString();
    const item: ShoppingItem = {
      id: generateId(),
      name,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await addShoppingItem(item);
      setNewItemName('');
      await loadItems();
      inputRef.current?.focus();
    } catch (err) {
      console.error('Error adding item:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAdd();
  };

  const handleToggle = async (item: ShoppingItem) => {
    try {
      await updateShoppingItem({
        ...item,
        completed: !item.completed,
        updatedAt: new Date().toISOString(),
      });
      await loadItems();
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteShoppingItem(id);
      await loadItems();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const handleClearCompleted = async () => {
    const completed = items.filter(i => i.completed);
    if (completed.length === 0) return;
    if (!window.confirm(`Remove ${completed.length} completed item${completed.length > 1 ? 's' : ''}?`)) return;
    try {
      await Promise.all(completed.map(i => deleteShoppingItem(i.id)));
      await loadItems();
    } catch (err) {
      console.error('Error clearing completed items:', err);
    }
  };

  const pending = items.filter(i => !i.completed);
  const completed = items.filter(i => i.completed);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart size={28} className="text-gf-lime" />
            Shopping List
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {pending.length} item{pending.length !== 1 ? 's' : ''} to order
            {completed.length > 0 && ` · ${completed.length} completed`}
          </p>
        </div>
        {completed.length > 0 && (
          <button
            onClick={handleClearCompleted}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <CheckSquare size={15} />
            Clear done
          </button>
        )}
      </div>

      {/* Add item input */}
      <div className="flex gap-2 mb-6">
        <input
          ref={inputRef}
          type="text"
          value={newItemName}
          onChange={e => setNewItemName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an item..."
          className="flex-1 px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
        />
        <button
          onClick={handleAdd}
          disabled={!newItemName.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gf-lime text-white text-sm font-medium rounded-lg hover:bg-gf-dark-green transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Your shopping list is empty.</p>
          <p className="text-xs mt-1">Add items above to get started.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Pending items */}
          {pending.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
            >
              <input
                type="checkbox"
                checked={false}
                onChange={() => handleToggle(item)}
                className="w-5 h-5 rounded border-slate-300 text-gf-lime focus:ring-gf-lime cursor-pointer flex-shrink-0"
              />
              <span className="flex-1 text-sm text-slate-900">{item.name}</span>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Divider + completed items */}
          {completed.length > 0 && (
            <>
              {pending.length > 0 && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">Completed</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              )}
              {completed.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg opacity-60"
                >
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => handleToggle(item)}
                    className="w-5 h-5 rounded border-slate-300 text-gf-lime focus:ring-gf-lime cursor-pointer flex-shrink-0"
                  />
                  <span className="flex-1 text-sm text-slate-500 line-through">{item.name}</span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
