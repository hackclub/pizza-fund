const Airtable = require('airtable')

const pizzaAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appInkSeZFfvW42h8'
)('Submissions')

const deny = async (id) => {
  await pizzaAirtable.update(
    [
      {
        "id": id,
        "fields": {
          "Status": "Denied"
        }
      }
    ]
  )
}

module.exports = deny