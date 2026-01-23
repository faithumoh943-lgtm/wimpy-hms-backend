const mongoose = require("mongoose");

const KitchenStockSchema = new mongoose.Schema({
  item: String,
  quantity: Number,
  unit: String,
  costPrice: Number,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("KitchenStock", KitchenStockSchema);
