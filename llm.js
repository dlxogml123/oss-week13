// The only file that talks to the LLM provider.
// The provider, the model and the key come from .env:
//   process.env.LLM_BASE_URL, process.env.LLM_MODEL, process.env.LLM_API_KEY

// TODO P4: make a constant SYSTEM here: the rules for every answer (tone, length, format).
//          Then send it as the first message, before the user's message, in ask().
const SYSTEM = `
  말투: 존댓말(해요체)로 답한다.
  길이: 한 문단, 세 문장 이내로 답한다.
  형식: 목록, 제목, 굵은 글씨 같은 마크다운을 쓰지 않는다.
`;
const SYSTEM_ANALYZE = `
  sentiment는 "positive", "negative", "neutral" 중 하나의 문자열이다.
  score는 1부터 5까지의 정수다.
  summary는 리뷰를 요약한 한 문장의 문자열이다.
`;

// ask("a question")  ->  the model's answer, as a string
export async function ask(question) {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: question }],
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM: HTTP ${res.status}`)
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// chat([{ role: "user", content: "..." }, { role: "assistant", content: "..." }, ...])
//   ->  the model's next answer, as a string
export async function chat(history) {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages: [{ role: "system", content: SYSTEM }, ...history],
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM: HTTP ${res.status}`)
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// analyze("a review")  ->  an object, not a sentence:
//   { sentiment: "positive" | "negative" | "neutral", score: 1..5, summary: "one short sentence" }
// LLM에 텍스트를 보내 감정(sentiment), 점수(score), 요약(summary)을 받아 검증 후 반환
export async function analyze(text) {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_ANALYZE },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM: HTTP ${res.status}`);
  }
  const data = await res.json();

  let parsed;
  try {
    parsed = JSON.parse(data.choices[0].message.content);
  } catch {
    throw new Error("LLM: the answer is not valid JSON");
  }
  const { sentiment, score, summary } = parsed;

  if (!["positive", "negative", "neutral"].includes(sentiment)) {
    throw new Error("LLM: the answer has the wrong shape");
  }
  if (!(Number.isInteger(score) && score >= 1 && score <= 5)) {
    throw new Error("LLM: the answer has the wrong shape");
  }
  if (typeof summary !== "string") {
    throw new Error("LLM: the answer has the wrong shape");
  }
  return { sentiment, score, summary };
}
