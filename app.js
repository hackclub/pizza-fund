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

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
  'appInkSeZFfvW42h8'
)('Submissions')

const validCountry = country => {
  // Make sure country isn't on blacklist
  country = country.toLowerCase()
  if (blacklist.red.map(c => c.toLowerCase()).includes(country)) return false
  return true
}

const upload = data =>
  new Promise((resolve, reject) => {
    airtable.create(data, (err, record) => {
      if (err) return reject(err)
      return resolve(record.getId())
    })
  })

const approve = id =>
  new Promise((resolve, reject) => {
    airtable.update(
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
          text: `<@${slack}> just got a pizza grant! 🎉`
        }
      }
    ]
  })

  await ack()
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
          text: "Hey, it's Orpheus the pizza delivery dino again... Hate to say this but your pizza grant was not accepted. Please complete your club application at https://apply.hackclub.com/ . If you've already applied, please wait to be onboarded before we can accept your pizza grant. If you have any questions, reach out to <https://hackclub.slack.com/team/U041FQB8VK2|Thomas>. Sworry :/"
        }
      }
    ]
  })
  await ack()
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
              text: `Hey, it's Orpheus the pizza delivery dino! Just received your order. I don't think Hack Club can deliver to ${country}. If you have any questions, reach out to <https://hackclub.slack.com/team/U03M1H014CX|Holly>. Sworry :/`
            }
          }
        ]
      })
    }

    // TODO: Check if they've already applied for a pizza grant and decide if they need to be rejected

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
Club name/venue: ${club}
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
            text: `Oops, there was an error getting your pizza delivered: \`${error.message}\`. If this keeps happening, message <https://hackclub.slack.com/team/U03M1H014CX|Holly>!`
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
            text: `Oops, there was an error getting your pizza delivered: \`${error.message}\`. If this keeps happening, message <https://hackclub.slack.com/team/U03M1H014CX|Holly>!`
          }
        }
      ]
    })
  }
})
;(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000)
  console.log('⚡️ Bolt app is running!')
})()
