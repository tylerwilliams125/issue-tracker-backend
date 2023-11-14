import express from 'express'
const router = express.Router();
import {nanoid} from 'nanoid';
import Joi from 'joi';
import{connect,getBugs,getBugById,addBug,updateBug,classifyBug,assignBug,commentNewBug,commentBugList,commentBugId, testCaseNewBug, findTestCasesByBugId, findSpecificTestCaseByBugId, deleteTestCase, updateTestCaseByBugId } from '../../database.js';
import debug from 'debug';
import { validBody } from '../../middleWare/validBody.js';
import { validId } from '../../middleWare/validId.js';

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
  classification: Joi.string().valid('classification1', 'classification2', 'classification3')
});

const assignBugSchema = Joi.object({
  assignedToUserId: Joi.string().required(),
  assignedToUserName: Joi.string().required(),
});

const closeBugSchema = Joi.object({
  closed: Joi.boolean().required(),
});

const bugCommentSchema = Joi.object({
  fullName: Joi.string().required(),
  comment: Joi.string().required()
});

const bugTestCaseSchema = Joi.object({
  version: Joi.string().min(1).max(50).required(),
});

router.get('/list', async (req,res) => {
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

router.get('/:bugId',validId, async (req,res) =>{
    const bugId = req.params.bugId;
    //FIXME: get bug from bugsArray and send response as JSON
    if (!isValidObjectId(bugId)) {
      return res.status(404).json({ error: `bugId ${bugId} is not a valid ObjectId.` });
  }

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

router.post('/new',validBody(newBugSchema), async (req,res) => {
    //FIXME:create a new bug and send response as JSON
    const { title, description, stepsToReproduce } = req.body;

    // Validate the request data against the schema
    const { error } = newBugSchema.validate({ title, description, stepsToReproduce });

    if (error) {
        return res.status(400).json({ error: error.details });
    }

    try {
        const newBug = {
            title,
            description,
            stepsToReproduce,
            createdAt: new Date()
        };

        const result = await addBug(newBug);

        res.status(200).json({ message: 'New Bug Reported!' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }

});

router.put('/:bugId',validBody(updateBugSchema), async (req,res) => {
    //FIXME: update existing bug and send response as JSON
    const bugId = req.params.bugId;

    // Check if bugId is a valid ObjectId
    if (!isValidObjectId(bugId)) {
        return res.status(404).json({ error: `bugId ${bugId} is not a valid ObjectId.` });
    }

    try {
        // Validate the request data against the schema
        const { error } = updateBugSchema.validate(req.body);

        if (error) {
            return res.status(400).json({ error: error.details });
        }

        // Construct the update object with only the fields provided in the request
        const updatedBug = { ...req.body };

        const updateResult = await updateBug(bugId, updatedBug);

        if (updateResult.modifiedCount === 1) {
            res.status(200).json({ message: `Bug ${bugId} updated` });
        } else {
            res.status(400).json({ message: `Bug ${bugId} not updated` });
        }
    } catch (err) {
        res.status(500).json({ error: err.stack });
    }
});

router.put('/:bugId/classify',validBody(classifyBugSchema),async (req,res) =>{
    //FIXME: classify bug and send response as JSON
    const bugId = req.params.bugId;

    // Check if bugId is a valid ObjectId
    if (!isValidObjectId(bugId)) {
        return res.status(404).json({ error: `bugId ${bugId} is not a valid ObjectId.` });
    }

    // Read the classification data from the request body
    const { classification } = req.body;

    // Validate the request data against the schema
    const { error } = classifyBugSchema.validate({ classification });

    if (error) {
        return res.status(400).json({ error: error.details });
    }

    try {
        if (!bugId) {
            return res.status(404).json({ error: `Bug ${bugId} not found.` });
        }

        const classifiedBug = { classification, createdAt: new Date() };
        const classifyResult = await classifyBug(bugId, classifiedBug);

        res.status(200).json({ message: 'Bug classified!' });
    } catch (err) {
        res.status(500).json({ error: err.stack });
    }

});

router.put('/:bugId/assign',validBody(assignBugSchema), async (req,res) =>{
    //FIXME: assign bug to a user and send response as JSON
    const bugId = req.params.bugId;

    // Check if bugId is a valid ObjectId
    if (!isValidObjectId(bugId)) {
        return res.status(404).json({ error: `bugId ${bugId} is not a valid ObjectId.` });
    }

    // Read the assignedToUserId and assignedToUserName from the request body
    const { assignedToUserId, assignedToUserName } = req.body;

    // Validate the request data against the schema
    const { error } = assignBugSchema.validate({ assignedToUserId, assignedToUserName });

    if (error) {
        return res.status(400).json({ error: error.details });
    }

    try {
        // Query the database for the user's info based on assignedToUserId (if needed)

        // Check if the bug exists
        const bug = await getBugById(id); 

        if (!bug) {
            return res.status(404).json({ error: `Bug ${bugId} not found.` });
        }

        // Update the bug's assignedToUserId, assignedToUserName, assignedOn, and lastUpdated fields
        bug.assignedToUserId = assignedToUserId;
        bug.assignedToUserName = assignedToUserName;
        bug.assignedOn = new Date();
        bug.lastUpdated = new Date();

        res.status(200).json({ message: 'Bug assigned!' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }

});

router.put("/:bugId/close",validBody(closeBugSchema), (req,res) =>{
    //FIXME: close bug and send response as JSON
    const bugId = req.params.bugId;

    // Check if bugId is a valid ObjectId
    if (!isValidObjectId(bugId)) {
        return res.status(404).json({ error: `bugId ${bugId} is not a valid ObjectId.` });
    }

    // Read the 'closed' value from the request body
    const { closed } = req.body;

    // Validate the request data against the schema
    const { error } = closeBugSchema.validate({ closed });

    if (error) {
        return res.status(400).json({ error: error.details });
    }

    try {
        

        res.status(200).json({ message: 'Bug closed!' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }

});

router.post('/:bugId/comment/new',validId('bugId'),validBody(bugCommentSchema), async (req,res) =>{

  const { bugId } = req.params;
  const { fullName, comment } = req.body;

  try{
    const result = await commentNewBug(bugId, fullName, comment);
    res.status(result.status).json(result.json);
  }catch(err){
    console.error(error)
    res.status(500).json({error: 'Internal server error'});
  }

});

router.get('/:bugId/comment/list',validId('bugId'),async (req,res) =>{
  const {bugId}  = req.params;

  const result = await commentBugList(bugId);

  if(result.success){
    res.status(200).json(result.comments);
  }else{
    res.status(result.status).json(result.json);
  }

});

router.get('/:bugId/comment/:commentId',validId('bugId'),validId('commentId'), async (req,res) =>{
  const { bugId, commentId } = req.params;

  try{
    const comment = await commentBugId(bugId, commentId);

    if(comment){
      res.json(comment);
  }else {
    res.status(404).json({error: `Comment ${commentId} not found`});
  }
  }catch(err){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }
});

router.put ('/:bugId/testCase/new',validId('bugId'),validBody(bugTestCaseSchema), async (req,res) =>{
  const { bugId } = req.params;
  const { version } = req.body;

  try{
    const result = await testCaseNewBug(bugId, version);
    res.status(result.status).json(result.json);
  }catch(err){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }
});

router.get('/:bugId/testCase/list',validId('bugId'), async (req,res) =>{
  const { bugId } = req.params;

  try{
   const testCases = await findTestCasesByBugId(bugId);
   res.json(testCases);
  }catch(error){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }

});

router.get('/:bugId/testCase/:testCaseId',validId('bugId'),validId('testCaseId'), async (req,res) =>{
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



export {router as BugRouter};