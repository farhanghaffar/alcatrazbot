// seed.js
const dbConnect = require("./dbConnect");
const dotenv = require("dotenv");
const Permission = require("./api/models/Permission");
const Role = require("./api/models/Role");
const User = require("./api/models/User");


dotenv.config();
dbConnect();

//Permssion Seed Data
const permissionsData = [
  // Admin Permissions
  {
    name: "user_manage",
    description: "Create, update, and delete users (Admin only).",
  },
  { name: "system_config", description: "Configure system-wide settings." },
  { name: "report_export", description: "Run and export all reports." },
  { name: "assignment_override", description: "Override any assignment." },

  // Manager Permissions
  {
    name: "assignment_manage",
    description: "Assign, unassign, and reassign orders to processors.",
  },
  { name: "order_read_all", description: "View all orders in the dashboard." },
  { name: "fees_submit", description: "Submit fees for PASSED orders." },
  { name: "report_view", description: "View performance reports and metrics." },
  {
    name: "order_edit_instructions",
    description: "Edit manager instructions on an order.",
  },

  // Processor Permissions
  {
    name: "order_read_assigned",
    description: "View only orders assigned to them.",
  },
  {
    name: "order_update_self",
    description:
      "Update status of assigned orders (Start, Complete, Sold Out).",
  },
  { name: "file_upload", description: "Upload ticket files and screenshots." },
];

const seedData = async () => {
  try {
    // 1. Clear existing data
    await Permission.deleteMany();
    await Role.deleteMany();
    await User.deleteMany({ username: "admin" });

    console.log("✅ Existing Permissions, Roles, and Admin User cleared.");

    // 2. Insert Permissions
    const insertedPermissions = await Permission.insertMany(permissionsData);
    console.log("✅ Permissions seeded successfully.");

    // Helper to get permission IDs
    const getPermissionIds = (names) =>
      insertedPermissions
        .filter((p) => names.includes(p.name))
        .map((p) => p._id);

    // 3. Define Roles with Permissions
    const adminPermissions = getPermissionIds([
      "user_manage",
      "system_config",
      "report_export",
      "assignment_override",
      "assignment_manage",
      "order_read_all",
      "fees_submit",
      "report_view",
      "order_edit_instructions",
      "order_read_assigned",
      "order_update_self",
      "file_upload",
    ]);

    const managerPermissions = getPermissionIds([
      "assignment_manage",
      "order_read_all",
      "fees_submit",
      "report_view",
      "order_edit_instructions",
    ]);

    const processorPermissions = getPermissionIds([
      "order_read_assigned",
      "order_update_self",
      "file_upload",
    ]);

    const rolesData = [
      { name: "Admin", permissions: adminPermissions },
      { name: "Manager", permissions: managerPermissions },
      { name: "Processor", permissions: processorPermissions, default: true },
    ];

    const insertedRoles = await Role.insertMany(rolesData);
    const adminRole = insertedRoles.find((r) => r.name === "Admin");

    console.log("✅ Roles seeded successfully.");

    // 4. Create an initial Admin user (default password 'admin123')
    if (adminRole) {
      await User.create({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD, // Will be hashed by pre('save') middleware
        role: adminRole._id,
      });
      console.log(
        "✅ Initial Admin user created (Username: admin, Password: admin123)."
      );
    }

    process.exit();
  } catch (error) {
    console.error(`❌ Error seeding data: ${error.message}`);
    process.exit(1);
  }
};

seedData();
