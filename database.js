import * as dotenv from 'dotenv';
dotenv.config();


import { MongoClient, ObjectId } from "mongodb";
import debug from 'debug';
const debugDb = debug('app:database');




/** Generate/Parse an ObjectId */
const newId = (str) => new ObjectId(str);

/** Global variable storing the open connection, do not use it directly. */
let _db = null;

/** Connect to the database */
async function connect() {
  if (!_db) {
    const connectionString ="mongodb+srv://tylerkwilliams125:ASW-G-01@cluster0.mpextes.mongodb.net/?retryWrites=true&w=majority&appName=AtlasApp";
    const dbName = "IssueTracker";
    const client = await MongoClient.connect(connectionString);
    _db = client.db(dbName);
    debugDb('Connected.');
  }
  return _db;
}

/** Connect to the database and verify the connection */
async function ping() {
  const db = await connect();
  await db.command({ ping: 1 });
  debugDb('Ping.');
}

// FIXME: add more functions here
async function getUsers(){
  const db = await connect();
  //MongoSH command to find all books: db.books.find({})
  //find() returns a cursor, which is a pointer to the result set of a query.
  const users = await db.collection("User").find().toArray();

  return users;
}

async function getUserById(id){
  const db = await connect();
  const users = await db.collection("User").findOne({_id: new ObjectId(id)});
  return users;
}


async function addUser(user){
  const db = await connect();
  const result = await db.collection("User").insertOne(user);
  //debugDatabase(result.insertId)
  return result;
}

async function loginUser(user){
  const db = await connect();
  const resultUser = await db.collection("User").findOne({email: user.email});
 return resultUser;
}

async function updateUser(id, updatedUser){
  const db = await connect();
  const result = await db.collection("User").updateOne({_id: new ObjectId(id)},{$set:{...updatedUser}});
  console.table(result);
  return result;
}

async function deleteUser(id){
  const db = await connect();
  const result = await db.collection("User").deleteOne({_id: new ObjectId(id)});
  console.table(result);
  return result;
}

async function getBugs(){
  const db = await connect();
  //find() returns a cursor, which is a pointer to the result set of a query.
  const bugs = await db.collection("Bug").find().toArray();

  return bugs;
}

async function getBugById(id){
  const db = await connect();
  const bugs = await db.collection("Bug").findOne({_id: new ObjectId(id)});
  return bugs;
}

async function addBug(bug){
  const db = await connect();
  const result = await db.collection("Bug").insertOne(bug);
  //debugDatabase(result.insertId)
  return result;
}

async function updateBug(id, updatedBug){
  const db = await connect();
  const result = await db.collection("Bug").updateOne({_id: new ObjectId(id)},{$set:{...updatedBug}});
  console.table(result);
  return result;
}

async function classifyBug(id, classifiedBug){
  const db = await connect();
  const result = await db.collection("Bug").updateOne({_id: new ObjectId(id)},{$set:{...classifiedBug}});
  console.table(result);
  return result;
}

async function assignBug(id, assignedBug){
  const db = await connect();
  const result = await db.collection("Bug").updateOne({_id: new ObjectId(id)},{$set:{...assignedBug}});
  console.table(result);
  return result;
}





// export functions
export {newId,connect,ping,getUsers,getUserById,addUser,loginUser,updateUser,deleteUser,getBugs,getBugById,addBug,updateBug,classifyBug,assignBug};

// test the database connection
ping();
 

