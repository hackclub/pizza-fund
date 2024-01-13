const Airtable = require('airtable');

const pizzaAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appInkSeZFfvW42h8'
)('Submissions')


const alreadyApplied = async (email) => {
  const records = pizzaAirtable
    .select({
      filterByFormula: `AND({Email} = '${email}', {Accepted} = 'true')`
    })
    .all();
  // if records.length > 0, return true
  if ((await records).length > 0) {
    return true;
  } else {
    return false;
  }
};

module.exports = alreadyApplied;