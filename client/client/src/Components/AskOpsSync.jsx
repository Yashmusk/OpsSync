import { useEffect, useRef, useState } from "react";
import { Database, Send, Sparkles, Trash2 } from "lucide-react";
import { apiRequest } from "../api";

const SUGGESTIONS = [
  "Summarise my sales this month",
  "Compare this month's sales with last month",
  "Which follow-ups are overdue?",
  "What are customers complaining about?",
  "What do I need to restock?",
];

const TOOL_LABELS = {
  get_sales_summary: "Sales",
  get_follow_ups: "Follow-ups",
  get_feedback: "Feedback",
  get_inventory: "Inventory",
  get_customers: "Customers",
  get_customer_details: "Customer details",
  get_activities: "Activities",
};

function describeTool({ name, args }) {
  const label = TOOL_LABELS[name] || name;
  const parts = [];
  if (args?.start_date || args?.end_date) {
    parts.push(`${args.start_date || "…"} → ${args.end_date || "today"}`);
  }
  if (args?.group_by && args.group_by !== "none") parts.push(`by ${args.group_by.replace("_", " ")}`);
  if (args?.name) parts.push(args.name);
  if (args?.status) parts.push(args.status);
  return parts.length ? `${label} (${parts.join(", ")})` : label;
}

// Render **bold** inside a line without using innerHTML
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

// Minimal formatting: paragraphs, "- " / "* " bullets, and **bold**
function FormattedReply({ text }) {
  const blocks = [];
  let bullets = [];

  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {bullets.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };

  text.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);

    if (bullet) {
      bullets.push(bullet[1]);
    } else {
      flushBullets();
      if (line) {
        const heading = line.replace(/^#+\s*/, "");
        blocks.push(<p key={`p-${blocks.length}`}>{renderInline(heading)}</p>);
      }
    }
  });
  flushBullets();

  return <div className="ai-reply">{blocks}</div>;
}

export default function AskOpsSync() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, sending]);

  const ask = async (question) => {
    const text = question.trim();
    if (!text || sending) return;

    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setError("");
    setSending(true);

    try {
      const result = await apiRequest("/ai/chat", {
        method: "POST",
        body: {
          messages: history.map(({ role, content }) => ({ role, content })),
        },
      });

      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.reply, toolsUsed: result.toolsUsed },
      ]);
    } catch (err) {
      setError(err.message || "The assistant couldn't answer right now.");
      // Remove the unanswered question so it can be asked again
      setMessages((current) => current.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    ask(input);
  };

  return (
    <section className="dashboard-card ai-card" aria-label="Ask OpsSync">
      <div className="card-header card-header-row">
        <div>
          <h3 className="ai-title">
            <Sparkles size={18} />
            Ask OpsSync
          </h3>
          <p>Ask about your sales, customers, stock, follow-ups, or feedback.</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className="fu-icon-button"
            onClick={() => {
              setMessages([]);
              setError("");
            }}
            disabled={sending}
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="ai-suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              className="ai-chip"
              onClick={() => ask(suggestion)}
              disabled={sending}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : (
        <div className="ai-messages" ref={listRef} aria-live="polite">
          {messages.map((message, index) =>
            message.role === "user" ? (
              <div className="ai-message ai-user" key={index}>
                {message.content}
              </div>
            ) : (
              <div className="ai-message ai-assistant" key={index}>
                <FormattedReply text={message.content} />
                {message.toolsUsed?.length > 0 && (
                  <div className="ai-sources">
                    <Database size={12} />
                    Data used: {message.toolsUsed.map(describeTool).join(" · ")}
                  </div>
                )}
              </div>
            )
          )}
          {sending && (
            <div className="ai-message ai-assistant ai-thinking">
              Checking your data<span className="ai-dots" />
            </div>
          )}
        </div>
      )}

      {error && <div className="fu-message fu-error ai-error">{error}</div>}

      <form className="ai-input" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="e.g. How did Amazon sales do this week?"
          maxLength={500}
          disabled={sending}
          aria-label="Ask a question"
        />
        <button
          type="submit"
          className="fu-button fu-button-primary"
          disabled={sending || !input.trim()}
          aria-label="Send question"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
