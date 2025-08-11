const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Route to handle incoming webhook request
router.post('/alcatraz-dashboard-webhook', webhookController.handleAlcatrazWebhook);
router.post('/statue-dashboard-webhook', webhookController.handleStatueWebhook);
router.post('/potomac-dashboard-webhook', webhookController.handlePotomacWebhook);
router.post('/bay-cruise-tickets-dashboard-webhook', webhookController.handleBayCruiseTicketsWebhook);
router.post('/boston-harbor-cruise-tickets-dashboard-webhook', webhookController.handleBostonHarborCruiseTicketsWebhook);
router.post('/niagara-cruise-tickets-dashboard-webhook', webhookController.handleNiagaraCruiseTicketsWebhook);
router.post('/fort-sumter-ticketing-dashboard-webhook', webhookController.handleFortSumterTicketingWebhook);
router.post('/kennedy-space-center-ticketing-dashboard-webhook', webhookController.handleKennedySpaceCenterTicketingWebhook);

module.exports = router;
