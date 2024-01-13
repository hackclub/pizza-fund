const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const express = require('express');

const keyfile = path.join(__dirname, 'credentials.json');
const keys = JSON.parse(fs.readFileSync(keyfile));
const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// Create an oAuth2 client to authorize the API call
const client = new google.auth.OAuth2(
  keys.web.client_id,
  keys.web.client_secret,
  keys.web.redirect_uris[0]
);

// Generate the url that will be used for authorization
this.authorizeUrl = client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
});

// Open an http server to accept the oauth callback. In this
// simple example, the only request to our webserver is to
// /oauth2callback?code=<code>
const app = express();
app.get('/oauth2callback', (req, res) => {
  const code = req.query.code;
  client.getToken(code, (err, tokens) => {
    if (err) {
      console.error('Error getting oAuth tokens:');
      throw err;
    }
    client.credentials = tokens;
    res.send('Authentication successful! Please return to the console.');
    server.close();
    listMajors(client);
  });
});

const server = app.listen(3001, () => {
  // open the browser to the authorize url to start the workflow
  opn(this.authorizeUrl, {wait: false});
});



// const sheets = google.sheets({
//   version: 'v4',
//   auth: process.env.GOOGLE_API_KEY
// })

// const isBlacklisted = async (userID, email, club) => {

//   // fetch the list of blacklisted emails from the airtable base as an array. If the user's email is not in the array, return false
//   function getValues(spreadsheetId, range, callback) {
//     try {
//       sheets.spreadsheets.values.get({
//         spreadsheetId: spreadsheetId,
//         range: range,
//       }).then((response) => {
//         const result = response.data;
//         const numRows = result.values ? result.values.length : 0;
//         console.log(`${numRows} rows retrieved.`);
//         if (callback) callback(response);
//       });
//     } catch (err) {
//       document.getElementById('content').innerText = err.message;
//       return;
//     }
//   }

// // check for blacklisted slackUserIDs
//   getValues('1Y-LN7DENenxxl-uNUbOz62aWwDmAo_yPhMuL445FHvE', 'Pizza Blacklist!B2:B', (response) => {
//     const values = response.data.values;

//     // set the list of blacklisted emails to a variable
//     let userIDBlacklisted = values.map(record => record[0]);

//     if (userIDBlacklisted.includes(userID)) {
//       return {
//       blacklisted: true,
//       reason: "Slack User"
//       }
//     } else {
//       return {
//       blacklisted: false,
//       reason: "Slack User"
//       }
//     }
//   }
// );


//   // check for blacklisted emails
//   getValues('1Y-LN7DENenxxl-uNUbOz62aWwDmAo_yPhMuL445FHvE', 'Pizza Blacklist!C2:C', (response) => {
//     const values = response.data.values;

//     // set the list of blacklisted emails to a variable
//     let emailBlacklisted = values.map(record => record[0]);

//     if (emailBlacklisted.includes(email)) {
//       return {
//       blacklisted: true,
//       reason: "Email"
//       }
//     } else {
//       return {
//       blacklisted: false,
//       reason: "Email"
//       }
//      }
//   }
// );


// // check blacklisted clubs
//  getValues('1Y-LN7DENenxxl-uNUbOz62aWwDmAo_yPhMuL445FHvE', 'Pizza Blacklist!D2:D', (response) => {
//     const values = response.data.values;

//     // set the list of blacklisted emails to a variable
//     let gblacklisted = values.map(record => record[0]);

//     if (gblacklisted.includes(club)) {
//       return {
//       blacklisted: true,
//       reason: "Club"
//       }
//     } else {
//       return {
//       blacklisted: false,
//       reason: "Club"
//       }
//      }
//   }
//   );
// };

module.exports = isBlacklisted;