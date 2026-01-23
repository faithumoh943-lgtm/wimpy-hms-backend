const mongoose = require("mongoose");

const KitchenSaleSchema = new mongoose.Schema({
  item: String,
  quantity: Number,
  price: Number,
  total: Number,
  date: {
    type: String,
    default: () => new Date().toISOString().slice(0,10)
  }
});

module.exports = mongoose.model("KitchenSale", KitchenSaleSchema);
