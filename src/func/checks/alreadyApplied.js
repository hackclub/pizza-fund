const Airtable = require('airtable')

const pizzaAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appInkSeZFfvW42h8'
)('Submissions')

const alreadyApplied = async (Email) => {
  const records = await pizzaAirtable
    // fetch the record of the user from the airtable base (by email) then console log the IP address of the user
    .select({
      filterByFormula: `{Email} = '${Email}'` // Make sure that 'Email' matches the actual field name in your Airtable base
    })
    .all();

  // check to see if records is an empty array
  if (records.length === 0) {
    return false
  } else {
    return true
  }
}

module.exports = alreadyApplied
