import {MongoClient, ObjectId} from 'mongodb'
import express from 'express'
import bodyParser from 'body-parser'
import {graphqlExpress, graphiqlExpress} from 'graphql-server-express'
import {makeExecutableSchema} from 'graphql-tools'
import cors from 'cors'
import webpush from 'web-push'

// webpush.setGCMAPIKey(''); // optional
webpush.setVapidDetails( // this is required
  'mailto:janus.zhou1005@gmail.com',
  'BJL-Fw-5Ts77YBPCuWCpA7xQIXDlXV_veh6hkIFC5lXwj7WH5wbac_RYHYN4gtjuMfDnBYWgGDA4v7aueurA5ZU',
  'FCagE4TstpK3u1kFqqUi6rzTNg1rEX9w1XiOlXukeOk'
);

const URL = 'http://localhost'
const PORT = 3001
const MONGO_URL = 'mongodb://localhost:27017/web-push'

const prepare = (o) => {
  o._id = o._id.toString()
  return o
}

export const start = async () => {
  try {
    const db = await MongoClient.connect(MONGO_URL)

    const Subscribers = db.collection('subscribers')
    const Pushs = db.collection('pushs')

    const typeDefs = [`
      type Query {
        subscribers(teacher: String): [Subscriber]
      }

      type Subscriber {
        _id: String
        subscription: String
        teacher: String
      }

      type Push {
        _id: String
        payload: String
        teacher: String
      }

      type Mutation {
        createSubscriber(teacher: String, subscription: String): Subscriber
        createPush(teacher: String, payload: String): Push
      }

      schema {
        query: Query
        mutation: Mutation
      }
    `];

    const resolvers = {
      Query: {
        subscribers: async (root, {teacher}) => {
          return (await Subscribers.find({teacher: teacher}).toArray()).map(prepare);
        },
      },
      Mutation: {
        createSubscriber: async (root, args, context, info) => {
          const res = await Subscribers.insert(args)
          return prepare(await Subscribers.findOne(ObjectId(res.insertedIds[0])))
        },
        createPush: async (root, args) => {
          const res = await Pushs.insert(args)
          const push = await Pushs.findOne(ObjectId(res.insertedIds[0]));
          const subscribers = await Subscribers.find({teacher: push.teacher});
          subscribers.forEach((s) => {
            console.log("subscriber details: ", s._id, s.subscription);
            // push notification here, TODO: verify payload
            webpush.sendNotification(JSON.parse(s.subscription), push.payload)
              .then((pushRes) => {
                console.log("push success", pushRes.statusCode, pushRes.body);
              })
              .catch((pushRes) => {
                console.log("push failed", s.subscription, pushRes, pushRes.statusCode, pushRes.body);
              })
          }, (err) => console.log('Error: ', err))
          return prepare(await Pushs.findOne(ObjectId(res.insertedIds[0])))
        },
      },
    }

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    })

    const app = express()

    app.use(cors())

    app.use('/graphql', bodyParser.json(), graphqlExpress({schema}))

    app.use('/graphiql', graphiqlExpress({
      endpointURL: '/graphql'
    }))

    app.listen(PORT, () => {
      console.log(`Visit ${URL}:${PORT}`)
    })

  } catch (e) {
    console.log(e)
  }

}
