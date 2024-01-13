const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: "https://www.googleapis.com/auth/spreadsheets",
});

const isBlacklisted = async (userID, email, club) => {

const client = await auth.getClient();

const googleSheets = google.sheets({ version: "v4", auth: client });

const spreadsheetId = '1Y-LN7DENenxxl-uNUbOz62aWwDmAo_yPhMuL445FHvE';

const getSlackRows = await googleSheets.spreadsheets.values.get({
  auth,
  spreadsheetId,
  range: "Pizza Blacklist!B2:B",
});

const getEmailRows = await googleSheets.spreadsheets.values.get({
  auth,
  spreadsheetId,
  range: "Pizza Blacklist!C2:C",
});

const getClubRows = await googleSheets.spreadsheets.values.get({
  auth,
  spreadsheetId,
  range: "Pizza Blacklist!D2:D",
});

// set Slacks var to an array of slackUserIDs
const slacks = getSlackRows.data.values.map(record => record[0]);
const emails = getEmailRows.data.values.map(record => record[0]);
const clubs = getClubRows.data.values.map(record => record[0]);


// check if the user is blacklisted
if (slacks.includes(userID)) {
  return {
    blacklisted: true,
    reason: "Slack User"
  }
} else if (emails.includes(email)) {
  return {
    blacklisted: true,
    reason: "Email"
  }
}
else if (clubs.includes(club)) {
  return {
    blacklisted: true,
    reason: "Club"
  }
}
else {
  return {
    blacklisted: false,
    reason: "Not Blacklisted"
  }
}

};

module.exports = isBlacklisted;