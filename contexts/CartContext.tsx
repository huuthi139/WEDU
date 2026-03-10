'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Course } from '@/lib/mockData';

interface CartItem extends Course {
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (course: Course, onSuccess?: () => void) => void;
  removeFromCart: (courseId: string, onSuccess?: () => void) => void;
  updateQuantity: (courseId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('wepower-cart');
      if (savedCart) {
        setItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('[CartProvider] localStorage error:', error instanceof Error ? error.message : String(error));
    }
    setIsLoaded(true);
  }, []);

  // Save cart to localStorage only after initial load
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('wepower-cart', JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const addToCart = (course: Course, onSuccess?: () => void) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === course.id);

      if (existingItem) {
        // Increase quantity if already in cart
        const newItems = prevItems.map((item) =>
          item.id === course.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        onSuccess?.();
        return newItems;
      } else {
        // Add new item to cart
        onSuccess?.();
        return [...prevItems, { ...course, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (courseId: string, onSuccess?: () => void) => {
    setItems((prevItems) => {
      const newItems = prevItems.filter((item) => item.id !== courseId);
      onSuccess?.();
      return newItems;
    });
  };

  const updateQuantity = (courseId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(courseId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === courseId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
