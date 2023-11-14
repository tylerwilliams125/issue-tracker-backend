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

async function commentNewBug(bugId, comment, fullName){
  const db = await connect();
  const collection = db.collection("Bug");
  const bug = await collection.findOne({_id: new ObjectId(bugId)});

  if(!bug){
    return {status : 404, json: {error: `Bug ${bugId} not found`}};
  }

  if (typeof comment !== 'string' || typeof fullName !== 'string') {
    return {status : 400, json: {error: `invalid comment or fullName`}};
  }

  const currentDate = new Date();
  const commentObjectId = new ObjectId(); // Generate a new ObjectId for the comment
  const randomUserId = new ObjectId(); // generate a random ObjectId for the userId

  const newComment = {
    _id: commentObjectId,
    comment,
    fullName,
    createdAt: currentDate.toISOString(),
    userId: randomUserId
  };
  
  await collection.updateOne({_id: new ObjectId(bugId)}, {$push: {comments: newComment}}, {$set: {lastUpdated: currentDate.toISOString()} });

  return {status : 200, json: {message: `Comment added to bug ${bugId}`}}
}

async function commentBugList(bugId){
  const db = await connect();
  const collection = db.collection("Bug");
  try{
    const bug = await collection.findOne({_id: new ObjectId(bugId)});

    if(!bug){
      return {success : false, error: `Bug ${bugId} not found`};
    }

    return {success : true, comments: bug.comments};
  }catch(err){
    return {success : false, error: err.stack};
}
}

async function commentBugId(bugId, commentId){
  const db = await connect();
  const collection = db.collection("Bug");

  try{
  // Find the bug with the given bugId
  const bug = await collection.findOne({_id: new ObjectId(bugId)});

  if (bug) {
    //find the specific comment with the given commentId
    const commment = bug.comments.find((comment) => comment._id.toString() === commentId);

    return comment; //return the comment object

  }else{
    return null;
  }

  }catch(err){
    throw err;
  }

}

  async function testCaseNewBug(bugId, userId, version, req){
    try{
      const db = await connect();
      const collection = db.collection("Bug");

      const bug = await collection.findOne({_id: new ObjectId(bugId)});

      if (!bug) {
        return {status : 404, json: {error: `Bug ${bugId} not found`}};
      }
      const createdBy = new ObjectId(req.auth?.userId);


      const newTestCase = {
        testId: new ObjectId(),
        userId: createdBy,
        passed: true,
        createdOn: new Date(),
        version: version,
        appliedOnDate: new Date(),
      };

      bug.testCases.push(newTestCase);

      await collection.updateOne({_id: new ObjectId(bugId)}, {$set: {testCases: bug.testCases}});
      const editsCollection = db.collection('Edits');
      const changeRecord = {
        timestamp: new Date(),
        col: 'testCases',
        op: 'create',
        target: {bugId: new ObjectId(bugId)},
        update: {testCases: bug.testCases},
        auth: req.auth};
      
      await editsCollection.insertOne(changeRecord);
      return {status : 200, json: {message: `Test Case added to bug ${bugId}`}}

    }catch(err){
      return {status : 500, json: {error: err.stack}};
    }
}

async function findTestCasesByBugId(bugId){
  const db = await connect();
  const collection = db.collection("Bug");
  const bug = await collection.findOne({_id: new ObjectId(bugId)});

  if (bug) {
    return bug.testCases;
  }else{
    return null;
  }
}

async function findSpecificTestCaseByBugId(bugId, testCaseId){
  const db = await connect();
  const collection = db.collection("Bug");
  const bug = await collection.findOne({_id: new ObjectId(bugId)});

  if (bug) {
    const specificTestCase = bug.testCases.find((testCase) => testCase.testId.toString() === testCaseId);
    return specificTestCase;
  }else{
    return null;
  }
}


async function deleteTestCase(bugId, testCaseId, auth){
  const db = await connect();
  const collection = db.collection("Bug");
  const editsCollection = db.collection('Edits');

  try{
    console.log(`Deleting test case from bug ${bugId} and test case ${testCaseId}`);

    const filter = {
      _id: new ObjectId(bugId),
      'testCases.testId': new ObjectId(testCaseId)
    };

    console.log('Filter:', filter);
    
    const update = {
      $pull: {
        testCases: {
          testId: new ObjectId(testCaseId)
        }
      }
    };

    console.log('Update:', update);

    const result = await collection.updateOne(filter, update);

    console.log('Result:', result);
    
    if (result.modifiedCount === 1) {
      console.log('Test case deleted');


      const editRecord = {
        timestamp : new Date(),
        col: 'bug',
        op: 'delete',
        target: {bugId: new ObjectId(bugId)},
        update: updatedFields, 
        auth: req.auth 
      };

      const editResult = await editsCollection.insertOne(editRecord);

      console.log('Edit result added to collection:', editResult);
      return {status : 204, json: {message: `Test Case deleted from bug ${bugId}`}}
    }else{
      console.log('Test case not found');
      return {status : 404, json: {error: `Test case ${testCaseId} not found`}}
    }

    

  }catch(err){
    console.error(err.stack);
    return {status : 500, message: 'Internal Server Error'};
  }

}


async function updateTestCaseByBugId(bugId, testCaseId, version, updatedTestCase, auth){
  const db = await connect();
  const collection = db.collection("Bug");
  const editsCollection = db.collection('Edits'); 

  try{

    const bug = await collection.findOne({_id: new ObjectId(bugId)});
    if (!bug) {
      return {status : 404, json: {error: `Bug ${bugId} not found`}};
    }

    const testCaseIndex = bug.testCases.findIndex((testCase) => testCase.testId.toString() === testCaseId);
    if (testCaseIndex === -1) {
      return {status : 404, json: {error: `Test case ${testCaseId} not found`}};
    }

    bug.testCases[testCaseIndex].lastUpdatedOn = new Date();
    bug.testCases[testCaseIndex].lastUpdatedBy = auth;

    for (const key in fieldsToUpdate){
      if (fieldsToUpdate.hasOwnProperty(key)) {
        bug.testCases[testCaseIndex][key] = fieldsToUpdate[key];
      }
    }

    await collection.updateOne({_id: new ObjectId(bugId)}, {$set: {testCases: bug.testCases}});

    const editRecord = {
      timestamp : new Date(),
      col: 'bug',
      op: 'update',
      target: {bugId},
      update: fieldsToUpdate,
      auth: auth 
    };

    await editsCollection.insertOne(editRecord);

    const updatedBug = bug;
    const authToken = issueAuthTokenBug(updatedBug);

    return {success: true, message: 'Test case fields updated successfully', authToken};
  }catch(error){
    console.error(error);
    return {success: false, message: 'Internal Server Error'};  

  }

}


async function findRoleByName(name){
  const db = await connect();
  const collection = db.collection("Role");
  const role = await collection.findOne({name: name});
  return role;
}
// export functions
export {newId,connect,ping,getUsers,getUserById,addUser,loginUser,updateUser,deleteUser,getBugs,getBugById,addBug,updateBug,classifyBug,assignBug,commentNewBug,commentBugList,commentBugId, testCaseNewBug, findTestCasesByBugId, findSpecificTestCaseByBugId, deleteTestCase, updateTestCaseByBugId,findRoleByName};

// test the database connection
ping();
 

