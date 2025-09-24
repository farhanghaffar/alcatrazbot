const e = require("express");
const Order = require("../models/Order"); // Import the existing Order model
const Machine = require("../models/Machine");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { default: axios } = require("axios");
// Go up one directory to find the 'ovpn_configs' folder
const OVPN_CONFIGS_DIR = path.join(__dirname, "..", "ovpn_configs");

// Global variables to manage the VPN process and current connection
let vpnProcess = null;
let currentConnection = null;

const orderExists = async (orderId, websiteName) => {
  try {
    const existingOrder = await Order.findOne({
      orderId,
      websiteName,
    });
    return existingOrder;
  } catch (error) {
    throw error;
  }
};

const handleAlcatrazWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(orderData.id, "Alcatraz Ticketing");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/alcatraz-webhook",
      websiteName: "Alcatraz Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleStatueWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(orderData.id, "StatueTicketing");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/webhook",
      websiteName: "StatueTicketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handlePotomacWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(orderData.id, "PotomacTicketing");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/potomac-webhook",
      websiteName: "PotomacTicketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleBayCruiseTicketsWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(orderData.id, "BayCruise Tickets");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/bay-cruise-tickets-webhook",
      websiteName: "BayCruise Tickets",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleBostonHarborCruiseTicketsWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "Boston Harbor Cruise"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/boston-harbor-cruise-tickets-webhook",
      websiteName: "Boston Harbor Cruise",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleNiagaraCruiseTicketsWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "NiagaraCruiseTicketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/niagara-cruise-tickets-webhook",
      websiteName: "NiagaraCruiseTicketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleFortSumterTicketingWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "Fort Sumter Ticketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/fort-sumter-ticketing-webhook",
      websiteName: "Fort Sumter Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleKennedySpaceCenterTicketingWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "Kennedy Space Center Ticketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/kennedy-space-center-ticketing-webhook",
      websiteName: "Kennedy Space Center Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleHooverDamWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "HooverDam Ticketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/hoover-dam-webhook",
      websiteName: "HooverDam Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleMackinacWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(orderData.id, "Mackinac Ticketing");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/mackinac-webhook",
      websiteName: "Mackinac Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleShipIslandFerryWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "ShipIslandFerry Ticketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/ship-island-ferry-webhook",
      websiteName: "ShipIslandFerry Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleBattleShipWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "Battleship Ticketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/battleship-webhook",
      websiteName: "Battleship Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handlePlantationWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "Plantation Ticketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/plantation-webhook",
      websiteName: "Plantation Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleCumberlandIslandWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "CumberlandIsland Ticketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/cumberland-island-webhook",
      websiteName: "CumberlandIsland Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const handleFortMackinacWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(
      orderData.id,
      "FortMackinac Ticketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/fort-mackinac-tickets-webhook",
      websiteName: "FortMackinac Ticketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const updateOrderPayload = async (req, res) => {
  try {
    const payload = req.body; // Get the new payload from the request body
    const orderId = payload.id; // Assuming the payload contains an 'id' field for the order
    let sitename = "";

    if (payload?.line_items[0]?.name === "Boston Cruise Tickets") {
      sitename = "Boston Harbor Cruise";
    } else if (payload?.line_items[0]?.name === "Alcatraz Reservation") {
      sitename = "Alcatraz Ticketing";
    } else if (
      payload?.line_items[0]?.name === "Statue of Liberty Reservation"
    ) {
      sitename = "StatueTicketing";
    } else if (payload?.line_items[0]?.name === "Potomac Water Taxi Passes") {
      sitename = "PotomacTicketing";
    } else if (payload?.line_items[0]?.name === "San Francisco Bay Cruises") {
      sitename = "BayCruise Tickets";
    } else if (payload?.line_items[0]?.name === "Niagara City Cruise") {
      sitename = "NiagaraCruiseTicketing";
    } else if (payload?.line_items[0]?.name === "Fort Sumter Tickets") {
      sitename = "Fort Sumter Ticketing";
    } else if (
      payload?.line_items[0]?.name === "Kennedy Space Center Tickets"
    ) {
      sitename = "Kennedy Space Center Ticketing";
    } else {
      return res.status(400).json({ message: "Invalid order data" });
    }

    // Find the order by ID and update its payload
    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: orderId, websiteName: sitename },
      {
        payload: payload,
      },
      { new: true } // Return the updated document
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Return success response
    return res.status(200).json({
      message: "Order payload successfully updated",
    });
  } catch (error) {
    console.error("Error updating order payload:", error);
    return res.status(500).json({
      message: "Error updating the order payload",
      error: error.message,
    });
  }
};

// Gracefully handle server shutdown to disconnect the VPN
process.on("SIGINT", () => {
  console.log("Received SIGINT. Disconnecting VPN and shutting down.");
  if (vpnProcess) {
    vpnProcess.kill("SIGINT");
    vpnProcess = null;
    currentConnection = null;
  }
  process.exit();
});
/**
 * Endpoint to check the current VPN status using OS-specific commands.
 */
const getVpnStatus = (req, res) => {
  const platform = os.platform();
  let checkCommand;

  if (platform === "win32") {
    checkCommand = 'tasklist /FI "IMAGENAME eq openvpn.exe"';
  } else {
    // 'linux' or 'darwin' (macOS)
    checkCommand = "ps aux | grep openvpn | grep -v grep";
  }

  exec(checkCommand, (error, stdout, stderr) => {
    if (error || stderr) {
      // An error or stderr output usually means the process was not found
      return res.json({
        isConnected: false,
        currentServer: null,
      });
    }

    const isConnected = stdout.includes("openvpn");
    res.json({
      isConnected: isConnected,
      currentServer: isConnected ? currentConnection : null,
    });
  });
};

/**
 * Endpoint to disconnect the currently active VPN connection.
 */
const disconnectVpn = async (req, res) => {
  if (vpnProcess) {
    // Kill the OpenVPN process
    vpnProcess.kill("SIGINT");
    vpnProcess = null;
    currentConnection = null;
    res.json({ success: true, message: "Disconnected from VPN." });
  } else {
    res.json({
      success: true,
      message: "No active VPN connection to disconnect.",
    });
  }
};

/**
 * Endpoint to switch to a new random VPN configuration.
 */
const switchVpn = async (req, res) => {
  const { id, city } = req.body;

  if (!id)
    return res.status(200).json({
      message: "Please provide machine ID",
    });

  if (!city)
    return res.status(400).json({ error: "Please provide a city name." });

  const MAX_RETRIES = 5;
  const CONNECT_TIMEOUT_MS = 15000; // 15 seconds

  // Disconnect any existing VPN connection
  if (vpnProcess) {
    // Disconnect gracefully by killing the process
    vpnProcess.kill("SIGINT");
    // Wait a moment for the process to terminate before starting a new one
    await new Promise((resolve) => setTimeout(resolve, 2000));
    vpnProcess = null;
  }

  // Get credentials from environment variables
  const username = process.env.NORDVPN_USER;
  const password = process.env.NORDVPN_PASS;

  if (!username || !password) {
    return res.status(400).json({ error: "VPN credentials not found." });
  }

  const cityFolderName = city.toLowerCase().replace(/ /g, "-");
  const cityDir = path.join(OVPN_CONFIGS_DIR, cityFolderName);

  // Get a list of all available files
  fs.readdir(cityDir, async (err, files) => {
    if (err) {
      // This error likely means the folder doesn't exist or is unreadable
      console.error(`Failed to read city directory for "${city}":`, err);
      return res.status(500).json({
        error: `Failed to find configuration files for "${city}". Please check the folder name.`,
        details: err,
      });
    }

    const ovpnFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".ovpn"
    );
    const originalFiles = [...ovpnFiles]; // Keep a copy of all available files

    if (ovpnFiles.length === 0) {
      return res.status(404).json({
        error: `No .ovpn files found in the directory for "${city}".`,
      });
    }

    let success = false;
    let retries = 0;
    let lastError = null;

    while (retries < MAX_RETRIES && !success) {
      const availableFiles = ovpnFiles.filter(
        (file) => file !== currentConnection
      );

      if (availableFiles.length === 0) {
        // If we run out of files, reset the list, but don't try the current one again
        ovpnFiles.splice(0, ovpnFiles.length, ...originalFiles);
        continue;
      }

      // Select a new random file and remove it from the list for this attempt
      const randomIndex = Math.floor(Math.random() * availableFiles.length);
      const newFile = availableFiles[randomIndex];
      ovpnFiles.splice(ovpnFiles.indexOf(newFile), 1);

      // The newConfigPath now points to the file inside the city folder
      const newConfigPath = path.join(cityDir, newFile);

      const platform = os.platform();
      let command;
      let args;

      if (platform === "win32") {
        command = "openvpn.exe";
      } else {
        // 'linux'
        command = "openvpn";
      }

      // Create a temporary file to pass credentials
      const tempAuthFilePath = path.join(os.tmpdir(), `auth_${Date.now()}.txt`);
      fs.writeFileSync(
        tempAuthFilePath,
        `${username}${os.EOL}${password}${os.EOL}`
      );

      args = ["--config", newConfigPath, "--auth-user-pass", tempAuthFilePath];

      console.log(
        `Attempting to connect to ${newFile} with user: ${username} (Attempt ${
          retries + 1
        } of ${MAX_RETRIES})`
      );

      const connectionPromise = new Promise((resolve, reject) => {
        const processInstance = spawn(command, args);
        let connected = false;

        processInstance.stdout.on("data", (data) => {
          const output = data.toString();
          console.log(`OpenVPN stdout: ${output}`);
          if (output.includes("Initialization Sequence Completed")) {
            connected = true;
            resolve(processInstance);
          }
        });

        processInstance.stderr.on("data", (data) => {
          const output = data.toString();
          console.error(`OpenVPN stderr: ${output}`);
          if (output.includes("AUTH_FAILED")) {
            lastError = "Authentication failed. Please check your credentials.";
            reject(new Error(lastError));
          } else if (output.includes("Access is denied.")) {
            lastError =
              "Access is denied. Please run the API server with administrative privileges.";
            reject(new Error(lastError));
          }
        });

        processInstance.on("close", (code) => {
          try {
            fs.unlinkSync(tempAuthFilePath);
          } catch (cleanupErr) {
            console.error("Failed to delete temporary auth file:", cleanupErr);
          }

          if (!connected) {
            lastError = `OpenVPN process exited with code ${code}`;
            reject(new Error(lastError));
          }
        });

        setTimeout(() => {
          if (!connected) {
            lastError = `Connection attempt timed out after ${
              CONNECT_TIMEOUT_MS / 1000
            } seconds.`;
            processInstance.kill("SIGINT");
            reject(new Error(lastError));
          }
        }, CONNECT_TIMEOUT_MS);
      });

      try {
        vpnProcess = await connectionPromise;
        currentConnection = newFile;
        success = true;
      } catch (error) {
        retries++;
        console.error(`Connection failed: ${error.message}`);
        vpnProcess = null;
      }
    }

    if (success) {
      const updatedMachine = await Machine.findByIdAndUpdate(
        id,
        {
          lastSwitchTime: Date.now(),
          lastSwitchTo: city,
        },
        { new: true }
      );
      res.json({
        lastSwitchTime: updatedMachine?.lastSwitchTime,
        lastSwitchTo: updatedMachine?.lastSwitchTo,
        success: true,
        message: `Successfully connected to ${currentConnection} after ${
          retries + 1
        } attempts.`,
        newConnection: currentConnection,
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to connect to a VPN server after ${MAX_RETRIES} attempts. Last error: ${lastError}`,
      });
    }
  });
};

/**
 * Endpoint to get a list of all available city names from the ovpn_configs folder.
 */
const getVPNCities = (req, res) => {
  fs.readdir(OVPN_CONFIGS_DIR, { withFileTypes: true }, (err, dirents) => {
    if (err) {
      console.error("Failed to read configs directory:", err);
      return res
        .status(500)
        .json({ error: "Failed to read city directories.", details: err });
    }

    // Filter for directories and map their names to a formatted string
    const cities = dirents
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => {
        const name = dirent.name.replace(/-/g, " ");
        // Capitalize each word
        return name
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      });

    res.json({ cities });
  });
};

const websiteConfig = {
  "Alcatraz Ticketing": {
    wpUrl: process.env.ALCATRAZ_WP_SITE_URL,
    authKey: `${process.env.ALCATRAZ_WC_REST_API_CONSUMER_KEY}:${process.env.ALCATRAZ_WC_REST_API_CONSUMER_SECRET}`,
    handler: handleAlcatrazWebhook, // Reference to the existing function
  },
  StatueTicketing: {
    wpUrl: process.env.STATUE_WP_SITE_URL,
    authKey: `${process.env.STATUE_WC_REST_API_CONSUMER_KEY}:${process.env.STATUE_WC_REST_API_CONSUMER_SECRET}`,
    handler: handleStatueWebhook,
  },
  // Add all your other websites here in the same format
  PotomacTicketing: {
    wpUrl: process.env.POTOMAC_WP_SITE_URL,
    authKey: `${process.env.POTOMAC_WC_REST_API_CONSUMER_KEY}:${process.env.POTOMAC_WC_REST_API_CONSUMER_SECRET}`,
    handler: handlePotomacWebhook,
  },
  "BayCruise Tickets": {
    wpUrl: process.env.BAY_CRUISE_TICKETING_WP_SITE_URL,
    authKey: `${process.env.BAY_CRUISE_TICKETING_WC_REST_API_CONSUMER_KEY}:${process.env.BAY_CRUISE_TICKETING_WC_REST_API_CONSUMER_SECRET}`,
    handler: handleBayCruiseTicketsWebhook,
  },
  "Boston Harbor Cruise": {
    wpUrl: process.env.BOSTON_HARBOR_CRUISE_TICKETING_WP_SITE_URL,
    authKey: `${process.env.BOSTON_HARBOR_CRUISE_TICKETING_WC_REST_API_CONSUMER_KEY}:${process.env.BOSTON_HARBOR_CRUISE_TICKETING_WC_REST_API_CONSUMER_SECRET}`,
    handler: handleBostonHarborCruiseTicketsWebhook,
  },
  NiagaraCruiseTicketing: {
    wpUrl: process.env.NIAGARA_CRUISE_TICKETING_WP_SITE_URL,
    authKey: `${process.env.NIAGARA_CRUISE_TICKETING_WC_REST_API_CONSUMER_KEY}:${process.env.NIAGARA_CRUISE_TICKETING_WC_REST_API_CONSUMER_SECRET}`,
    handler: handleNiagaraCruiseTicketsWebhook,
  },
  "Fort Sumter Ticketing": {
    wpUrl: process.env.FORT_SUMTER_TICKETING_WP_SITE_URL,
    authKey: `${process.env.FORT_SUMTER_TICKETING_WC_REST_API_CONSUMER_KEY}:${process.env.FORT_SUMTER_TICKETING_WC_REST_API_CONSUMER_SECRET}`,
    handler: handleFortSumterTicketingWebhook,
  },
  "Kennedy Space Center Ticketing": {
    wpUrl: process.env.KENNEDY_SPACE_CENTER_TICKETING_WP_SITE_URL,
    authKey: `${process.env.KENNEDY_SPACE_CENTER_TICKETING_WC_REST_API_CONSUMER_KEY}:${process.env.KENNEDY_SPACE_CENTER_TICKETING_WC_REST_API_CONSUMER_SECRET}`,
    handler: handleKennedySpaceCenterTicketingWebhook,
  },
  "HooverDam Ticketing": {
    wpUrl: process.env.HOOVERDAM_WP_SITE_URL,
    authKey: `${process.env.HOVERDAM_API_CONSUMER_KEY}:${process.env.HOOVERDAM_API_COSUMER_SECRET}`,
    handler: handleHooverDamWebhook,
  },
  "Mackinac Ticketing": {
    wpUrl: process.env.MACKINAC_WP_SITE_URL,
    authKey: `${process.env.MACKINAC_API_CONSUMER_KEY}:${process.env.MACKINAC_API_COSUMER_SECRET}`,
    handler: handleMackinacWebhook,
  },
  "ShipIslandFerry Ticketing": {
    wpUrl: process.env.SHIPISLAND_WP_SITE_URL,
    authKey: `${process.env.SHIPISLAND_API_CONSUMER_KEY}:${process.env.SHIPISLAND_API_COSUMER_SECRET}`,
    handler: handleShipIslandFerryWebhook,
  },
  "Battleship Ticketing": {
    wpUrl: process.env.BATTLESHIP_WP_SITE_URL,
    authKey: `${process.env.BATTLESHIP_API_CONSUMER_KEY}:${process.env.BATTLESHIP_API_COSUMER_SECRET}`,
    handler: handleBattleShipWebhook,
  },
  "Plantation Ticketing": {
    wpUrl: process.env.PLANTATION_WP_SITE_URL,
    authKey: `${process.env.PLANTATION_API_CONSUMER_KEY}:${process.env.PLANTATION_API_COSUMER_SECRET}`,
    handler: handlePlantationWebhook,
  },
};

const dropOrder = async (req, res) => {
  try {
    const { orderId, websiteName } = req.body;

    if (!orderId || !websiteName) {
      return res
        .status(400)
        .json({ message: "Missing orderId or websiteName" });
    }

    const config = websiteConfig[websiteName];
    if (!config || !config.wpUrl || !config.authKey || !config.handler) {
      return res.status(400).json({ message: "Invalid website name provided" });
    }

    const existingOrder = await orderExists(orderId, websiteName);

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Construct the WordPress API URL
    const wpApiUrl = `${config.wpUrl}/wp-json/wc/v3/orders/${orderId}`;

    // Set up basic authentication headers
    const authHeader = `Basic ${Buffer.from(config.authKey).toString(
      "base64"
    )}`;
    const headers = {
      Authorization: authHeader,
      "Content-Type": "application/json",
    };

    // Fetch order data from WordPress
    const wpResponse = await axios.get(wpApiUrl, { headers });

    const orderData = wpResponse.data;

    if (!orderData || !orderData.id) {
      return res
        .status(404)
        .json({ message: "Order not found on WordPress site" });
    }

    // Create a mock request object to pass to the original controller function
    const mockReq = { body: orderData };

    // Call the correct, existing controller function with the fetched data
    await config.handler(mockReq, res);

  } catch (error) {
   
    // Handle specific Axios errors for better debugging
    if (error.response) {
       if (error.response.status === 404) {
      return res.status(error.response.status).json({
        message: "Invalid Order ID",
        error: error.response.data,
      });
    }
      return res.status(error.response.status).json({
        message: "Error fetching order from WordPress API",
        error: error.response.data,
      });
    }
    return res.status(500).json({
      message: "Error processing the request",
      error: error.message,
    });
  }
};

module.exports = {
  handleAlcatrazWebhook,
  handleStatueWebhook,
  handlePotomacWebhook,
  handleBayCruiseTicketsWebhook,
  handleBostonHarborCruiseTicketsWebhook,
  handleNiagaraCruiseTicketsWebhook,
  handleFortSumterTicketingWebhook,
  handleKennedySpaceCenterTicketingWebhook,
  handleHooverDamWebhook,
  handleMackinacWebhook,
  handleShipIslandFerryWebhook,
  handleBattleShipWebhook,
  handlePlantationWebhook,
  handleCumberlandIslandWebhook,
  handleFortMackinacWebhook,
  updateOrderPayload,
  switchVpn,
  getVpnStatus,
  disconnectVpn,
  getVPNCities,
  dropOrder,
};
