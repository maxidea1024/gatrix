import axios from 'axios';

async function run() {
  try {
    const res = await axios.get('http://localhost:45300/argus/api/filters/01KN8GSHBJ10JTQ9D0HD60RKFV');
    console.log("Filters:", res.data);
    
    const res2 = await axios.get('http://localhost:45300/argus/api/performance/01KN8GSHBJ10JTQ9D0HD60RKFV/transactions?period=7d&sort=count&limit=500');
    console.log("Transactions:", res2.data.data.length);
  } catch (err) {
    if (err.response) {
      console.error("HTTP ERROR:", err.response.status, err.response.data);
    } else {
      console.error("ERROR:", err.message);
    }
  }
}

run();
