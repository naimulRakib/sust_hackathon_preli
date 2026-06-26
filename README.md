# QueueStorm Investigator

AI/API SupportOps Copilot for Digital Finance  
**SUST CSE Carnival 2026 — Codex Community Hackathon — Online Preliminary**

## Live Endpoint
- **Health:** `GET https://YOUR_VERCEL_URL/api/health`
- **Analyze:** `POST https://YOUR_VERCEL_URL/api/analyze-ticket`

## Tech Stack
- **Runtime:** Node.js + TypeScript on Vercel Serverless Functions
- **AI Model:** Groq `llama-3.3-70b-versatile` (fast, free tier, JSON mode)
- **Validation:** Zod schema validation
- **Testing:** Jest + ts-jest

## Architecture

POST /analyze-ticket
│
▼
[Zod Validation]          ← 400 on schema errors
│
▼
[Rules Engine]            ← 100% deterministic, no AI
computeSignals()          ← transaction matching, case detection,
evidence verdict, routing, safety flags
│
▼
[Groq AI Call]            ← AI fills in text fields using signals as context
llama-3.3-70b             ← system prompt enforces safety rules
│
▼
[Override Layer]          ← Rules engine values override AI for critical fields
(txn_id, verdict,         ← AI cannot override these
case_type, dept,
severity, human_review)
│
▼
[Safety Sanitizer]        ← Post-checks customer_reply and recommended_next_action
checkAndSanitize()        ← Removes any credential requests, refund promises
│
▼
[Zod Response Validate]   ← Ensures output schema matches spec exactly
│
▼
[200 JSON Response]


## AI Approach
The system uses a **rules-first, AI-for-text** architecture:
- **35% Evidence Reasoning score:** Handled entirely by the deterministic rules engine (`lib/rules-engine.ts`). Transaction matching, evidence verdict, and routing are computed with no AI involvement.
- **AI role:** Groq AI only generates the text fields (`agent_summary`, `recommended_next_action`, `customer_reply`) and provides a second-opinion on classification. Critical fields are always overridden by rules.
- **Safety:** A post-processing safety layer (`lib/safety.ts`) scans all AI output and sanitizes unsafe text before it reaches the response.

## Models Used
| Model | Provider | Where it runs | Why chosen |
|-------|----------|---------------|------------|
| `llama-3.3-70b-versatile` | Groq Cloud | Groq API (remote) | JSON mode support, fastest 70B model, free tier, ~1-3s response time |

## Safety Logic
1. **Prompt injection detection:** Regex patterns in `computeSignals()` detect embedded instructions. If detected, the complaint is handled by a static safe response template — AI is never called.
2. **Credential request prevention:** `checkAndSanitize()` scans `customer_reply` for PIN/OTP/password request patterns.
3. **Unauthorized refund prevention:** Patterns like "we will refund" are replaced with safe language.
4. **System prompt enforcement:** Groq system prompt repeats all 4 safety rules explicitly.

## Setup

### Local
```bash
git clone https://github.com/YOUR_USERNAME/queuestorm-investigator
cd queuestorm-investigator
npm install
cp .env.example .env
# Add your GROQ_API_KEY to .env
npm run dev
```

### Vercel Deploy
```bash
npm install -g vercel
vercel login
vercel --prod
vercel env add GROQ_API_KEY  # add your key
```

## Test
```bash
npm test                          # all tests
npm run test:sample               # 10 sample cases
npm run test:edge                 # edge cases and safety
```

## Sample curl
```bash
curl -X POST https://YOUR_URL/api/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TKT-001",
    "complaint": "I sent 5000 taka to a wrong number around 2pm today.",
    "language": "en",
    "channel": "in_app_chat",
    "user_type": "customer",
    "transaction_history": [{
      "transaction_id": "TXN-9101",
      "timestamp": "2026-04-14T14:08:22Z",
      "type": "transfer",
      "amount": 5000,
      "counterparty": "+8801719876543",
      "status": "completed"
    }]
  }'
```

## Known Limitations
- The rules engine uses keyword matching for Bangla, which may miss dialectal variations.
- Transaction matching uses heuristic scoring — edge cases with very vague complaints may fall back to `insufficient_data`.
- Groq free tier has rate limits (~30 req/min). Under evaluation load, responses may occasionally fall back to the rules-only response.
# sust_hackathon_preli
