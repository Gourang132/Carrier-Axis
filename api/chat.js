export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages, system, max_tokens } = req.body;

  // Convert Anthropic-style system prompt to Groq format
  const groqMessages = [
    { role: "system", content: system },
    ...messages,
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: max_tokens || 1000,
      messages: groqMessages,
    }),
  });

  const data = await response.json();

  // Return in Anthropic-compatible format so App.jsx works unchanged
  const text = data.choices?.[0]?.message?.content || "Something went wrong — please try again.";
  res.status(200).json({ content: [{ text }] });
}
