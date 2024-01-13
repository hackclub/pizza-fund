const blacklist = require('../../../assets/blacklist.json');

const validCountry = (country) => {
  // Make sure country isn't on blacklist
  country = country.toLowerCase();
  if (blacklist.red.map(c => c.toLowerCase()).includes(country)) return false;
  return true;
};

module.exports = validCountry;