const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // 'Admin', 'Manager', 'Processor'
    permissions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission'
    }],
    default: { type: Boolean, default: false } // To easily identify the default role
});

module.exports = mongoose.model('Role', roleSchema);