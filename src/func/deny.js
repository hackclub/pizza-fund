const Airtable = require('airtable');

const pizzaAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appInkSeZFfvW42h8'
)('Submissions')

const deny = (id) => new Promise((resolve, reject) => {
  pizzaAirtable.update(id, { Status: 'Denied' }, (err, record) => {
    if (err) return reject(err);
    return resolve(record.getId());
  });
}
);

module.exports = deny;
