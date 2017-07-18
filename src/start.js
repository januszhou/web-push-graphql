import {MongoClient, ObjectId} from 'mongodb'
import express from 'express'
import bodyParser from 'body-parser'
import {graphqlExpress, graphiqlExpress} from 'graphql-server-express'
import {makeExecutableSchema} from 'graphql-tools'
import cors from 'cors'

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
