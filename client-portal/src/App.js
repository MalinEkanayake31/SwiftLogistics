
import React, { useState } from "react";
import Login from "./Login";
import Register from "./Register";
import OrderList from "./OrderList";
import NewOrder from "./NewOrder";

function App() {
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [view, setView] = useState("dashboard");
  const [orderRefresh, setOrderRefresh] = useState(0);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  if (!user) {
    return (
      <div className="app-container">
        <h1>SwiftLogistics Client Portal</h1>
        {showRegister ? (
          <>
            <Register onRegister={() => setShowRegister(false)} />
            <p>
              Already have an account?{' '}
              <button onClick={() => setShowRegister(false)} className="link">Login</button>
            </p>
          </>
        ) : (
          <>
            <Login onLogin={handleLogin} />
            <p>
              Don&apos;t have an account?{' '}
              <button onClick={() => setShowRegister(true)} className="link">Register</button>
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1>Welcome, {user.name}!</h1>
      <button onClick={handleLogout}>Logout</button>
      <nav style={{ margin: '20px 0' }}>
        <button onClick={() => setView("dashboard")}>Dashboard</button>
        <button onClick={() => setView("orders")}>My Orders</button>
        <button onClick={() => setView("neworder")}>New Order</button>
      </nav>
      {view === "dashboard" && (
        <div>
          <h2>Dashboard</h2>
          <p>Welcome to your dashboard. Use the navigation above to manage your orders.</p>
        </div>
      )}
      {view === "orders" && (
        <OrderList token={localStorage.getItem("token")} key={orderRefresh} />
      )}
      {view === "neworder" && (
        <NewOrder token={localStorage.getItem("token")} onOrderCreated={() => setOrderRefresh(orderRefresh + 1)} />
      )}
    </div>
  );
}

export default App;
