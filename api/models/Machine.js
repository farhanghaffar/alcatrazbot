const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  lastSwitchTime: { type: Date, default: null },
});

module.exports = mongoose.model("Machine", machineSchema);
