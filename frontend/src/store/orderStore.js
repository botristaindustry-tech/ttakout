import { create } from 'zustand';
import { io } from 'socket.io-client';

const socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}`, {
  withCredentials: true,
});

export const useOrderStore = create((set, get) => ({
  orders: [],
  isLoading: true,
  isAuthLoading: true,
  user: null,
  error: null,
  
  checkAuth: async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isAuthLoading: false });
      } else {
        set({ user: null, isAuthLoading: false });
      }
    } catch (error) {
      set({ user: null, isAuthLoading: false });
    }
  },

  // Connect and fetch initial data
  init: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/orders`);
      const data = await res.json();
      set({ orders: data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load orders', isLoading: false });
    }

    // Socket Event Listeners
    socket.on('new_order', (newOrder) => {
      console.log(`[Order Intake] New order received at ${new Date().toLocaleTimeString()} - ID: ${newOrder.id}`);
      set((state) => ({
        orders: [...state.orders, newOrder]
      }));
    });

    socket.on('order_updated', (updatedOrder) => {
      set((state) => ({
        orders: state.orders.map(order => 
          order.id === updatedOrder.id ? updatedOrder : order
        )
      }));
    });

    socket.on('line_updated', (updatedLine) => {
      set((state) => ({
        orders: state.orders.map(order => {
          if (order.id !== updatedLine.order_id) return order;
          return {
            ...order,
            lines: order.lines.map(line => 
              line.id === updatedLine.id ? { ...line, ...updatedLine } : line
            )
          };
        })
      }));
    });
  },

  updateOrderStatus: async (id, status, reject_reason = null, payment_type = null) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reject_reason, payment_type })
      });
      // State updates via socket listener
    } catch (error) {
      console.error('Failed to update status', error);
    }
  },

  updateLineStatus: async (lineId, is_completed) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/orders/lines/${lineId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed })
      });
    } catch (error) {
      console.error('Failed to update line', error);
    }
  }
}));
