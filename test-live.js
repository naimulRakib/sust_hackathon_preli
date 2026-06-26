const cases = require('./SUST_Preli_Sample_Cases.json').cases;
const URL = 'https://sust-hackathon-preli-blush.vercel.app/analyze-ticket';

async function testCases() {
  console.log('Testing live endpoint...');
  let passed = 0;
  for (let i = 0; i < Math.min(3, cases.length); i++) {
    const c = cases[i];
    console.log(`\nTesting case: ${c.id}`);
    
    const start = Date.now();
    try {
      const response = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c.input)
      });
      
      const time = Date.now() - start;
      console.log(`Status: ${response.status} (${time}ms)`);
      
      if (response.status === 200) {
        const data = await response.json();
        const expected = c.expected_output;
        let match = true;
        
        if (data.relevant_transaction_id !== expected.relevant_transaction_id) {
          console.log(`❌ Mismatch relevant_transaction_id: expected ${expected.relevant_transaction_id}, got ${data.relevant_transaction_id}`);
          match = false;
        }
        if (data.evidence_verdict !== expected.evidence_verdict) {
          console.log(`❌ Mismatch evidence_verdict: expected ${expected.evidence_verdict}, got ${data.evidence_verdict}`);
          match = false;
        }
        if (data.case_type !== expected.case_type) {
          console.log(`❌ Mismatch case_type: expected ${expected.case_type}, got ${data.case_type}`);
          match = false;
        }
        
        if (match) {
          console.log('✅ Core logic matched!');
          passed++;
        }
      } else {
        const text = await response.text();
        console.log(`Error Response: ${text}`);
      }
    } catch (err) {
      console.log(`Fetch failed: ${err.message}`);
    }
  }
  console.log(`\nPassed ${passed}/3 cases tested.`);
}

testCases();
