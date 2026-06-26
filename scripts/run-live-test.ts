import { config } from 'dotenv';
config();

import { investigateTicket } from '../lib/investigator';

async function main() {
  const req = {
    ticket_id: "TKT-LANG-01",
    complaint: "Amar 2000 tk payment hoise nai kintu balance kete gese. Ki korbo?",
    language: "mixed",
    user_type: "customer",
    transaction_history: [
      {
        transaction_id: "TXN-BN01",
        timestamp: "2026-04-14T13:30:00Z",
        type: "payment",
        amount: 2000,
        counterparty: "MERCHANT-789",
        status: "failed"
      }
    ]
  };

  console.log("========================================");
  console.log("🚀 SENDING BANGALISH PAYLOAD TO QUEUESTORM INVESTIGATOR");
  console.log("========================================");
  console.log(JSON.stringify(req, null, 2));
  console.log("\n⏳ Waiting for Groq AI to process...");
  
  try {
    const start = Date.now();
    // @ts-ignore
    const response = await investigateTicket(req);
    const end = Date.now();
    
    console.log(`\n✅ RESPONSE RECEIVED (in ${end - start}ms):`);
    console.log("========================================");
    console.log(JSON.stringify(response, null, 2));
  } catch (err) {
    console.error("❌ Error running pipeline:", err);
  }
}

main();
