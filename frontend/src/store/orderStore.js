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

  init: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/orders`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        set({ orders: Array.isArray(data) ? data : [], isLoading: false });
      } else {
        set({ error: data.error || 'Failed to load orders', orders: [], isLoading: false });
      }
    } catch (error) {
      set({ error: 'Failed to load orders', orders: [], isLoading: false });
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, reject_reason, payment_type })
      });
      if (res.ok) {
        const updatedOrder = await res.json();
        set((state) => ({
          orders: state.orders.map(order => 
            order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
          )
        }));
      } else {
        console.error('Failed to update status', await res.text());
      }
    } catch (error) {
      console.error('Failed to update status', error);
    }
  },

  updateLineStatus: async (lineId, is_completed) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/orders/lines/${lineId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_completed })
      });
      if (res.ok) {
        const updatedLine = await res.json();
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
      } else {
        console.error('Failed to update line', await res.text());
      }
    } catch (error) {
      console.error('Failed to update line', error);
    }
  }
}));
