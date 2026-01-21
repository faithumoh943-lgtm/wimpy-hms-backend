const mongoose = require("mongoose");

const BarSaleSchema = new mongoose.Schema({
  item: String,
  qty: Number,
  price: Number,
  total: Number,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("BarSale", BarSaleSchema);
