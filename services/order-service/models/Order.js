// Basic Order model template for SwiftLogistics order-service
// You can expand this with your schema/ORM as needed

class Order {
  constructor({ id, clientId, items, status, createdAt }) {
    this.id = id;
    this.clientId = clientId;
    this.items = items;
    this.status = status;
    this.createdAt = createdAt || new Date();
  }

  // Example static method to create an order
  static create(data) {
    return new Order(data);
  }

  // Add more methods as needed
}

module.exports = Order;
