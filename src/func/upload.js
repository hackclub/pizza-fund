const Airtable = require('airtable');

const pizzaAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appInkSeZFfvW42h8'
)('Submissions')

const upload = data => new Promise((resolve, reject) => {
  pizzaAirtable.create(data, (err, record) => {
    if (err) return reject(err);
    return resolve(record.getId());
  });
});

module.exports = upload;