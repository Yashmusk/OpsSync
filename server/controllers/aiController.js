const aiService = require("../services/ai/aiService");
const { sendError } = require("../utils/httpError");

// POST /api/ai/chat  { messages: [{ role: "user" | "assistant", content }] }
const chat = async (req, res) => {
  try {
    const result = await aiService.chat(req.body?.messages, {
      companyId: req.companyId,
      companyName: req.company.name,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error, "The assistant couldn't answer right now");
  }
};

module.exports = { chat };
