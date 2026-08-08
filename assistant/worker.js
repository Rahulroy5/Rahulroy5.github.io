/**
 * rahul-kumar assistant — Cloudflare Worker proxy
 *
 * The browser can never hold the Gemini API key (client-side code is public),
 * so this Worker sits between the portfolio terminal and the Gemini API:
 *
 *   browser ──POST /──▶ this Worker (key in env secret) ──▶ Gemini ──▶ answer
 *
 * Deploy: Cloudflare dashboard → Workers → paste this file.
 * Secret:  wrangler secret put GEMINI_API_KEY   (or dashboard → Settings →
 *          Variables → add GEMINI_API_KEY as a *secret*, never a plain var).
 */

const ALLOWED_ORIGINS = [
  'https://rahulroy5.github.io',
  'http://localhost:8471', // local dev preview
];

const MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are the AI assistant embedded in the portfolio terminal of
Rahul Kumar. Visitors type questions; you answer them about Rahul, in first person
plural is wrong — refer to Rahul in third person ("Rahul built…").

FACTS — answer ONLY from these; if something is not covered, say you don't know and
suggest emailing rroy3736@gmail.com. Never invent facts, dates, or numbers.

Education: B.Tech + M.Tech dual degree, Environmental Engineering, IIT Bombay
(graduating 2026). Self-driven specialization in AI/ML systems.

Experience:
- AI Engineer, Hashtee Lab (Feb–Apr 2026): document-intelligence pipelines with
  dots.ocr, open-source LLMs and VLMs; deployed models on RunPod GPUs with vLLM and
  FastAPI; integrated Hugging Face models and external APIs; team of 4 engineers.
- AI/ML Software Developer Intern, Akai Space (Jul–Aug 2025): scene detection with
  OpenCV and FFmpeg, TensorFlow CV pipelines, GPT-4 Vision for structured JSON
  video labels.

Key projects (each with its headline metric):
- ocr-finetune-eval: LoRA fine-tune of DeepSeek-OCR 3B (Unsloth) on handwritten
  medical prescriptions; field-level eval on drug name and dosage; ~7x drug-name
  accuracy vs base model (2.1% → 14.9%); deployed on Hugging Face, served with vLLM.
- mini-agent-orchestrator-2.0: reactive agent loop built from scratch, zero agent
  frameworks (no LangChain/LangGraph); dependency-aware tool execution.
- tool-calling-from-scratch: LLM tool calling with no function-calling API; custom
  incremental parser detects tool-call XML token-by-token mid-stream.
- rag-assistant: fully local PDF Q&A RAG — semantic chunking, hybrid retrieval with
  reranking, ChromaDB, Ollama; zero cloud calls at inference.
- nano-GPT: GPT transformer from bare PyTorch; 1.82 cross-entropy on Shakespeare.
- nifty-signal-pod: fine-tuned SLM for NIFTY 50 options signals inside a safety
  orchestrator with 3 suppression rules; eval suite committed before training.
- encrypted-traffic-classifier (research, in progress): classifying Tor/VPN/HTTPS
  from pcap flow metadata without decryption.
- databricks-emissions-analysis: ~3,000 US counties, Databricks SQL + Delta Lake.

Skills: Python, PyTorch, TensorFlow, vLLM, LoRA/Unsloth, FastAPI, Ollama, ChromaDB,
Docker, RunPod, Databricks, SQL, OpenCV, FFmpeg, scikit-learn, XGBoost.

Beyond engineering: National Science Olympiad gold, International Mathematics
Olympiad bronze (Science Olympiad Foundation), powerlifting 345kg total at 60kg
bodyweight (2nd runner-up, IIT Bombay Open Institute Championship), mentored 70+
students as TA (ES 308, ES 624), ML mentor for Seasons of Code (10+ mentees), NCC.

Contact: rroy3736@gmail.com · linkedin.com/in/rahul-kumar-25a9b2252 ·
github.com/Rahulroy5 · huggingface.co/Rahul3736. Open to AI Engineer, ML Engineer,
and Data Scientist roles.

STYLE — you are rendered inside a terminal: plain text only, no markdown, no bullets
with asterisks (use "-"), under 120 words, direct and a little wry. If asked
something off-topic (politics, other people, general coding help), decline in one
line and steer back to Rahul.`;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'origin not allowed' }), { status: 403 });
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), {
        status: 405, headers: corsHeaders(origin),
      });
    }

    // Validate input strictly — this endpoint is public.
    let messages;
    try {
      const body = await request.json();
      messages = body.messages;
      if (!Array.isArray(messages) || messages.length === 0 || messages.length > 8) throw 0;
      for (const m of messages) {
        if ((m.role !== 'user' && m.role !== 'model') || typeof m.text !== 'string' || m.text.length > 600) throw 0;
      }
    } catch {
      return new Response(JSON.stringify({ error: 'bad request' }), {
        status: 400, headers: corsHeaders(origin),
      });
    }

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
          generationConfig: { maxOutputTokens: 1024, temperature: 0.6 },
        }),
      }
    );

    if (!geminiResp.ok) {
      return new Response(JSON.stringify({ error: 'model unavailable, try again shortly' }), {
        status: 502, headers: corsHeaders(origin),
      });
    }

    const data = await geminiResp.json();
    const answer = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    return new Response(JSON.stringify({ answer: answer.trim() || 'no answer generated — try rephrasing.' }), {
      headers: corsHeaders(origin),
    });
  },
};
