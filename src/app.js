const { App } = require('@slack/bolt')
const Airtable = require('airtable')
const Sentry = require('@sentry/node')
const { ProfilingIntegration } = require('@sentry/profiling-node')
require('dotenv').config()

const alreadyApplied = require('./func/checks/alreadyApplied.js')
const isBlacklisted = require('./func/checks/isBlacklisted.js')
const validCountry = require('./func/checks/validCountry.js')
const getSlackUser = require('./func/getSlackUser.js')

const approve = require('./func/approve.js')
const deny = require('./func/deny.js')
const upload = require('./func/upload.js')

let pizzaApprovalChannel
let pizzaPartyChannel

if (process.env.NODE_ENV === "production") {

  pizzaApprovalChannel = "C05RZATA3QR"
  pizzaPartyChannel = "C05RZ6K7RS5"


} else if (process.env.NODE_ENV === "development") {

  pizzaApprovalChannel = "C06CNSA4QHH"
  pizzaPartyChannel = "C06CL2B1WJH"

} else {
  console.log("UNKNOWN ENVIRORMENT")
}


const node_environment = process.env.NODE_ENV

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [new ProfilingIntegration()],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0
})

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true
})

app.action('approve', async ({ body, action, client, ack, say }) => {
  await approve(action.value)

  const sUser = await getSlackUser(action.value)

  await client.chat.postMessage({
    text: `<@${sUser}> just got a pizza grant! 🎉 🍕`,
    channel: pizzaPartyChannel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<@${sUser}> just got a pizza grant! 🎉 🍕`
        }
      }
    ]
  })

  await ack()

  // react to the initial message with a pizza approval delivery emoji
  if (process.env.NODE_ENV === "production") {
    await client.reactions.add({
      channel: body.channel.id,
      timestamp: body.message.ts,
      name: 'pizza-delivered'
    })
  }

  await say({
    text: `:white_check_mark: Approved by <@${body.user.id}> at <!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toLocaleString()}>. Email sent to Jasper for fufillment.`,
    thread_ts: body.message.ts
  })

  let val = await body.message.blocks
  await val.pop()

  await val.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      // grant reject msg with timestamp
      text: `Grant was approved at <!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toLocaleString()}> :white_check_mark:`
    }
  })

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    blocks: val
  })
})

app.action('deny', async ({ body, action, client, ack, say }) => {
  await deny(action.value)

  const sUser = await getSlackUser(action.value)

  // Send DM to user rejecting their grant :/
  await client.chat.postMessage({
    channel: sUser,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "Hey, it's Orpheus the pizza delivery dino again... So sorry, but your pizza grant was not accepted. Please complete your club application at https://apply.hackclub.com/. If you've already applied, please wait to be onboarded before we can accept your pizza grant. If you have any questions, reach out to <mailto:pizza@hackclub.com|pizza@hackclub.com>. Sworry :/"
        }
      }
    ]
  })
  await ack()

  // react to the initial message with a bad-pizza emoji
  if (process.env.NODE_ENV === "production") {
    await client.reactions.add({
      channel: body.channel.id,
      timestamp: body.message.ts,
      name: 'bad-pizza'
    })
  }


  await say({
    text: `:x: Denied by <@${body.user.id}> at <!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toLocaleString()}>. DM was sent to user.`,
    thread_ts: body.message.ts
  })


  let val = await body.message.blocks
  val.pop()

  await val.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      // grant reject msg with timestamp
      text: `Grant was denied at <!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toLocaleString()}> :x:`
    }
  })

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    blocks: val
  })

})

app.view('pizza_form', async ({ ack, body, view, client, logger }) => {
  await ack()

  const user = await body.user.id

  try {
    let val = await view.state.values
    let mapped = {}
    for (let obj of Object.values(val)) {
      let key = Object.keys(obj)[0]
      mapped[key] = obj[key].value
    }
    let { email, club, country, why, pizza, pizzaShop, photograph } = mapped

    let userIsBlacklisted = await isBlacklisted(user, email, club)
    if (userIsBlacklisted.blacklisted == true) {
      return await client.chat.postMessage({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hey, it's Orpheus the pizza delivery dino! Just received your order. It looks like you're on the pizza blacklist.If you think this is incorrect, please reach out to < mailto:pizza @hackclub.com| pizza@hackclub.com>.`
            }
          }
        ]
      })
    }

    let applied = await alreadyApplied(email)
    if (applied) {
      return await client.chat.postMessage({
        channel: user,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hey, it's Orpheus the pizza delivery dino! Just received your order. It looks like you've already applied for or recived a pizza grant.If you think this is incorrect, please reach out to < mailto:pizza @hackclub.com| pizza@hackclub.com>.`
            }
          }
        ]
      })
    }

    // Make sure country is valid
    let valid = await validCountry(country)
    if (!valid) {
      return await client.chat.postMessage({
        channel: user,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hey, it's Orpheus the pizza delivery dino! Just received your order. I don't think Hack Club can deliver to ${country}. If you have any questions, reach out to < mailto:pizza @hackclub.com| pizza@hackclub.com>.Sworry : /`
            }
          }
        ]
      })
    }

    if (country.toLowerCase() == 'india') {
      return await client.chat.postMessage({
        channel: user,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hey, it's Orpheus the pizza delivery dino! Just received your order. Unfortunately, we are unable to deliver to India at this time, while we work internally on some new pizza processes. If you have any questions, reach out to <mailto:pizza@hackclub.com|pizza@hackclub.com>. Sworry :/`
            }
          }
        ]
      })
    }

    // Submit to Airtable
    const id = await upload({
      Email: email,
      Club: club,
      Country: country,
      'Slack ID': user,
      Why: why,
      pizzaShop: pizzaShop,
      Pizza: pizza || '',
      photograph: photograph
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
      text: 'New pizza grant request!',
      channel: pizzaApprovalChannel,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Hey! Orpheus the pizza delivery dino here! Wanted to drop by and let you know that someone submitted a request for the pizza fund! Their details are:

Slack: <@${user}>
Email: ${email}
Club name/venue: ${club}
Where they are getting pizza: ${pizzaShop}

Country: ${country}
Why they started a club: ${why}


And their club: ${photograph}


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
                text: 'Approve!',
                emoji: true
              },
              value: id,
              action_id: 'approve',
              style: 'primary'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Deny',
                emoji: true
              },
              value: id,
              action_id: 'deny',
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
            text: `Oops, there was an error getting your pizza delivered: \`${error.message}\`. If this keeps happening, email <mailto:pizza@hackclub.com|pizza@hackclub.com>!`
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
              `
            }
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
            optional: false,
            element: {
              type: 'url_text_input',
              action_id: 'photograph',
              placeholder: {
                type: 'plain_text',
                text: 'Post your club in #cdn and paste that link here!'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Share a photo of you with your Hack Club',
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
          },
          
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
            text: `Oops, there was an error getting your pizza delivered: \`${error.message}\`. If this keeps happening, message <mailto:pizza@hackclub.com|pizza@hackclub.com>!`
          }
        }
      ]
    })
  }
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000)
  console.log(`⚡️ Bolt app is running in env ${node_environment}! Keep on, pizza on!`)
})()
