// api/controllers/userController.js
const User = require("../models/User");
const Role = require("../models/Role");

const createUser = async (req, res) => {
  const { username, password, roleName } = req.body;

  const userExists = await User.findOne({ username });

  if (userExists) {
    return res.status(400).json({ msg: "User already exists" });
  }

  const role = await Role.findOne({ name: roleName || "Processor" });

  if (!role) {
    return res.status(404).json({ msg: `Role ${roleName} not found` });
  }

  const user = await User.create({
    username,
    password,
    role: role._id, // Assign the ObjectId of the role
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      username: user.username,
      role: role.name,
    });
  } else {
    res.status(400).json({ msg: "Invalid user data" });
  }
};

const getUsers = async (req, res) => {
  const { active } = req.params;
  const clause = active === "true" ? { isActive: true } : {};
  try {
    // Fetch users and populate the role to display the role name
    const users = await User.find(clause).populate("role", "name"); // Only select the name field from the Role model

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { roleName, isActive } = req.body;
  let updateFields = {};

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // 1. Update Role if roleName is provided
    if (roleName) {
      const newRole = await Role.findOne({ name: roleName });
      if (!newRole) {
        return res.status(404).json({ msg: `Role ${roleName} not found` });
      }
      updateFields.role = newRole._id;
    }

    // 2. Update isActive status if provided
    if (typeof isActive === "boolean") {
      updateFields.isActive = isActive;
    }

    // Apply updates
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true } // Return the updated document
    )
      .select("-password -__v")
      .populate("role", "name");

    if (updatedUser) {
      // Flatten the response for the frontend
      const responseData = {
        _id: updatedUser._id,
        username: updatedUser.username,
        role: updatedUser.role ? updatedUser.role.name : "Unassigned",
        isActive: updatedUser.isActive,
        msg: "User updated successfully",
      };
      res.json(responseData);
    } else {
      res.status(400).json({ msg: "Update failed." });
    }
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Soft delete: set isActive to false

    res.json({
      msg: `User deleted successfully.`,
      _id: userId,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
module.exports = { createUser, getUsers, updateUser, deleteUser };
