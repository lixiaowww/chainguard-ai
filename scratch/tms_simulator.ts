const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}/api/tms/webhook`;

const scenarioSevere = {
  shipmentId: "SH-2026-Vax908",
  carrier: "ColdChain Express Logistics",
  commodity: "mRNA Vaccine (BioNTech/Pfizer)",
  weightKg: 150,
  cargoValUsd: 45000,
  tempLogs: [
    { time: "2026-06-05T08:00:00Z", temp: 3.5, carrierCustody: false, durationHours: 1 },
    { time: "2026-06-05T09:00:00Z", temp: 4.2, carrierCustody: true, durationHours: 1 },
    { time: "2026-06-05T10:00:00Z", temp: 8.5, carrierCustody: true, durationHours: 1 },
    { time: "2026-06-05T11:00:00Z", temp: 15.0, carrierCustody: true, durationHours: 2 },
    { time: "2026-06-05T13:00:00Z", temp: 24.5, carrierCustody: true, durationHours: 4 }, // Severe heat excursion
    { time: "2026-06-05T17:00:00Z", temp: 12.0, carrierCustody: true, durationHours: 2 },
    { time: "2026-06-05T19:00:00Z", temp: 4.0, carrierCustody: true, durationHours: 1 }
  ]
};

const scenarioMinor = {
  shipmentId: "SH-2026-Fruit512",
  carrier: "Global Reefer Carriers",
  commodity: "Organic Cavendish Bananas",
  weightKg: 12000,
  cargoValUsd: 18000,
  packageCount: 15,
  tempLogs: [
    { time: "2026-06-05T01:00:00Z", temp: 13.0, carrierCustody: true, durationHours: 4 },
    { time: "2026-06-05T05:00:00Z", temp: 16.5, carrierCustody: true, durationHours: 2 }, // Small temp excursion
    { time: "2026-06-05T07:00:00Z", temp: 13.2, carrierCustody: true, durationHours: 6 }
  ]
};

const scenarioPackageDominant = {
  shipmentId: "SH-2026-Wine888",
  carrier: "TransAtlantic Ocean Lines",
  commodity: "Fine Bordeaux Wine (Ocean)",
  weightKg: 10,
  cargoValUsd: 15000,
  packageCount: 10,
  tempLogs: [
    { time: "2026-06-05T01:00:00Z", temp: 22.0, carrierCustody: true, durationHours: 5 }, // Temperature excursion
    { time: "2026-06-05T06:00:00Z", temp: 12.0, carrierCustody: true, durationHours: 5 }
  ]
};

const USER_ID = process.env.USER_ID || null;

async function run() {
  console.log(`Sending mock shipment data to ChainGuard TMS webhook at ${URL}...`);
  if (!USER_ID) {
    console.log('💡 Tip: Specify USER_ID env var to persist simulated audits in Supabase. E.g.:');
    console.log('   USER_ID=your-supabase-user-uuid PORT=3001 npx tsx scratch/tms_simulator.ts');
    console.log('   Running with in-memory fallback...\n');
  }

  try {
    const res1 = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...scenarioSevere, userId: USER_ID })
    });
    
    if (res1.ok) {
      const data = await res1.json();
      console.log('\n✅ Severe Excursion Audit Successful:');
      console.log(JSON.stringify(data.audit, null, 2));
    } else {
      console.error('❌ Failed to trigger severe scenario:', await res1.text());
    }

    const res2 = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...scenarioMinor, userId: USER_ID })
    });

    if (res2.ok) {
      const data = await res2.json();
      console.log('\n✅ Minor Excursion Audit Successful (Weight Limit Dominates):');
      console.log(JSON.stringify(data.audit, null, 2));
    } else {
      console.error('❌ Failed to trigger minor scenario:', await res2.text());
    }

    const res3 = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...scenarioPackageDominant, userId: USER_ID })
    });

    if (res3.ok) {
      const data = await res3.json();
      console.log('\n✅ Package Dominant Excursion Audit Successful (Package Limit Dominates):');
      console.log(JSON.stringify(data.audit, null, 2));
    } else {
      console.error('❌ Failed to trigger package dominant scenario:', await res3.text());
    }

  } catch (err) {
    console.error('Error connecting to backend server:', err);
  }
}

run();
