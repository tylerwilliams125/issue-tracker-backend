import express from 'express'
const router = express.Router();
import Joi from 'joi';
import{connect,getBugs,getBugById,addBug,updateBug,classifyBug,closeBug,assignBug,commentNewBug,commentBugList,commentBugId, testCaseNewBug, findTestCasesByBugId, findSpecificTestCaseByBugId, deleteTestCase, updateTestCaseByBugId,saveEdit } from '../../database.js';
import debug from 'debug';
import {ObjectId} from 'mongodb';
import { validBody } from '../../middleWare/validBody.js';
import { validId } from '../../middleWare/validId.js';
import { isLoggedIn, hasPermission } from '@merlin4/express-auth';



const debugBug = debug ('app.BugRouter');

router.use(express.urlencoded({extended:false}));

const newBugSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  stepsToReproduce: Joi.string().required(),
  
});

const updateBugSchema = Joi.object({
  title: Joi.string(),
  description: Joi.string(),
  stepsToReproduce: Joi.string(),
});

const classifyBugSchema = Joi.object({
  classification: Joi.string().valid('Low', 'Medium', 'High', 'Critical')
});

const assignBugSchema = Joi.object({
  assignedToUserId: Joi.string().required(),
  assignedToUserName: Joi.string().required(),
});

const closeBugSchema = Joi.object({
  closed: Joi.boolean().required(),
});

const bugCommentSchema = Joi.object({
  
  comment: Joi.string().required()
});

const bugTestCaseSchema = Joi.object({
  version: Joi.string().min(1).max(50).required(),
  passed: Joi.boolean().required(),
});

const commentSchema = Joi.object({
  fullName: Joi.string().required(),
 comment: Joi.string().required(),
});
//works
router.get('/list', isLoggedIn(),hasPermission('canViewData'), async (req, res) => {
  debugBug('Getting Bugs with Additional Search Functionality');

  try {
    const db = await connect();
    const collection = db.collection('Bug');
    const query = {};

    const options = {
      limit: parseInt(req.query.pageSize) || 5,
      skip: (parseInt(req.query.pageNumber) - 1 || 0) * (parseInt(req.query.pageSize) || 5),
    };

    if (req.query.keywords) {
      query.$text = { $search: req.query.keywords };
    }

    if (req.query.classification) {
      query.classification = req.query.classification;
    }

    if (req.query.maxAge) {
      const maxAgeDate = new Date();
      maxAgeDate.setDate(maxAgeDate.getDate() - parseInt(req.query.maxAge));
      query.createdAt = { $gte: maxAgeDate };
    }

    if (req.query.minAge) {
      const minAgeDate = new Date();
      minAgeDate.setDate(minAgeDate.getDate() - parseInt(req.query.minAge));
      query.createdAt = { ...query.createdAt, $lt: minAgeDate };
    }

    if (req.query.closed === 'true' || req.query.closed === 'false') {
      query.closed = req.query.closed === 'true';
    }

    switch (req.query.sortBy) {
      case 'newest':
        options.sort = { createdAt: -1 };
        break;
      case 'oldest':
        options.sort = { createdAt: 1 };
        break;
      case 'title':
        options.sort = { title: 1, createdAt: -1 };
        break;
      case 'classification':
        options.sort = { classification: 1, createdAt: -1 };
        break;
      case 'assignedTo':
        options.sort = { assignedTo: 1, createdAt: -1 };
        break;
      case 'createdBy':
        options.sort = { createdBy: 1, createdAt: -1 };
        break;
      default:
        options.sort = { createdAt: -1 }; // Default sorting by newest
        break;
    }

    const bugs = await collection.find(query, options).toArray();
    res.status(200).json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

//works
router.get('/:bugId', isLoggedIn(), validId('bugId'),hasPermission('canViewData'), async (req, res) => {
  const bugId = req.params.bugId;
  debugBug('Getting Bug by Id');

  try {
    const bug = await getBugById(bugId);

    if (!bug) {
      res.status(404).json({ message: `Bug ${bugId} not found` });
    } else {
      res.status(200).json(bug);
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

//works
router.post('/new', validBody(newBugSchema), isLoggedIn(),hasPermission('canCreateBug'), async (req, res) => {
  try {
    // Ensure that req.auth contains the user's authentication information
    const createdBy = req.auth; // Assuming you have user information in req.auth

    // Create a new bug document with default values
    const newBug = {
      _id: new ObjectId(), // Assuming you have ObjectId imported
      createdAt: new Date(),
      createdBy: createdBy,
      classification: 'unclassified',
      closed: false,
      ...req.body, // Include other bug properties from the request body
    };

    // Add a record to the edits collection to track the changes
    const editRecord = {
      timestamp: new Date(),
      col: 'bug',
      op: 'insert',
      target: { bugId: newBug._id },
      update: newBug,
      auth: req.auth,
    };

    // Add createdOn with the current date
    newBug.createdAt = new Date();

    // Call the addBug function to insert the new bug into the database
    const dbResult = await addBug(newBug);

    // Check if the bug was successfully added
    if (dbResult.acknowledged) {
      // Log the edit
      await saveEdit(editRecord);

      res.status(200).json({ message: `Bug ${newBug.title} added with an id of ${newBug._id}` });
    } else {
      res.status(400).json({ message: `Bug ${newBug.title} not added` });
    }
  } catch (err) {
    console.error('Error adding bug:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



//works
router.put('/:bugId', isLoggedIn(), validBody(updateBugSchema),hasPermission('canEditAnyBug', 'canEditIfAssignedTo','canEditMyBug'), async (req, res) => {
  const bugId = req.params.bugId;

  try {
    // Check if bugId is a valid ObjectId
    if (!ObjectId.isValid(bugId)) {
      return res.status(404).json({ error: `bugId ${bugId} is not a valid ObjectId.` });
    }

    // Ensure that req.auth contains the user's authentication information
    const lastUpdatedBy = req.auth; // Assuming you have user information in req.auth

    // Validate the request data against the schema
    const { error } = updateBugSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details });
    }

    // Construct the update object with only the fields provided in the request
    const updatedFields = { ...req.body };

    // If any fields are updated, update lastUpdatedOn and lastUpdatedBy
    if (Object.keys(updatedFields).length > 0) {
      updatedFields.lastUpdatedOn = new Date();
      updatedFields.lastUpdatedBy = lastUpdatedBy;
    }

    const updateResult = await updateBug(bugId, updatedFields);

    if (updateResult.modifiedCount === 1) {
      // Add a record to the edits collection to track the changes
      const editRecord = {
        timestamp: new Date(),
        col: 'bug',
        op: 'update',
        target: { bugId },
        update: updatedFields,
        auth: req.auth,
      };
      await saveEdit(editRecord);

      res.status(200).json({ message: `Bug ${bugId} updated` });
    } else {
      res.status(400).json({ message: `Bug ${bugId} not updated` });
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

//works
router.put('/:bugId/classify', isLoggedIn(), validBody(classifyBugSchema),hasPermission('canClassifyAnyBug','canEditIfAssignedTo','canEditMyBug'), async (req, res) => {
  const bugId = req.params.bugId;

  // Check if bugId is a valid ObjectId
  if (!ObjectId.isValid(bugId)) {
    return res.status(404).json({ error: `bugId ${bugId} is not a valid ObjectId.` });
  }

  // Ensure that req.auth contains the user's authentication information
  const classifiedBy = req.auth; // Assuming you have user information in req.auth

  // Read the classification data from the request body
  const { classification } = req.body;

  // Validate the request data against the schema
  const { error } = classifyBugSchema.validate({ classification });

  if (error) {
    return res.status(400).json({ error: error.details });
  }

  try {
    // Check if the bug exists
    const existingBug = await getBugById(bugId);

    if (!existingBug) {
      return res.status(404).json({ error: `Bug ${bugId} not found.` });
    }

    // Update the bug document
    const classifiedBug = {
      classification,
      classifiedOn: new Date(),
      classifiedBy,
    };

    const classifyResult = await classifyBug(bugId, classifiedBug);

    if (classifyResult.modifiedCount === 1) {
      // Add a record to the edits collection to track the changes
      const editRecord = {
        timestamp: new Date(),
        col: 'bug',
        op: 'update',
        target: { bugId },
        update: { classifiedOn: classifiedBug.classifiedOn, classifiedBy: classifiedBug.classifiedBy },
        auth: req.auth,
      };
      await saveEdit(editRecord);

      res.status(200).json({ message: 'Bug classified!' });
    } else {
      res.status(400).json({ message: `Bug ${bugId} not classified` });
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.put('/:bugId/assign', isLoggedIn(), validBody(assignBugSchema),hasPermission('canReassignAnyBug','canReAssignIfAssignedTo','canEditMyBug'), async (req, res) => {
  const bugId = req.params.bugId;

  // Check if bugId is a valid ObjectId
  if (!ObjectId.isValid(bugId)) {
    return res.status(404).json({ error: `bugId ${bugId} is not a valid ObjectId.` });
  }

  // Ensure that req.auth contains the user's authentication information
  const assignedBy = req.auth; // Assuming you have user information in req.auth

  // Read the assignedToUserId and assignedToUserName from the request body
  const { assignedToUserId, assignedToUserName } = req.body;

  // Validate the request data against the schema
  const { error } = assignBugSchema.validate({ assignedToUserId, assignedToUserName });

  if (error) {
    return res.status(400).json({ error: error.details });
  }

  try {
    // Check if the bug exists
    const bug = await getBugById(bugId);

    if (!bug) {
      return res.status(404).json({ error: `Bug ${bugId} not found.` });
    }

    // Update the bug's assignedToUserId, assignedToUserName, assignedOn, and lastUpdated fields
    const assignedBug = {
    assignedToUserId,
    assignedToUserName,
    assignedOn: new Date(),
    lastUpdated: new Date()
    };

    const assignResult = await assignBug(bugId, assignedBug);
    // Add a record to the edits collection to track the changes
    if (assignResult.modifiedCount === 1) {
      const editRecord = {
        timestamp: new Date(),
        col: 'bug',
        op: 'update',
        target: { bugId },
        update: { assignedToUserId, assignedToUserName, assignedOn: bug.assignedOn, lastUpdated: bug.lastUpdated },
        auth: req.auth,
      };
      await saveEdit(editRecord);
      res.status(200).json({ message: 'Bug assigned!' });
    }else {
      res.status(400).json({ message: `Bug ${bugId} not assigned` });
    }

    
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.put("/:bugId/close", isLoggedIn(), validBody(closeBugSchema),hasPermission('canCloseAnyBug'), async (req, res) => {
  const bugId = req.params.bugId;

  // Check if bugId is a valid ObjectId
  if (!ObjectId.isValid(bugId)) {
    return res.status(404).json({ error: `bugId ${bugId} is not a valid ObjectId.` });
  }

  // Ensure that req.auth contains the user's authentication information
  const closedBy = req.auth; // Assuming you have user information in req.auth

  // Read the 'closed' value from the request body
  const { closed } = req.body;

  // Validate the request data against the schema
  const { error } = closeBugSchema.validate({ closed });

  if (error) {
    return res.status(400).json({ error: error.details });
  }

  try {
    // Check if the bug exists
    const existingBug = await getBugById(bugId);

    if (!existingBug) {
      return res.status(404).json({ error: `Bug ${bugId} not found.` });
    }

    // Update the bug document
    const closedBug = {
      closed,
      closedOn: closed ? new Date() : null,
      closedBy: closed ? closedBy : null,
    };

    const closeResult = await closeBug(bugId, closedBug);

    if (closeResult.modifiedCount === 1) {
      // Add a record to the edits collection to track the changes
      const editRecord = {
        timestamp: new Date(),
        col: 'bug',
        op: 'update',
        target: { bugId },
        update: { closedOn: closedBug.closedOn, closedBy: closedBug.closedBy },
        auth: req.auth,
      };
      await saveEdit(editRecord);

      res.status(200).json({ message: 'Bug closed!' });
    } else {
      res.status(400).json({ message: `Bug ${bugId} not closed` });
    }
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:bugId/comment/new', isLoggedIn(), validId('bugId'), validBody(bugCommentSchema),hasPermission('canAddComments'), async (req, res) => {
  const { bugId } = req.params;

  // Ensure user is logged in
  if (!req.auth) {
    return res.status(401).json({ error: 'Unauthorized. User not logged in.' });
  }

  const { comment } = req.body; // Extract from req.body
  const email = req.auth; // Extract from req.auth
  try {
    const result = await commentNewBug(bugId, email, comment);

    
      res.status(200).json({ message: `Comment added to bug ${bugId}` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



router.get('/:bugId/comment/list',validId('bugId'),hasPermission('canViewData'),async (req,res) =>{
  const {bugId}  = req.params;

  const result = await commentBugList(bugId);

  if(result.success){
    res.status(200).json(result.comments);
  }else{
    res.status(result.status).json(result.json);
  }

});

router.get('/:bugId/comment/:commentId', isLoggedIn(), validId('bugId'),hasPermission('canViewData'), validId('commentId'), async (req, res) => {
  // Ensure user is logged in
  if (!req.auth) {
    return res.status(401).json({ error: 'Unauthorized. User not logged in.' });
  }

  const { bugId, commentId } = req.params;

  try {
    const comment = await commentBugId(bugId, commentId);

    if (comment) {
      res.json(comment);
    } else {
      res.status(404).json({ error: `Comment ${commentId} not found` });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:bugId/test/new', isLoggedIn(), validId('bugId'), validBody(bugTestCaseSchema),hasPermission('canAddTestCase'), async (req, res) => {
  const { bugId } = req.params;
  const { version } = req.body;

  try {
    const result = await testCaseNewBug(bugId, req.auth?.userId, version, req);
    res.status(result.status).json(result.json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:bugId/test/list',validId('bugId'),hasPermission('canViewData'), async (req,res) =>{
  const { bugId } = req.params;

  try{
   const testCases = await findTestCasesByBugId(bugId);
   res.json(testCases);
  }catch(error){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }

});

router.get('/:bugId/test/:testCaseId',validId('bugId'),validId('testCaseId'),hasPermission('canViewData'), async (req,res) =>{
  const { bugId, testCaseId } = req.params;

  try{
    const testCase = await findSpecificTestCaseByBugId(bugId, testCaseId);

    if(testCase){
      res.json(testCase);
    }else{
      res.status(404).json({error: `Test case ${testCaseId} not found`});
    }
  }catch(err){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }
});  

router.delete('/:bugId/test/:testCaseId', validId('bugId'), validId('testCaseId'), hasPermission('canDeleteTestCase'), async (req, res) => {

  const { bugId, testCaseId } = req.params;
  const updatedFields = {};
 
  try {
    const result = await deleteTestCase(bugId, testCaseId, updatedFields, req);

    if (result.status === 204) {
          const authToken = await issueAuthToken(bug);

          issueAuthCookie(res, authToken);
      // Use the authToken as needed
    } else if (result.status === 404) {
      res.status(result.status).json(result.json);
    } else {
      res.status(500).send('Internal server error');
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }

});


router.put('/:bugId/test/:testCaseId', isLoggedIn(), validId('bugId'), validId('testCaseId'), validBody(bugTestCaseSchema),hasPermission('canEditTestCase'), async (req, res) => {
  try {
    const { bugId, testCaseId } = req.params;
    const { version, ...updatedFields} = req.body;

    // Ensure user is logged in
    if (!req.auth) {
      return res.status(401).json({ error: 'Unauthorized. User not logged in.' });
    }

    const auth = req.auth;

    const updateResult = await updateTestCaseByBugId(bugId, testCaseId, version, updatedFields, auth);

    if (updateResult.success) {
      res.status(200).json({ message: 'Test case fields updated successfully', authToken: updateResult.authToken });
    } else {
      res.status(404).json({ error: updateResult.message });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


export {router as BugRouter};