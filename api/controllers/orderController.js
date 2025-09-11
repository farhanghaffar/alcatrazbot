const Order = require("../models/Order");
const Machine = require("../models/Machine");

// Get all orders
// Fetch the orders with the selectedMachine populated
const getOrders = async (req, res) => {
  try {
    const {
      search,
      startDate,
      endDate,
      websiteName,
      orderId,
      customerName,
      failureReason,
      updateStatus,
      serviceChargesStatus,
      triggeredMachine,
      sortOrder,
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build the query object dynamically based on the filters
    const matchStage = {};

    if (orderId) {
      matchStage.orderId = { $regex: new RegExp(orderId, "i") };
    }

    if (customerName) {
      const regex = new RegExp(customerName, "i");
      matchStage["payload.billing.first_name"] = { $regex: regex };
      matchStage["payload.billing.last_name"] = { $regex: regex };
    }

    if (failureReason) {
      matchStage.failureReason = { $regex: new RegExp(failureReason, "i") };
    }

    if (updateStatus) {
      matchStage.status = updateStatus;
    }

    if (serviceChargesStatus) {
      matchStage.serviceChargesStatus = serviceChargesStatus;
    }

    if (triggeredMachine) {
      const machineRegex = new RegExp(triggeredMachine, "i");
      const machines = await Machine.find({
        name: { $regex: machineRegex },
      }).select("_id");
      const machineIds = machines.map((m) => m._id);
      matchStage.triggeredMachine = { $in: machineIds };
    }

    if (search) {
      const searchTerm = search.trim();
      const regex = new RegExp(searchTerm, "i");
      matchStage.$or = [
        { orderId: { $regex: regex } },
        { "payload.billing.first_name": { $regex: regex } },
        { "payload.billing.last_name": { $regex: regex } },
        { status: { $regex: regex } },
      ];
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    } else if (startDate) {
      const start = new Date(startDate);
      matchStage.createdAt = { $gte: start };
    } else if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $lte: end };
    }

    if (websiteName) {
      matchStage.websiteName = websiteName;
    }

    // Aggregation pipeline setup
    let pipeline = [];

    // Add the $match stage if there are any filters
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Handle sorting by tour date
    if (sortOrder) {
      const sortDirection = sortOrder === "asc" ? 1 : -1;

      // Add a new field 'sortableTourDate' using $addFields
      pipeline.push({
        $addFields: {
          sortableTourDate: {
            $dateFromString: {
              dateString: {
                $reduce: {
                  input: "$payload.line_items.meta_data",
                  initialValue: "",
                  in: {
                    $let: {
                      vars: {
                        dateObj: {
                          $arrayElemAt: [
                            "$$this",
                            {
                              $indexOfArray: [
                                "$$this.key",
                                {
                                  $cond: [
                                    { $in: ["_booking_date", "$$this.key"] },
                                    "_booking_date",
                                    "Booking Date",
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      },
                      in: "$$dateObj.value",
                    },
                  },
                },
              },
              onError: "$createdAt",
            },
          },
        },
      });

      // Add the $sort stage
      pipeline.push({
        $sort: { sortableTourDate: sortDirection },
      });
    }
    pipeline.push({
      $sort: { createdAt: -1 },
    });

    // Add pagination stages
    const totalOrders = await Order.countDocuments(matchStage);
    const totalPages = Math.ceil(totalOrders / limit);

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Populate the triggeredMachine field
    pipeline.push({
      $lookup: {
        from: "machines", // name of the machines collection
        localField: "triggeredMachine",
        foreignField: "_id",
        as: "triggeredMachine",
      },
    });

    pipeline.push({
      $unwind: {
        path: "$triggeredMachine",
        preserveNullAndEmptyArrays: true,
      },
    });

    // Execute the pipeline
    const orders = await Order.aggregate(pipeline);

    // Respond with the paginated data
    res.json({
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
    });
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

    const pipeline = [];

    // Stage 1: Initial Match for filtering
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
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Stage 2: Calculate numeric fields and flags for counting
    pipeline.push({
      $set: {
        numericTotal: {
          $convert: {
            input: "$payload.total",
            to: "double",
            onError: 0,
            onNull: 0,
          },
        },
        numericProfit: {
          $sum: {
            $map: {
              input: "$payload.line_items",
              as: "lineItem",
              in: {
                $sum: {
                  $map: {
                    input: "$$lineItem.meta_data",
                    as: "metaData",
                    in: {
                      $cond: {
                        if: {
                          $or: [
                            {
                              $eq: [
                                "$$metaData.key",
                                "_booking_serviceCharges",
                              ],
                            },
                            { $eq: ["$$metaData.key", "Service Charges"] },
                          ],
                        },
                        then: {
                          $convert: {
                            input: {
                              $switch: {
                                branches: [
                                  {
                                    case: {
                                      $regexMatch: {
                                        input: "$$metaData.value",
                                        regex: /^CA\$/,
                                      },
                                    },
                                    then: {
                                      $substrCP: [
                                        "$$metaData.value",
                                        3,
                                        { $strLenCP: "$$metaData.value" },
                                      ],
                                    },
                                  },
                                  {
                                    case: {
                                      $regexMatch: {
                                        input: "$$metaData.value",
                                        regex: /^\$/,
                                      },
                                    },
                                    then: {
                                      $substrCP: [
                                        "$$metaData.value",
                                        1,
                                        { $strLenCP: "$$metaData.value" },
                                      ],
                                    },
                                  },
                                ],
                                default: "$$metaData.value",
                              },
                            },
                            to: "double",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                        else: 0,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        isFailed: { $eq: ["$status", "Failed"] },
      },
    });

    // Stage 3: Group and sum the calculated fields
    pipeline.push({
      $group: {
        _id: null,
        totalSales: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "Passed"] },
                  {
                    $or: [
                      { $eq: ["$serviceChargesStatus", "Charged"] },
                      {
                        $eq: [
                          { $ifNull: ["$serviceChargesStatus", null] },
                          null,
                        ],
                      },
                    ],
                  },
                ],
              },
              "$numericTotal",
              0,
            ],
          },
        },
        totalProfit: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "Passed"] },
                  {
                    $or: [
                      { $eq: ["$serviceChargesStatus", "Charged"] },
                      {
                        $eq: [
                          { $ifNull: ["$serviceChargesStatus", null] },
                          null,
                        ],
                      },
                    ],
                  },
                ],
              },
              "$numericProfit",
              0,
            ],
          },
        },
        totalOrders: { $sum: 1 },
        totalFailed: { $sum: { $cond: ["$isFailed", 1, 0] } },
      },
    });

    // Stage 4: Project and format the final output
    pipeline.push({
      $project: {
        _id: 0,
        totalSales: "$totalSales",
        totalProfit: "$totalProfit",
        totalOrders: "$totalOrders",
        totalFailed: "$totalFailed",
      },
    });

    const result = await Order.aggregate(pipeline);

    return res.status(200).json({
      totalSales: result[0]?.totalSales || 0,
      totalProfit: result[0]?.totalProfit || 0,
      totalCost: 0,
      totalOrders: result[0]?.totalOrders || 0,
      totalFailed: result[0]?.totalFailed || 0,
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

    const matchStage = {
      $and: [
        { status: "Passed" },
        {
          $or: [
            { serviceChargesStatus: "Charged" },
            { serviceChargesStatus: { $exists: false } },
          ],
        },
      ],
    };

    // Filter by websiteName if provided
    if (websiteName) {
      matchStage.$and.push({ websiteName: websiteName });
    }
    if (month && year) {
      matchStage.$and.push({
        $expr: {
          $and: [
            { $eq: [{ $year: "$createdAt" }, Number(year)] },
            { $eq: [{ $month: "$createdAt" }, Number(month)] },
          ],
        },
      });
    }

    if (matchStage.$and.length > 0) {
      pipeline.push({ $match: matchStage });
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

const startCardDataClean = async (req, res) => {
  // Respond immediately to the client
  res.status(202).json({
    success: true,
    message: "Card data cleaning has started in the background.",
  });

  // Start the background process using setImmediate or process.nextTick
  setImmediate(async () => {
    try {
      await cleanCardData();
    } catch (error) {
      console.error("Error during background data cleaning:", error);
      // You might want to log this error to a file or a logging service
    }
  });
};

async function cleanCardData() {
  try {
    const query = {
      serviceChargesStatus: "Charged",
      status: "Passed",
    };

    const updateOperation = {
      $set: {
        "payload.meta_data.$[elem].value": "",
      },
    };

    const arrayFilters = {
      arrayFilters: [
        {
          "elem.key": {
            $in: [
              "credit_card_cvc",
              "credit_card_expiration",
              "credit_card_number",
            ],
          },
        },
      ],
    };

    const result = await Order.updateMany(query, updateOperation, arrayFilters);

    console.log(
      `Update operation completed. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`
    );
  } catch (error) {
    console.error("Error in cleanCardData function:", error);
  }
}

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
  startCardDataClean
};
