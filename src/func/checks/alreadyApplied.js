const Airtable = require('airtable');

const pizzaAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appInkSeZFfvW42h8'
)('Submissions')


const alreadyApplied = async (email) => {
  const records = await pizzaAirtable
    .select({
      // filterByFormula: `AND({Email} = '${email}', {Status} = 'Approved')`
      filterByFormula: `AND({Email} = '${email}')`
    })
    .all();

console.log(records)

// check to see if records is an empty array
if (records.length === 0) {
  return false;
} else {
  return true;
}

};

module.exports = alreadyApplied;