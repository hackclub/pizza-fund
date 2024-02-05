const Airtable = require('airtable')

const pizzaAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
    'appInkSeZFfvW42h8'
)('Submissions')

const getSlackUser = async (recId) => {
    const record = await pizzaAirtable.find(recId)

    return record.fields['Slack ID']
}

module.exports = getSlackUser