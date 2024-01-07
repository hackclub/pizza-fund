// Require the Bolt package (github.com/slackapi/bolt)
const { App } = require('@slack/bolt')
const Airtable = require('airtable')
const blacklist = require('./assets/blacklist.json')
require('dotenv').config()

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true
})

const pizzaAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appInkSeZFfvW42h8'
)('Submissions')


const joinsAirtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appaqcJtn33vb59Au'
)('Join Requests')


const validCountry = country => {
  // Make sure country isn't on blacklist
  country = country.toLowerCase()
  if (blacklist.red.map(c => c.toLowerCase()).includes(country)) return false
  return true
}

const alreadyApplied = email => {
  const records = pizzaAirtable
    .select({
      filterByFormula: `AND({Email} = '${email}', {Accepted} = 'true')`
    })
    .all()
  // if records.length > 0, return true
  if (records.length > 0) { return true } else { return false }
}

const isUniqueIP = email => {
  // fetch the record of the user from the airtable base (by email) then console log the IP address of the user
  const joinRecords = joinsAirtable
    .select({
      filterByFormula: `{Email} = '${email}'`
    })
    .all()

  // set the IP address of the user to a variable
  const userIP = joinRecords[0].get('IP Address')

  // fetch the list of IP addresses from the airtable base as an array
  const ipRecords = joinsAirtable
    .select({
      filterByFormula: `{Email} = '${email}'`
    })
    .all()

  const ipAddresses = ipRecords.map(record => record.get('IP Address'))

  // check if the user's IP address is in the array of IP addresses more than once (if it is, return false)
  if (ipAddresses.includes(userIP)) { return { isUniqueIP: false, userIP } } else { return { isUniqueIP: true, userIP } }

}

const isBlacklisted = async email => {

  // fetch the list of blacklisted emails from the airtable base as an array. If the user's email is not in the array, return false
  function getValues(spreadsheetId, range, callback) {
    try {
      gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
      }).then((response) => {
        const result = response.result;
        const numRows = result.values ? result.values.length : 0;
        console.log(`${numRows} rows retrieved.`);
        if (callback) callback(response);
      });
    } catch (err) {
      document.getElementById('content').innerText = err.message;
      return;
    }
  }


  getValues('1Y-LN7DENenxxl-uNUbOz62aWwDmAo_yPhMuL445FHvE', 'Pizza Blacklist!C2:C', (response) => {

    const values = response.result.values;
    if (values.length > 0) {
      console.log('Emails:');
      values.map((row) => {
        console.log(`${row[0]}`);
      });
    } else {
      console.log('No data found.');
    }
  })

  // set gblacklisted to the array of blacklisted emails
  const gblacklisted = values

  // check if the user's email is in the array of blacklisted emails (if it is, return true)
  if (gblacklisted.includes(email)) { return true } else { return false }
}

const upload = data =>
  new Promise((resolve, reject) => {
    pizzaAirtable.create(data, (err, record) => {
      if (err) return reject(err)
      return resolve(record.getId())
    })
  })

const approve = id =>
  new Promise((resolve, reject) => {
    pizzaAirtable.update(
      id,
      {
        Accepted: true
      },
      (err, record) => {
        if (err) return reject(err)
        return resolve(record.get('Slack ID'))
      }
    )
  })

app.action('accept', async ({ body, action, client, ack, say }) => {
  // Update Airtable and send email
  const slack = await approve(action.value)

  // TODO: Send ticket in appropriate channel
  await client.chat.postMessage({
    channel: 'C05RZ6K7RS5',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<@${slack}> just got a pizza grant! 🎉 🍕`
        }
      }
    ]
  })

  await ack()

  // react to the initial message with a pizza approval delivery emoji
  await client.reactions.add({
    channel: body.channel.id,
    timestamp: body.message.ts,
    name: 'pizza-delivered'
  })

  await say({
    text: 'Approved. Email sent to Hack Club Bank 👍',
    thread_ts: body.message.ts
  })
})

app.action('reject', async ({ body, action, client, ack, say }) => {
  // Send DM to user rejecting their grant :/
  await client.chat.postMessage({
    channel: action.value,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "Hey, it's Orpheus the pizza delivery dino again... Hate to say this but your pizza grant was not accepted. Please complete your club application at https://apply.hackclub.com/. If you've already applied, please wait to be onboarded before we can accept your pizza grant. If you have any questions, reach out to <https://hackclub.slack.com/team/U041FQB8VK2|Thomas>. Sworry :/"
        }
      }
    ]
  })
  await ack()

  // react to the initial message with a bad-pizza emoji
  await client.reactions.add({
    channel: body.channel.id,
    timestamp: body.message.ts,
    name: 'bad-pizza'
  })

  await say({ text: 'Rejected. DM sent to user.', thread_ts: body.message.ts })
})

app.view('pizza_form', async ({ ack, body, view, client, logger }) => {
  await ack()

  const user = body.user.id

  try {
    let val = view.state.values
    let mapped = {}
    for (let obj of Object.values(val)) {
      let key = Object.keys(obj)[0]
      mapped[key] = obj[key].value
    }
    let { email, club, country, why, pizza, pizzaShop } = mapped
    // Make sure country is valid
    let valid = validCountry(country)
    if (!valid) {
      return await client.chat.postMessage({
        channel: user,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hey, it's Orpheus the pizza delivery dino! Just received your order. I don't think Hack Club can deliver to ${country}. If you have any questions, reach out to <https://hackclub.slack.com/team/U03M1H014CX|Thomas>. Sworry :/`
            }
          }
        ]
      })
    }

    let blacklisted = isBlacklisted(email)
    if (blacklisted) {
      return await client.chat.postMessage({
        channel: user,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hey, it's Orpheus the pizza delivery dino! Just received your order. It looks like you're on the pizza blacklist. If you think this is incorrect, please reach out to <https://hackclub.slack.com/team/U03M1H014CX|Thomas>.`
            }
          }
        ]
      })
    }

    let applied = alreadyApplied(email)
    if (applied) {
      return await client.chat.postMessage({
        channel: user,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hey, it's Orpheus the pizza delivery dino! Just received your order. It looks like you've already applied for a pizza grant. If you think this is incorrect, please reach out to <https://hackclub.slack.com/team/U03M1H014CX|Thomas>.`
            }
          }
        ]
      })
    }

    // Submit to Airtable
    const id = await upload({
      'Email': email,
      'Club': club,
      'Country': country,
      'Slack ID': user,
      'Why': why,
      'pizzaShop': pizzaShop,
      'Pizza': pizza || ''
    })

    // Respond to user
    await client.chat.postMessage({
      channel: user,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "Hey, it's Orpheus the pizza delivery dino! Just received your order. Keep an eye out on your inbox in the next couple of days - hcb@hackclub.com will be sending more info regarding pizza!\n\n In the meantime, I gotta go deliver pizza."
          }
        }
      ]
    })

    // Send to approval channel
    await client.chat.postMessage({
      channel: 'C05RZATA3QR',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Hey! Orpheus the pizza delivery dino here! Wanted to drop by and let you know that someone submitted a request for the pizza fund! Their details are:

Slack: <@${user}>
Email: ${email}
IP Address: ${isUniqueIP(email).isUniqueIP ? 'Unique' : `Not unique (${isUniqueIP(email).userIP})`}
Club name/venue: ${club}
Where they are getting pizza: ${pizzaShop}

Country: ${country}
Why they started a club: ${why}
${pizza ? 'And their lovely pizza: ' + pizza : ":/ They didn't make a pizza."}

That's it! Gotta go deliver these pizzas now.`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Accept!',
                emoji: true
              },
              value: id,
              action_id: 'accept'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Reject',
                emoji: true
              },
              value: user,
              action_id: 'reject',
              style: 'danger'
            }
          ]
        }
      ]
    })
  } catch (error) {
    logger.error(error)
    // Let user know there was an error
    await client.chat.postMessage({
      channel: user,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Oops, there was an error getting your pizza delivered: \`${error.message}\`. If this keeps happening, message <https://hackclub.slack.com/team/U041FQB8VK2|Thomas>!`
          }
        }
      ]
    })
  }
})

app.command('/pizza', async ({ ack, body, client, logger, respond }) => {
  await ack()

  try {
    const result = await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        callback_id: 'pizza_form',
        title: {
          type: 'plain_text',
          text: 'Get a pizza grant!'
        },
        submit: {
          type: 'plain_text',
          text: 'Submit'
        },
        blocks: [
          {
            type: 'input',
            element: {
              type: 'email_text_input',
              action_id: 'email',
              placeholder: {
                type: 'plain_text',
                text: 'orpheus@hackclub.com'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Email',
              emoji: true
            }
          },
          {
            type: 'input',
            element: {
              type: 'plain_text_input',
              action_id: 'club',
              placeholder: {
                type: 'plain_text',
                text: 'Happy Hacks High School'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Club/venue name',
              emoji: true
            }
          },
          {
            type: 'input',
            element: {
              type: 'plain_text_input',
              action_id: 'country',
              placeholder: {
                type: 'plain_text',
                text: 'Country'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Which country does your club run in?',
              emoji: true
            }
          },
          {
            type: 'input',
            element: {
              type: 'plain_text_input',
              action_id: 'pizzaShop',
              placeholder: {
                type: 'plain_text',
                text: 'I am going to order from Dominos using Uber Eats'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Where are you going to purchase the group meals for your club meeting from?',
              emoji: true
            },
            hint: {
              type: 'plain_text',
              text: `Keep in mind that your transactions will be public and that you will have to upload receipts for any purchase you make. These funds can only be used for group meals for club meetings.
              `}
          },

          {
            type: 'input',
            element: {
              type: 'plain_text_input',
              multiline: true,
              action_id: 'why',
              placeholder: {
                type: 'plain_text',
                text: "I love pineapple pizza and hosting club meets! It's awesome how every week I get to get together with friends and build awesome open source projects."
              }
            },
            label: {
              type: 'plain_text',
              text: 'Favorite pizza and why you started a club?',
              emoji: true
            }
          },
          {
            type: 'input',
            optional: true,
            element: {
              type: 'url_text_input',
              action_id: 'pizza',
              placeholder: {
                type: 'plain_text',
                text: 'Post your pizza in #cdn and paste that link here!'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Extra credit: draw a pizza!',
              emoji: true
            }
          }
        ],
        type: 'modal'
      }
    })
  } catch (error) {
    logger.error(error)
    // Let user know there was an error
    await respond({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Oops, there was an error getting your pizza delivered: \`${error.message}\`. If this keeps happening, message <https://hackclub.slack.com/team/U041FQB8VK2|Thomas>!`
          }
        }
      ]
    })
  }
}); (async () => {
  // Start your app
  await app.start(process.env.PORT || 3000)
  console.log('⚡️ Bolt app is running!')
})()
