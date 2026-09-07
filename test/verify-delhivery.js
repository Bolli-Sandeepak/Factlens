async function verifyDelhivery() {
  console.log('Loading Delhivery starter dataset...');
  const res = await fetch('http://localhost:3000/api/demo/load-delhivery', { method: 'POST' }).then(r => r.json());
  console.log('Load message:', res.message);
  console.log('Documents processed:', res.documents?.length);

  console.log('\n--- System Statistics ---');
  const stats = await fetch('http://localhost:3000/api/stats').then(r => r.json());
  console.log('Stats:', JSON.stringify(stats, null, 2));

  console.log('\n--- Cross-Document Relationships ---');
  const rels = await fetch('http://localhost:3000/api/relationships').then(r => r.json());
  console.log('Total Relationships:', rels.length);

  rels.forEach((r, idx) => {
    console.log(`\n[${idx + 1}] Classification: ${r.classification} | Predicate: ${r.factA.predicate}`);
    console.log(`    Doc A: ${r.factA.documentFilename} (Page ${r.factA.page})`);
    console.log(`      Value: "${r.factA.value}" (Period: ${r.factA.period}, Scope: ${r.factA.scope})`);
    console.log(`      Evidence: "${r.factA.evidence.substring(0, 90)}..."`);
    console.log(`    Doc B: ${r.factB.documentFilename} (Page ${r.factB.page})`);
    console.log(`      Value: "${r.factB.value}" (Period: ${r.factB.period}, Scope: ${r.factB.scope})`);
    console.log(`      Evidence: "${r.factB.evidence.substring(0, 90)}..."`);
    console.log(`    Reasoning: ${r.reasoning}`);
  });
}

verifyDelhivery().catch(console.error);
