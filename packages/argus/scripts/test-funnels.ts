import axios from 'axios';

axios.post('http://localhost:45300/argus/api/projects/01KN8GSHBJ10JTQ9D0HD60RKFV/analytics/funnels', { 
  events: [{ name: 'item_crafted' }, { name: 'gold_earned' }] 
})
.then(r => console.log(JSON.stringify(r.data, null, 2)))
.catch(e => console.error(e.response?.data || e.message));
