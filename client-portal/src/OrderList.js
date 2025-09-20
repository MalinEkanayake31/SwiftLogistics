import React, { useEffect, useState } from 'react';

function OrderList({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setOrders(data.orders || []);
        } else {
          setError(data.error || 'Failed to fetch orders');
        }
      } catch (err) {
        setError('Network error');
      }
      setLoading(false);
    };
    fetchOrders();
  }, [token]);

  if (loading) return <div>Loading orders...</div>;
  if (error) return <div style={{color:'red'}}>{error}</div>;
  if (!orders.length) return <div>No orders found.</div>;

  return (
    <div>
      <h2>Your Orders</h2>
      <ul>
        {orders.map(order => (
          <li key={order._id || order.id}>
            <strong>{order.status}</strong> - {order.description || 'No description'}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default OrderList;
