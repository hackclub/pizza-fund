const Airtable = require('airtable')

const joinsAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appaqcJtn33vb59Au'
)('Join Requests')

const isUniqueIP = async (email) => {
  // fetch the record of the user from the airtable base (by email) then console log the IP address of the user
  const joinRecords = await joinsAirtable
    .select({
      filterByFormula: `{Email} = '${email}'`
    })
    .all()

  // set the IP address of the user to a variable
  const userIP = joinRecords[0].get('IP Address')

  // fetch the list of IP addresses from the airtable base as an array
  const ipRecords = await joinsAirtable
    .select({
      filterByFormula: `{Email} = '${email}'`
    })
    .all()

  const ipAddresses = ipRecords.map((record) => record.get('IP Address'))

  // check if the user's IP address is in the array of IP addresses more than once (if it is, return false)
  if (ipAddresses.includes(userIP)) {
    return { isUniqueIP: false, userIP }
  } else {
    return { isUniqueIP: true, userIP }
  }
}

module.exports = isUniqueIP
