const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // e.g., 'order:read_all', 'user:create'
    description: { type: String, default: '' },
});

module.exports = mongoose.model('Permission', permissionSchema);