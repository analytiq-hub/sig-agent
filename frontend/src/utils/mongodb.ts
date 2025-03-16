// This approach is taken from https://github.com/vercel/next.js/tree/canary/examples/with-mongodb
import { MongoClient } from "mongodb"
 
const env = process.env.ENV || "dev"
// console.log(`ENV: ${env}`)

const mongodbUri = process.env.MONGODB_URI || "mongodb://localhost:27017"


// Parse the URI to handle authentication and database name correctly
const uri = mongodbUri.includes('?') 
  ? mongodbUri.replace('?', `/${env}?`) // Insert database name before query params
  : `${mongodbUri}/${env}`
  
//
// Result should be, for example:
// mongodb//user:pass@host:port/env
// or
// mongodb//user:pass@host:port/env?authSource=admin
//
// The docker mongo user/pass requires authSource, but only for nextjs.
//
// console.log(`MONGODB_URI: ${mongodbUri}`)
// console.log(`uri: ${uri}`)

const options = {}
 
let mongoClient: MongoClient
 
if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClient?: MongoClient
  }
 
  if (!globalWithMongo._mongoClient) {
    globalWithMongo._mongoClient = new MongoClient(uri, options)
  }
  mongoClient = globalWithMongo._mongoClient
} else {
  // In production mode, it's best to not use a global variable.
  mongoClient = new MongoClient(uri, options)
}
 
// Export a module-scoped MongoClient. By doing this in a
// separate module, the client can be shared across functions.
export default mongoClient
