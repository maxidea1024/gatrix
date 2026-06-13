import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:45300/argus/api/projects/01KN8GSHBJ10JTQ9D0HD60RKFV/analytics/event-names?period=30d');
    console.log('Project 01KN...:', res.data.data.length);
    console.log('First 3:', res.data.data.slice(0, 3));
  } catch (e: any) {
    console.log('Status:', e.response?.status);
    console.log('Data:', e.response?.data);
    console.log('Message:', e.message);
  }
}
test();
