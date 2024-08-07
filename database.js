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

async function getUserById(id) {
  const db = await connect();
  const user = await db.collection('User').findOne({ _id: new ObjectId(id) });
  return user;
}



async function addUser(user){
  const db = await connect();
  user.role = ['developer'];
  const result = await db.collection("User").insertOne(user);
  //debugDatabase(result.insertId)
  return result;
}

async function loginUser(user){
  const db = await connect();
  const resultUser = await db.collection("User").findOne({email: user.email});
 return resultUser;
}

async function updateUser(user){
  const db = await connect();
  const result = await db.collection("User").updateOne({_id:user._id},{$set:{...user}});
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

async function closeBug(id, closedBug) {
    const db = await connect();
    const result = await db.collection("Bug").updateOne({ _id: new ObjectId(id)},{ $set:{...closedBug}});
    console.table(result);
    return result;
  
}

async function assignBug(id, assignedBug){
  const db = await connect();
  const result = await db.collection("Bug").updateOne({_id: new ObjectId(id)},{$set:{...assignedBug}});
  console.table(result);
  return result;
}

async function commentNewBug(bugId, email, comment) {
  try {
    const db = await connect(); // Assuming you have a function to connect to the database
    const collection = db.collection('Bug');

    // Use findOneAndUpdate to atomically update the document
    const currentDate = new Date();
    const commentObjectId = new ObjectId();
    const randomUserId = new ObjectId();

    const newComment = {
      _id: commentObjectId,
      comment,
      email, // Use the provided email parameter
      createdAt: currentDate.toISOString(),
      userId: randomUserId,
    };

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(bugId) },
      {
        $push: { comments: newComment },
        $set: { lastUpdated: currentDate.toISOString() },
      },
      { returnDocument: 'after' } // Return the updated document
    );

    if (!result.value) {
      return { status: 404, json: { error: `Bug ${bugId} not found` } };
    }

    return { status: 200, json: { message: `Comment added to bug ${bugId}` } };
  } catch (error) {
    console.error(error);
    return { status: 500, json: { error: 'Internal server error' } };
  }
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
    const comment = bug.comments.find((comment) => comment._id.toString() === commentId);

    return comment; //return the comment object

  }else{
    return null;
  }

  }catch(err){
    throw err;
  }

}

async function testCaseNewBug(bugId, userId, version, req) {
  try {
    // Ensure user is logged in
    if (!req.auth) {
      return { status: 401, json: { error: 'Unauthorized. User not logged in.' } };
    }

    const db = await connect();
    const collection = db.collection('Bug');

    const bug = await collection.findOne({ _id: new ObjectId(bugId) });

    if (!bug) {
      return { status: 404, json: { error: `Bug ${bugId} not found` } };
    }

    // Ensure bug.testCases is initialized as an array
    if (!bug.testCases) {
      bug.testCases = [];
    }

    const createdBy = new ObjectId(req.auth.userId);
    const createdOn = new Date();

    const newTestCase = {
      testId: new ObjectId(),
      userId: createdBy,
      passed: true,
      createdOn: createdOn,
      version: version,
      appliedOnDate: new Date(),
    };

    bug.testCases.push(newTestCase);

    await collection.updateOne({ _id: new ObjectId(bugId) }, { $set: { testCases: bug.testCases } });

    const editsCollection = db.collection('Edit');
    const changeRecord = {
      timestamp: new Date(),
      col: 'testCases',
      op: 'create',
      target: { bugId: new ObjectId(bugId) },
      update: { testCases: bug.testCases },
      auth: req.auth,
    };

    await editsCollection.insertOne(changeRecord);

    return { status: 200, json: { message: `Test Case added to bug ${bugId}` } };
  } catch (err) {
    return { status: 500, json: { error: err.stack } };
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
    const specificTestCase = bug.testCases.find((testCases) => testCases.testId.toString() === testCaseId);
    return specificTestCase;
  }else{
    return null;
  }
}


async function deleteTestCase(bugId, testCaseId) {
  const db = await connect();
  const collection = db.collection('Bug');
  const editsCollection = db.collection('Edit');

  try {
    console.log(`Deleting test case from bug ${bugId} and test case ${testCaseId}`);

    const filter = {
      _id: new ObjectId(bugId),
      'testCases.testId': new ObjectId(testCaseId),
    };

    console.log('Filter:', filter);

    const update = {
      $pull: {
        testCases: {
          testId: new ObjectId(testCaseId),
        },
      },
    };
    if (!req.auth) {
      return { status: 401, json: { error: 'Unauthorized. User not logged in.' } };
    }
    console.log('Update:', update);

    const result = await collection.updateOne(filter, update);

    console.log('Result:', result);

    if (result.modifiedCount === 1) {
      console.log('Test case deleted');

      const editRecord = {
        timestamp: new Date(),
        col: 'bug',
        op: 'delete',
        target: { bugId: new ObjectId(bugId) },
        update: update,
        // Auth information needs to come from the authentication middleware
      };

      const editResult = await editsCollection.insertOne(editRecord);

      console.log('Edit result added to collection:', editResult);
      return { status: 204, json: { message: `Test Case deleted from bug ${bugId}` } };
    } else {
      console.log('Test case not found');
      return { status: 404, json: { error: `Test case ${testCaseId} not found` } };
    }
  } catch (err) {
    console.error(err.stack);
    return { status: 500, message: 'Internal Server Error' };
  }
}



async function updateTestCaseByBugId(bugId, testCaseId, version,updatedFields, auth) {
  const db = await connect();
  const collection = db.collection('Bug');
  const editsCollection = db.collection('Edit');

  try {
    const bug = await collection.findOne({ _id: new ObjectId(bugId) });
    if (!bug) {
      return { status: 404, json: { error: `Bug ${bugId} not found` } };
    }

    // Ensure bug.testCases is initialized as an array
    if (!bug.testCases) {
      bug.testCases = [];
    }

    const testCaseIndex = bug.testCases.findIndex((testCase) => testCase.testId.toString() === testCaseId);
    if (testCaseIndex === -1) {
      return { status: 404, json: { error: `Test case ${testCaseId} not found` } };
    }

    bug.testCases[testCaseIndex].lastUpdatedOn = new Date();
    bug.testCases[testCaseIndex].lastUpdatedBy = auth;
    bug.testCases[testCaseIndex].version = version;

    for (const key in updatedFields) {
      if (updatedFields.hasOwnProperty(key)) {
        bug.testCases[testCaseIndex][key] = updatedFields[key];
      }
    }

    await collection.updateOne({ _id: new ObjectId(bugId) }, { $set: { testCases: bug.testCases } });

    const editRecord = {
      timestamp: new Date(),
      col: 'testCases',
      op: 'update',
      target: { bugId: new ObjectId(bugId), testCaseId: new ObjectId(testCaseId) },
      update: updatedFields,
      auth: auth,
    };

    await editsCollection.insertOne(editRecord);

    const updatedBug = bug;
    
    return { success: true, message: 'Test case fields updated successfully' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Internal Server Error' };
  }
}

async function saveEdit(edit){
  const db = await connect();
  const result = await db.collection("Edit").insertOne(edit);
  return result;
}


async function findRoleByName(name){
  const db = await connect();
  const role = await db.collection("Role").findOne({name: name});
  return role;
}


// export functions
export {newId,connect,ping,getUsers,getUserById,addUser,loginUser,updateUser,deleteUser,getBugs,getBugById,addBug,updateBug,classifyBug,closeBug,assignBug,commentNewBug,commentBugList,commentBugId, testCaseNewBug, findTestCasesByBugId, findSpecificTestCaseByBugId, deleteTestCase, updateTestCaseByBugId,findRoleByName, saveEdit};

// test the database connection
ping();
 

