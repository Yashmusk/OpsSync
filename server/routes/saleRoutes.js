const express = require("express");

const {
  getSales,
  createSale,
  updateSale,
} = require("../controllers/saleController");

const router = express.Router();

router.get("/", getSales);
router.post("/", createSale);
// Only payment status can be changed after a sale is recorded
router.patch("/:id", updateSale);

module.exports = router;
