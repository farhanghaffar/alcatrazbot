const Order = require("../models/Order");
const Machine = require("../models/Machine");

// Get all orders
// Fetch the orders with the selectedMachine populated
const getOrders = async (req, res) => {
  try {
    const { search, startDate, endDate, websiteName } = req.query;

    // Build the query object dynamically based on the filters
    const query = {};

    // Search functionality (matching order ID, customer name, failure reason, or status)
    if (search) {
      const searchTerm = search.trim(); // Trim spaces to avoid extra characters
      const regex = new RegExp(searchTerm, "i"); // Use case-insensitive regex

      query.$or = [
        { orderId: { $regex: regex } }, // Partial match for order ID
        { "payload.billing.first_name": { $regex: regex } }, // Partial match for first name
        { "payload.billing.last_name": { $regex: regex } }, // Partial match for last name
        { status: { $regex: regex } }, // Partial match for order status
      ];
    }

    // Date range filter (if both start and end date are provided)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Set end date to 11:59:59.999 PM
      query.createdAt = { $gte: start, $lte: end };
    } else if (startDate) {
      const start = new Date(startDate);
      query.createdAt = { $gte: start };
    } else if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Set end date to 11:59:59.999 PM
      query.createdAt = { $lte: end };
    }

    // Filter by website name if provided
    if (websiteName) {
      query.websiteName = websiteName;
    }

    // Fetch the orders with the selectedMachine populated (get machine's name)
    const orders = await Order.find(query)
      .populate("triggeredMachine", "name") // Populate selectedMachine field with 'name'
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("Error fetching orders: ", err);
    res.status(500).send("Server error");
  }
};

const getSites = async (req, res) => {
  try {
    const allWebsiteNames = await Order.distinct("websiteName");
    return res.status(200).json({
      websites: allWebsiteNames,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const getStats = async (req, res) => {
  try {
    const { websiteName, startDate, endDate } = req.query;

    const matchStage = {};

    if (websiteName) {
      matchStage.websiteName = websiteName;
    }
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.createdAt.$lte = new Date(endDate);
      }
    }

    const pipeline = [];

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({
        $match: matchStage,
      });
    }

    pipeline.push({
      $addFields: {
        numericTotal: {
          $convert: {
            input: "$payload.total",
            to: "double",
            onError: 0,
            onNull: 0,
          },
        },
        numericProfit: {
          $reduce: {
            input: "$payload.line_items",
            initialValue: 0,
            in: {
              $add: [
                "$$value",
                {
                  $reduce: {
                    input: "$$this.meta_data",
                    initialValue: 0,
                    in: {
                      $add: [
                        "$$value",
                        {
                          $convert: {
                            input: {
                              $cond: {
                                if: {
                                  $or: [
                                    {
                                      $eq: [
                                        "$$this.key",
                                        "_booking_serviceCharges",
                                      ],
                                    },
                                    { $eq: ["$$this.key", "Service Charges"] },
                                  ],
                                },
                                then: {
                                  $switch: {
                                    branches: [
                                      {
                                        case: {
                                          $regexMatch: {
                                            input: "$$this.value",
                                            regex: /^CA\$/,
                                          },
                                        },
                                        then: {
                                          $substrCP: [
                                            "$$this.value",
                                            3,
                                            { $strLenCP: "$$this.value" },
                                          ],
                                        },
                                      },
                                      {
                                        case: {
                                          $regexMatch: {
                                            input: "$$this.value",
                                            regex: /^\$/,
                                          },
                                        },
                                        then: {
                                          $substrCP: [
                                            "$$this.value",
                                            1,
                                            { $strLenCP: "$$this.value" },
                                          ],
                                        },
                                      },
                                    ],
                                    default: "$$this.value",
                                  },
                                },
                                else: "0",
                              },
                            },
                            to: "double",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    });

    pipeline.push({
      $group: {
        _id: null,
        totalSales: { $sum: "$numericTotal" },
        totalProfit: { $sum: "$numericProfit" },
      },
    });

    pipeline.push({
      $project: {
        _id: 0,
        totalSales: "$totalSales",
        totalProfit: "$totalProfit",
      },
    });

    const result = await Order.aggregate(pipeline);

    return res.status(200).json({
      totalSales: result[0]?.totalSales || 0,
      totalProfit: result[0]?.totalProfit || 0,
      totalCost: 0,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const getChartData = async (req, res) => {
  try {
    const { websiteName, month, year } = req.query;

    const pipeline = [];

    // Filter by websiteName if provided
    if (websiteName) {
      pipeline.push({
        $match: { websiteName: websiteName },
      });
    }

    // Filter by year and month if provided, using $expr for robust date matching
    if (month && year) {
      pipeline.push({
        $match: {
          $expr: {
            $and: [
              { $eq: [{ $year: "$createdAt" }, Number(year)] },
              { $eq: [{ $month: "$createdAt" }, Number(month)] },
            ],
          },
        },
      });
    }

    // Use the provided logic to correctly sum total and profit
    pipeline.push({
      $addFields: {
        numericTotal: {
          $convert: {
            input: "$payload.total",
            to: "double",
            onError: 0,
            onNull: 0,
          },
        },
        numericProfit: {
          $reduce: {
            input: "$payload.line_items",
            initialValue: 0,
            in: {
              $add: [
                "$$value",
                {
                  $reduce: {
                    input: "$$this.meta_data",
                    initialValue: 0,
                    in: {
                      $add: [
                        "$$value",
                        {
                          $convert: {
                            input: {
                              $cond: {
                                if: {
                                  $or: [
                                    {
                                      $eq: [
                                        "$$this.key",
                                        "_booking_serviceCharges",
                                      ],
                                    },
                                    { $eq: ["$$this.key", "Service Charges"] },
                                  ],
                                },
                                then: {
                                  $switch: {
                                    branches: [
                                      {
                                        case: {
                                          $regexMatch: {
                                            input: "$$this.value",
                                            regex: /^CA\$/,
                                          },
                                        },
                                        then: {
                                          $substrCP: [
                                            "$$this.value",
                                            3,
                                            { $strLenCP: "$$this.value" },
                                          ],
                                        },
                                      },
                                      {
                                        case: {
                                          $regexMatch: {
                                            input: "$$this.value",
                                            regex: /^\$/,
                                          },
                                        },
                                        then: {
                                          $substrCP: [
                                            "$$this.value",
                                            1,
                                            { $strLenCP: "$$this.value" },
                                          ],
                                        },
                                      },
                                    ],
                                    default: "$$this.value",
                                  },
                                },
                                else: "0",
                              },
                            },
                            to: "double",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    });

    // Group by date to get daily totals
    pipeline.push({
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        totalSales: { $sum: "$numericTotal" },
        totalProfit: { $sum: "$numericProfit" },
      },
    });

    // Sort the results by date
    pipeline.push({
      $sort: { _id: 1 },
    });

    // Project to format the output
    pipeline.push({
      $project: {
        _id: 0,
        date: "$_id",
        totalSales: "$totalSales",
        totalProfit: "$totalProfit",
      },
    });

    const result = await Order.aggregate(pipeline);

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching chart data",
      error: error.message,
    });
  }
};

// Update the triggered machine on an order

const updateTriggeredMachine = async (req, res) => {
  const { orderId, triggeredMachineId } = req.body; // Get the triggered machine from the request

  try {
    // Find the order by its ID and update the triggeredMachine field
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { triggeredMachine: triggeredMachineId }, // Only update triggeredMachine
      { new: true } // Return the updated order
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.status(200).json(updatedOrder); // Send back the updated order with triggeredMachine
  } catch (err) {
    console.error("Error updating triggered machine:", err);
    res.status(500).send("Server error");
  }
};

// Get all machines for dropdown
const getMachines = async (req, res) => {
  try {
    const machines = await Machine.find();
    res.json(machines);
  } catch (err) {
    res.status(500).send("Server error");
  }
};

const updateOrderStatus = async (req, res) => {
  const { orderId, status } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ msg: "Order not found" });
    }

    // Update the status
    order.status = status;
    await order.save();

    res.json({ msg: "Order status updated successfully", order });
  } catch (err) {
    res.status(500).send("Server error");
  }
};

const updateServiceChargesStatus = async (req, res) => {
  const { orderId, status, websiteName } = req.body;

  try {
    // Find the order by orderId and websiteName
    const order = await Order.findOne({ orderId, websiteName });

    if (!order) {
      return res
        .status(404)
        .json({ msg: "Order not found with the specified website" });
    }

    // Update serviceChargesStatus
    order.serviceChargesStatus = status;

    await order.save();

    res.json({ msg: "Service charges status updated successfully", order });
  } catch (err) {
    res.status(500).send("Server error");
  }
};

const addMachine = async (req, res) => {
  const { name, url } = req.body;

  // Check if machine with the same name already exists
  try {
    const existingMachine = await Machine.findOne({ name });

    if (existingMachine) {
      return res
        .status(400)
        .json({ message: "Machine with this name already exists!" });
    }

    // Create a new machine
    const newMachine = new Machine({ name, url });
    await newMachine.save();

    return res
      .status(201)
      .json({ message: "Machine added successfully", newMachine });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error adding machine", error: err });
  }
};

const editMachine = async (req, res) => {
  const { machineId, name, url } = req.body;

  try {
    // Check if machine name already exists, but exclude the current machine
    const existingMachine = await Machine.findOne({
      name,
      _id: { $ne: machineId },
    });
    if (existingMachine) {
      return res
        .status(400)
        .json({ message: "Machine with this name already exists!" });
    }

    // Update the machine
    const updatedMachine = await Machine.findByIdAndUpdate(
      machineId,
      { name, url },
      { new: true }
    );

    if (!updatedMachine) {
      return res.status(404).json({ message: "Machine not found" });
    }

    return res
      .status(200)
      .json({ message: "Machine updated successfully", updatedMachine });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error updating machine", error: err });
  }
};

const deleteMachine = async (req, res) => {
  const { machineId } = req.params;

  try {
    const deletedMachine = await Machine.findByIdAndDelete(machineId);

    if (!deletedMachine) {
      return res.status(404).json({ message: "Machine not found" });
    }

    return res.status(200).json({ message: "Machine deleted successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error deleting machine", error: err });
  }
};

module.exports = {
  getOrders,
  getStats,
  getSites,
  getChartData,
  getMachines,
  updateOrderStatus,
  deleteMachine,
  addMachine,
  editMachine,
  updateTriggeredMachine,
  updateServiceChargesStatus,
};
