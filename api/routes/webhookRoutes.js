const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const protect = require('../middleware/authMiddleware');

// Route to handle incoming webhook request
router.post('/alcatraz-dashboard-webhook', webhookController.handleAlcatrazWebhook);
router.post('/statue-dashboard-webhook', webhookController.handleStatueWebhook);
router.post('/potomac-dashboard-webhook', webhookController.handlePotomacWebhook);
router.post('/bay-cruise-tickets-dashboard-webhook', webhookController.handleBayCruiseTicketsWebhook);
router.post('/boston-harbor-cruise-tickets-dashboard-webhook', webhookController.handleBostonHarborCruiseTicketsWebhook);
router.post('/niagara-cruise-tickets-dashboard-webhook', webhookController.handleNiagaraCruiseTicketsWebhook);
router.post('/fort-sumter-ticketing-dashboard-webhook', webhookController.handleFortSumterTicketingWebhook);
router.post('/kennedy-space-center-ticketing-dashboard-webhook', webhookController.handleKennedySpaceCenterTicketingWebhook);
router.post('/hoover-dam-dashboard-webhook', webhookController.handleHooverDamWebhook);
router.post('/mackinac-dashboard-webhook', webhookController.handleMackinacWebhook);
router.post('/ship-island-ferry-dashboard-webhook', webhookController.handleShipIslandFerryWebhook);
router.post('/battleship-dashboard-webhook', webhookController.handleBattleShipWebhook);
router.post('/plantation-dashboard-webhook', webhookController.handlePlantationWebhook);
router.post('/cumberland-island-dashboard-webhook', webhookController.handleCumberlandIslandWebhook);
router.post('/fort-mackinac-dashboard-webhook', webhookController.handleFortMackinacWebhook);


// Update Order Payload
router.post('/update-order-payload', webhookController.updateOrderPayload);

//Switch VPN
router.post("/switch-vpn",protect,webhookController.switchVpn)
router.get("/vpn-cities",protect,webhookController.getVPNCities)
router.get("/vpn-status",protect,webhookController.getVpnStatus)
router.post("/disconnect-vpn",protect,webhookController.disconnectVpn)

module.exports = router;
