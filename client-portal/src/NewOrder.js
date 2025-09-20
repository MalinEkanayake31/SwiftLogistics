import React, { useState } from 'react';


function NewOrder({ token, onOrderCreated }) {
  const [form, setForm] = useState({
    productName: '',
    quantity: 1,
    deliveryAddress: '',
    priority: 'Normal',
    description: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Order created!');
        setForm({ productName: '', quantity: 1, deliveryAddress: '', priority: 'Normal', description: '' });
        onOrderCreated && onOrderCreated();
      } else {
        setError(data.error || 'Failed to create order');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create New Order</h2>
      {error && <div style={{color:'red'}}>{error}</div>}
      {success && <div style={{color:'green'}}>{success}</div>}
      <input
        name="productName"
        placeholder="Product Name"
        value={form.productName}
        onChange={handleChange}
        required
      />
      <input
        name="quantity"
        type="number"
        min="1"
        placeholder="Quantity"
        value={form.quantity}
        onChange={handleChange}
        required
      />
      <input
        name="deliveryAddress"
        placeholder="Delivery Address"
        value={form.deliveryAddress}
        onChange={handleChange}
        required
      />
      <select name="priority" value={form.priority} onChange={handleChange}>
        <option value="Low">Low</option>
        <option value="Normal">Normal</option>
        <option value="High">High</option>
        <option value="Urgent">Urgent</option>
      </select>
      <input
        name="description"
        placeholder="Order Description"
        value={form.description}
        onChange={handleChange}
      />
      <button type="submit">Submit Order</button>
    </form>
  );
}

export default NewOrder;
